'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatPKR } from '@/lib/format';

type Gender = 'men' | 'women' | 'unisex' | 'couple';
interface Product {
  id: string; slug: string; name: string; inspired_by: string | null; gender: Gender; price: number; compare_at_price: number | null;
  tagline: string; short_description: string; description: string; scent_family: string[]; accent: string; is_bundle: boolean;
  bundle_slugs: string[]; image: string; hover_image: string | null; gallery: string[]; in_stock: boolean; featured: boolean;
  sort_order: number; protected?: boolean;
}
interface Draft {
  id?: string; slug: string; name: string; inspired_by: string; gender: Gender; price: string; compare_at_price: string;
  tagline: string; short_description: string; description: string; scent: string; accent: string; is_bundle: boolean;
  bundle_slugs: string[]; image: string; hover_image: string; gallery: string[]; in_stock: boolean; featured: boolean; sort_order: number | null;
}

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'men', label: 'For him' }, { id: 'women', label: 'For her' }, { id: 'unisex', label: 'Unisex' }, { id: 'couple', label: 'Deal / set' },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(url, { ...init, headers: isForm ? init?.headers : { 'Content-Type': 'application/json', ...init?.headers }, cache: 'no-store' });
  if (res.status === 401) { window.location.href = '/admin/login'; throw new Error('Signed out'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

/** Shrinks big phone photos in the browser (max 1600px, WebP) so uploads are fast and stay under the server limit. */
async function shrink(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Only JPG, PNG or WebP pictures are allowed.');
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', 0.86));
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

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const emptyDraft = (): Draft => ({
  slug: '', name: '', inspired_by: '', gender: 'men', price: '', compare_at_price: '', tagline: '', short_description: '', description: '',
  scent: '', accent: '#d9a441', is_bundle: false, bundle_slugs: [], image: '', hover_image: '', gallery: [], in_stock: true, featured: false, sort_order: null,
});
const toDraft = (p: Product): Draft => ({
  id: p.id, slug: p.slug, name: p.name, inspired_by: p.inspired_by ?? '', gender: p.gender, price: String(p.price),
  compare_at_price: p.compare_at_price ? String(p.compare_at_price) : '', tagline: p.tagline, short_description: p.short_description,
  description: p.description, scent: p.scent_family.join(', '), accent: p.accent, is_bundle: p.is_bundle, bundle_slugs: p.bundle_slugs,
  image: p.image, hover_image: p.hover_image ?? '', gallery: p.gallery, in_stock: p.in_stock, featured: p.featured, sort_order: p.sort_order,
});

/** One picture slot: preview, upload / replace, remove. */
function ImageSlot({ label, hint, value, onChange, onError, required }: { label: string; hint: string; value: string; onChange: (url: string) => void; onError: (m: string) => void; required?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    try { onChange(await uploadImage(f)); } catch (e) { onError((e as Error).message); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  return (
    <div>
      <p className="text-sm font-medium">{label}{required && <span className="text-gold-300"> *</span>}</p>
      <p className="mb-2 text-xs text-smoke">{hint}</p>
      <div className="flex items-start gap-3">
        <div className="relative grid aspect-[4/5] w-28 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/15 bg-white/5 text-xs text-smoke">
          {value ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" /> : 'No picture'}
          {busy && <span className="absolute inset-0 grid place-items-center bg-black/70 text-xs text-gold-200">Uploading…</span>}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files)} aria-label={`${label}: choose a picture`} />
          <button type="button" className="btn btn-glass !min-h-0 !py-2 text-sm" disabled={busy} onClick={() => input.current?.click()}>{value ? 'Replace picture' : 'Upload picture'}</button>
          {value && !required && <button type="button" className="text-left text-xs text-red-300 underline" onClick={() => onChange('')}>Remove</button>}
        </div>
      </div>
    </div>
  );
}

function Gallery({ urls, onChange, onError }: { urls: string[]; onChange: (u: string[]) => void; onError: (m: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const added: string[] = [];
    try {
      for (const f of Array.from(files)) {
        if (urls.length + added.length >= 12) { onError('A product can have at most 12 gallery pictures.'); break; }
        added.push(await uploadImage(f));
      }
    } catch (e) { onError((e as Error).message); }
    if (added.length) onChange([...urls, ...added]);
    setBusy(false);
    if (input.current) input.current.value = '';
  }
  const move = (i: number, d: number) => { const n = [...urls]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <div>
      <p className="text-sm font-medium">Gallery pictures</p>
      <p className="mb-2 text-xs text-smoke">Extra photos on the product page (lifestyle shots, close-ups). Add as many as you like, up to 12. Use the arrows to change the order.</p>
      <ul className="flex flex-wrap gap-3">
        {urls.map((u, i) => (
          <li key={u} className="w-28">
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/15">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt="" className="absolute inset-0 h-full w-full object-cover" /></div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1.5 py-1 text-smoke disabled:opacity-30" aria-label="Move earlier">←</button>
              <button type="button" onClick={() => onChange(urls.filter((x) => x !== u))} className="text-red-300 underline">Delete</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === urls.length - 1} className="px-1.5 py-1 text-smoke disabled:opacity-30" aria-label="Move later">→</button>
            </div>
          </li>
        ))}
        <li className="w-28">
          <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => add(e.target.files)} aria-label="Add gallery pictures" />
          <button type="button" disabled={busy || urls.length >= 12} onClick={() => input.current?.click()} className="grid aspect-[4/5] w-full place-items-center rounded-xl border border-dashed border-white/25 text-center text-xs text-smoke hover:border-gold-300 hover:text-gold-200 disabled:opacity-50">{busy ? 'Uploading…' : '+ Add pictures'}</button>
        </li>
      </ul>
    </div>
  );
}

/** Shows exactly what shoppers see on the catalogue card: hover over it to try the reveal. */
function CardPreview({ main, hover }: { main: string; hover: string }) {
  return (
    <div className="group relative aspect-[4/5] w-44 overflow-hidden rounded-2xl border border-white/15 bg-white/5" onPointerEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--hx', `${((e.clientX - r.left) / r.width) * 100}%`); e.currentTarget.style.setProperty('--hy', `${((e.clientY - r.top) / r.height) * 100}%`); }}>
      {main && /* eslint-disable-next-line @next/next/no-img-element */ <img src={main} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {hover && (
        <div className="card-reveal absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hover} alt="" className="card-reveal-img absolute inset-0 h-full w-full object-cover" />
          <div className="card-reveal-shade absolute inset-0" />
        </div>
      )}
    </div>
  );
}

function Editor({ initial, all, onDone, onCancel }: { initial: Draft; all: Product[]; onDone: (msg: string) => void; onCancel: () => void }) {
  const creating = !initial.id;
  const [d, setD] = useState<Draft>(initial);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const singles = all.filter((p) => !p.is_bundle && p.slug !== d.slug);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save() {
    setErr('');
    const price = Number(d.price);
    const compare = d.compare_at_price.trim() ? Number(d.compare_at_price) : null;
    if (!d.name.trim()) return setErr('Enter the perfume name.');
    if (creating && !d.slug.trim()) return setErr('Enter a web address for the product page.');
    if (!Number.isInteger(price) || price < 1) return setErr('Enter the price as a whole number of rupees.');
    if (compare !== null && (!Number.isInteger(compare) || compare <= price)) return setErr('The "was" price must be a whole number higher than the price.');
    if (!d.image) return setErr('Upload the main catalogue picture (the one with the box).');
    const body = {
      name: d.name.trim(), inspired_by: d.inspired_by.trim() || null, gender: d.gender, price, compare_at_price: compare,
      tagline: d.tagline.trim(), short_description: d.short_description.trim(), description: d.description.trim(),
      scent_family: d.scent.split(',').map((s) => s.trim()).filter(Boolean), accent: d.accent, is_bundle: d.is_bundle,
      bundle_slugs: d.is_bundle ? d.bundle_slugs : [], image: d.image, hover_image: d.hover_image || null, gallery: d.gallery,
      in_stock: d.in_stock, featured: d.featured,
    };
    setBusy(true);
    try {
      if (creating) await api('/api/admin/products', { method: 'POST', body: JSON.stringify({ ...body, slug: d.slug.trim() }) });
      else await api('/api/admin/products', { method: 'PATCH', body: JSON.stringify({ id: d.id, ...body }) });
      onDone(`${body.name} ${creating ? 'added' : 'saved'}. The shop is updated.`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  const label = 'block text-xs text-smoke';
  return (
    <div className="surface rounded-3xl p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-4xl">{creating ? 'Add a new perfume' : `Edit ${initial.name}`}</h2>
        <button type="button" className="btn btn-glass !min-h-0 !py-2 text-sm" onClick={() => { if (!dirty || confirm('Discard your changes?')) onCancel(); }}>← Back to products</button>
      </div>

      <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <section className="space-y-4">
          <h3 className="font-display text-2xl text-gold-100">Details</h3>
          <label className={label}>Perfume name *<input className="field mt-1" maxLength={80} value={d.name} onChange={(e) => { set('name', e.target.value); if (creating && !slugTouched) set('slug', slugify(e.target.value)); }} /></label>
          {creating ? (
            <label className={label}>Web address *<input className="field mt-1" maxLength={60} value={d.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} /><span className="mt-1 block text-[11px]">Page will be /product/{d.slug || 'your-perfume'}. It cannot be changed later.</span></label>
          ) : <p className="text-xs text-smoke">Web address: /product/{d.slug}</p>}
          <label className={label}>Inspired by (optional)<input className="field mt-1" maxLength={80} value={d.inspired_by} onChange={(e) => set('inspired_by', e.target.value)} /></label>
          <label className={label}>Category
            <select className="field mt-1" value={d.gender} onChange={(e) => set('gender', e.target.value as Gender)}>{GENDERS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>Price (PKR) *<input type="number" min={1} className="field mt-1" value={d.price} onChange={(e) => set('price', e.target.value)} /></label>
            <label className={label}>Old price (PKR), optional<input type="number" min={1} className="field mt-1" value={d.compare_at_price} onChange={(e) => set('compare_at_price', e.target.value)} /></label>
          </div>
          <label className={label}>Tagline<input className="field mt-1" maxLength={160} value={d.tagline} onChange={(e) => set('tagline', e.target.value)} /></label>
          <label className={label}>Short description<textarea className="field mt-1 min-h-[72px]" maxLength={400} value={d.short_description} onChange={(e) => set('short_description', e.target.value)} /></label>
          <label className={label}>Full description<textarea className="field mt-1 min-h-[140px]" maxLength={4000} value={d.description} onChange={(e) => set('description', e.target.value)} /></label>
          <label className={label}>Scent notes (separate with commas)<input className="field mt-1" value={d.scent} onChange={(e) => set('scent', e.target.value)} placeholder="Fresh, Woody, Spicy" /></label>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <label className="flex items-center gap-2 text-xs text-smoke">Accent colour <input type="color" value={d.accent} onChange={(e) => set('accent', e.target.value)} className="h-9 w-12 cursor-pointer rounded bg-transparent" /></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={d.in_stock} onChange={(e) => set('in_stock', e.target.checked)} /> In stock</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={d.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured</label>
          </div>
          <div className="rounded-2xl border border-white/10 p-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.is_bundle} onChange={(e) => set('is_bundle', e.target.checked)} /> This is a gift set / deal made of other perfumes</label>
            {d.is_bundle && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {singles.length === 0 && <li className="text-xs text-smoke">Add some single perfumes first.</li>}
                {singles.map((p) => (
                  <li key={p.slug}><label className="flex items-center gap-2"><input type="checkbox" checked={d.bundle_slugs.includes(p.slug)} onChange={(e) => set('bundle_slugs', e.target.checked ? [...d.bundle_slugs, p.slug] : d.bundle_slugs.filter((s) => s !== p.slug))} /> {p.name}</label></li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="font-display text-2xl text-gold-100">Pictures</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <ImageSlot required label="Catalogue picture (with the box)" hint="Shown on the shop and homepage cards. Portrait 4:5 looks best." value={d.image} onChange={(u) => set('image', u)} onError={setErr} />
            <ImageSlot label="Hover picture" hint="Appears with a smooth reveal when someone hovers the card." value={d.hover_image} onChange={(u) => set('hover_image', u)} onError={setErr} />
          </div>
          <div>
            <p className="mb-2 text-xs text-smoke">Preview: move your mouse over the card.</p>
            <CardPreview main={d.image} hover={d.hover_image || d.gallery[0] || ''} />
            {!d.hover_image && d.gallery[0] && <p className="mt-2 text-[11px] text-smoke">No hover picture chosen, so the first gallery picture is used.</p>}
          </div>
          <Gallery urls={d.gallery} onChange={(u) => set('gallery', u)} onError={setErr} />
        </section>
      </div>

      {err && <p role="alert" className="mt-6 rounded-xl bg-red-400/10 px-4 py-3 text-sm text-red-300">{err}</p>}
      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
        <button type="button" className="btn btn-gold" disabled={busy || (!creating && !dirty)} onClick={save}>{busy ? 'Saving…' : creating ? 'Add perfume' : 'Save changes'}</button>
        <button type="button" className="btn btn-glass" onClick={() => { if (!dirty || confirm('Discard your changes?')) onCancel(); }}>Cancel</button>
        {dirty && <span className="text-xs text-gold-200">Unsaved changes</span>}
      </div>
    </div>
  );
}

export default function ProductManager() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try { setProducts((await api<{ products: Product[] }>('/api/admin/products')).products); setError(''); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (products ?? []).filter((p) => !n || `${p.name} ${p.slug} ${p.inspired_by ?? ''}`.toLowerCase().includes(n));
  }, [products, q]);

  async function patch(p: Product, body: Record<string, unknown>, ok: string) {
    setBusyId(p.id); setMsg('');
    try { await api('/api/admin/products', { method: 'PATCH', body: JSON.stringify({ id: p.id, ...body }) }); setMsg(ok); await load(); } catch (e) { setMsg((e as Error).message); } finally { setBusyId(''); }
  }
  async function remove(p: Product) {
    if (!confirm(`Delete ${p.name} permanently?\n\nIt disappears from the shop immediately. Past orders are not affected.`)) return;
    setBusyId(p.id); setMsg('');
    try { await api('/api/admin/products', { method: 'DELETE', body: JSON.stringify({ id: p.id }) }); setMsg(`${p.name} deleted.`); await load(); } catch (e) { setMsg((e as Error).message); } finally { setBusyId(''); }
  }
  async function move(p: Product, dir: -1 | 1) {
    if (!products) return;
    const ordered = [...products].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const i = ordered.findIndex((x) => x.id === p.id);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    setBusyId(p.id); setMsg('');
    try {
      for (let k = 0; k < ordered.length; k++) {
        if (ordered[k].sort_order !== k + 1) await api('/api/admin/products', { method: 'PATCH', body: JSON.stringify({ id: ordered[k].id, sort_order: k + 1 }) });
      }
      setMsg('Order updated.'); await load();
    } catch (e) { setMsg((e as Error).message); } finally { setBusyId(''); }
  }

  if (editing && products) {
    return <Editor initial={editing} all={products} onCancel={() => setEditing(null)} onDone={(m) => { setEditing(null); setMsg(m); void load(); }} />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search perfumes" className="field max-w-xs" aria-label="Search products" />
        <button type="button" className="btn btn-gold ml-auto !py-2" onClick={() => setEditing(emptyDraft())}>+ Add perfume</button>
      </div>
      <p role="status" className="mt-3 min-h-5 text-xs text-gold-200">{msg}</p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!products && !error && <p className="py-10 text-center text-smoke">Loading…</p>}
      <ul className="mt-2 space-y-3">
        {list.map((p) => (
          <li key={p.id} className={`surface flex flex-wrap items-center gap-4 rounded-2xl p-4 transition-opacity ${busyId === p.id ? 'opacity-60' : ''}`}>
            <div className="relative h-24 w-[76px] shrink-0 overflow-hidden rounded-xl border border-white/10">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.image} alt="" className="absolute inset-0 h-full w-full object-cover" /></div>
            <div className="min-w-[160px] flex-1">
              <p className="font-display text-2xl leading-none">{p.name}</p>
              <p className="mt-1 text-xs text-smoke">/product/{p.slug}</p>
              <p className="mt-1.5 text-sm text-gold-200">{formatPKR(p.price)}{p.compare_at_price ? <span className="ml-2 text-xs text-smoke line-through">{formatPKR(p.compare_at_price)}</span> : null}</p>
              <p className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                {p.is_bundle && <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-sky-200">Deal</span>}
                {p.protected && <span className="rounded-full bg-violet-400/15 px-2 py-0.5 text-violet-200" title="Shown in the 3D homepage / menu: editable but cannot be deleted">3D / menu</span>}
                {!p.in_stock && <span className="rounded-full bg-red-400/15 px-2 py-0.5 text-red-300">Sold out</span>}
                {p.featured && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-200">Featured</span>}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={p.in_stock} disabled={busyId === p.id} onChange={(e) => patch(p, { in_stock: e.target.checked }, `${p.name} marked ${e.target.checked ? 'in stock' : 'sold out'}.`)} /> In stock</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={p.featured} disabled={busyId === p.id} onChange={(e) => patch(p, { featured: e.target.checked }, `${p.name} ${e.target.checked ? 'is now featured' : 'is no longer featured'}.`)} /> Featured</label>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-glass !min-h-0 !px-3 !py-2 text-sm" disabled={!!busyId || !!q} onClick={() => move(p, -1)} aria-label={`Move ${p.name} earlier`} title="Move earlier in the shop">↑</button>
              <button type="button" className="btn btn-glass !min-h-0 !px-3 !py-2 text-sm" disabled={!!busyId || !!q} onClick={() => move(p, 1)} aria-label={`Move ${p.name} later`} title="Move later in the shop">↓</button>
              <button type="button" className="btn btn-gold !min-h-0 !py-2 text-sm" onClick={() => setEditing(toDraft(p))}>Edit</button>
              <button type="button" className="btn btn-glass !min-h-0 !py-2 text-sm !text-red-300 disabled:!opacity-40" disabled={!!busyId || p.protected} title={p.protected ? 'This product powers the 3D homepage / menu. Mark it sold out instead.' : 'Delete'} onClick={() => remove(p)}>Delete</button>
            </div>
          </li>
        ))}
        {products && list.length === 0 && <li className="py-10 text-center text-smoke">No products match.</li>}
      </ul>
    </div>
  );
}
