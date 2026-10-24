'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ImageSlot { key: string; label: string; where: string; hint: string; original: string; current: string; custom: boolean }
interface SocialRow { key: string; label: string; example: string; url: string }
interface Loaded { images: ImageSlot[]; socials: SocialRow[] }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(url, { ...init, headers: isForm ? init?.headers : { 'Content-Type': 'application/json', ...init?.headers }, cache: 'no-store' });
  if (res.status === 401) { window.location.href = '/admin/login'; throw new Error('Signed out'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

/** Shrinks big phone photos in the browser (max 2000px, WebP) so uploads are fast and stay under the server limit. */
async function shrink(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Only JPG, PNG or WebP pictures are allowed.');
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', 0.88));
    if (blob && (blob.size < file.size || k < 1)) return blob;
  } catch { /* fall through and upload the original */ }
  if (file.size > 4 * 1024 * 1024) throw new Error('That picture is too large (maximum 4 MB).');
  return file;
}

async function uploadImage(file: File): Promise<string> {
  const blob = await shrink(file);
  const form = new FormData();
  form.append('file', blob, 'upload');
  const { url } = await api<{ url: string }>('/api/admin/upload', { method: 'POST', body: form });
  return url;
}

function Notice({ ok, text }: { ok: boolean; text: string }) {
  if (!text) return null;
  return <p role={ok ? 'status' : 'alert'} className={`rounded-xl px-4 py-3 text-sm ${ok ? 'bg-emerald-400/10 text-emerald-200' : 'bg-red-400/10 text-red-300'}`}>{text}</p>;
}

/* ---------------------------------------------------------------- home pictures */

function PictureCard({ slot, value, busy, onPick, onReset }: { slot: ImageSlot; value: string; busy: boolean; onPick: (f: File) => void; onReset: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const changed = value !== slot.original;
  return (
    <li className="surface flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl border border-white/15 bg-white/5 sm:w-56">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
        {busy && <span className="absolute inset-0 grid place-items-center bg-black/70 text-xs text-gold-200">Uploading…</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{slot.label}</p>
        <p className="text-xs text-smoke">{slot.where}</p>
        <p className="mt-1 text-xs text-smoke/80">{slot.hint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`${slot.label}: choose a picture`}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); if (input.current) input.current.value = ''; }} />
          <button type="button" className="btn btn-glass !min-h-0 !py-2 text-sm" disabled={busy} onClick={() => input.current?.click()}>Replace picture</button>
          {changed && <button type="button" className="text-xs text-red-300 underline" onClick={onReset}>Use the original picture</button>}
        </div>
      </div>
    </li>
  );
}

function HomePictures({ data, reload }: { data: Loaded; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>({ ok: true, text: '' });

  const value = (s: ImageSlot) => draft[s.key] ?? s.current;
  const dirty = data.images.filter((s) => draft[s.key] !== undefined && draft[s.key] !== s.current);

  async function pick(s: ImageSlot, f: File) {
    setBusyKey(s.key); setMsg({ ok: true, text: '' });
    try { const url = await uploadImage(f); setDraft((d) => ({ ...d, [s.key]: url })); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusyKey(''); }
  }
  async function save() {
    setSaving(true); setMsg({ ok: true, text: '' });
    try {
      const images: Record<string, string | null> = {};
      for (const s of dirty) images[s.key] = draft[s.key] === s.original ? null : draft[s.key]; // the original picture = "remove my change"
      await api('/api/admin/site', { method: 'PATCH', body: JSON.stringify({ images }) });
      setDraft({});
      await reload();
      setMsg({ ok: true, text: 'Saved. The new pictures are live on the home page now.' });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-smoke">These are the pictures on the home page that are not products. Replace any of them, then press <strong className="text-ivory">Save changes</strong>. Product pictures are changed under the <strong className="text-ivory">Products</strong> tab.</p>
      <ul className="space-y-3">
        {data.images.map((s) => (
          <PictureCard key={s.key} slot={s} value={value(s)} busy={busyKey === s.key} onPick={(f) => pick(s, f)} onReset={() => setDraft((d) => ({ ...d, [s.key]: s.original }))} />
        ))}
      </ul>
      <Notice {...msg} />
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-gold" disabled={saving || dirty.length === 0 || busyKey !== ''} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button>
        {dirty.length > 0 && <button type="button" className="text-sm text-smoke underline" onClick={() => { setDraft({}); setMsg({ ok: true, text: '' }); }}>Discard</button>}
        <span className="text-xs text-smoke">{dirty.length ? `${dirty.length} unsaved change${dirty.length === 1 ? '' : 's'}` : ''}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- social links */

function SocialLinks({ data, reload }: { data: Loaded; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>({ ok: true, text: '' });

  const value = (r: SocialRow) => draft[r.key] ?? r.url;
  const dirty = data.socials.filter((r) => draft[r.key] !== undefined && draft[r.key].trim() !== r.url);

  async function save() {
    setSaving(true); setMsg({ ok: true, text: '' });
    try {
      const socials: Record<string, string | null> = {};
      for (const r of dirty) socials[r.key] = draft[r.key].trim() === '' ? null : draft[r.key].trim();
      await api('/api/admin/site', { method: 'PATCH', body: JSON.stringify({ socials }) });
      setDraft({});
      await reload();
      setMsg({ ok: true, text: 'Saved. The links in the footer and on the Contact page are updated.' });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-smoke">Paste the link to each page. A network with an empty box is not shown on the website. The links appear in the footer and on the Contact page.</p>
      <ul className="space-y-3">
        {data.socials.map((r) => (
          <li key={r.key} className="surface rounded-2xl p-4 sm:p-5">
            <label htmlFor={`soc-${r.key}`} className="text-sm font-semibold">{r.label}</label>
            <div className="mt-2 flex items-center gap-3">
              <input id={`soc-${r.key}`} type="url" inputMode="url" autoComplete="off" spellCheck={false} maxLength={300} className="field" placeholder={r.example}
                value={value(r)} onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.value }))} />
              {value(r) && <button type="button" className="shrink-0 text-xs text-red-300 underline" onClick={() => setDraft((d) => ({ ...d, [r.key]: '' }))}>Remove</button>}
            </div>
          </li>
        ))}
      </ul>
      <Notice {...msg} />
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-gold" disabled={saving || dirty.length === 0} onClick={save}>{saving ? 'Saving…' : 'Save links'}</button>
        {dirty.length > 0 && <button type="button" className="text-sm text-smoke underline" onClick={() => { setDraft({}); setMsg({ ok: true, text: '' }); }}>Discard</button>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- shell */

export default function SiteManager({ section }: { section: 'pictures' | 'social' }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setData(await api<Loaded>('/api/admin/site')); setError(''); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error) return <p role="alert" className="rounded-xl bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>;
  if (!data) return <p className="py-10 text-center text-smoke">Loading…</p>;
  return section === 'pictures' ? <HomePictures data={data} reload={load} /> : <SocialLinks data={data} reload={load} />;
}
