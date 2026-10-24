'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPKR } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';
import ProductManager from './ProductManager';
import SiteManager from './SiteManager';

const STATUSES: OrderStatus[] = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'];
const TONE: Record<OrderStatus, string> = { pending: 'bg-amber-400/15 text-amber-200', confirmed: 'bg-sky-400/15 text-sky-200', dispatched: 'bg-violet-400/15 text-violet-200', delivered: 'bg-emerald-400/15 text-emerald-200', cancelled: 'bg-red-400/15 text-red-300' };

interface Order { id: string; order_number: string; status: OrderStatus; customer_name: string; phone: string; email: string | null; city: string; address: string; notes: string | null; subtotal: number; shipping_fee: number; total: number; created_at: string; owner_notified: boolean; order_items: { product_name: string; quantity: number; unit_price: number; line_total: number }[] }
interface Stats { byStatus: Record<OrderStatus, number>; revenue: { today: number; week: number; month: number }; ordersLast30: number; unhandledMessages: number; subscribers: number }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers }, cache: 'no-store' });
  if (res.status === 401) { window.location.href = '/admin/login'; throw new Error('Signed out'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}
const when = (d: string) => new Date(d).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' });

function useLoad<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try { setData(await api<T>(url)); setError(''); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [url]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="surface rounded-2xl p-4"><p className="text-xs text-smoke">{label}</p><p className="mt-1 font-display text-3xl">{value}</p>{hint && <p className="text-xs text-smoke/70">{hint}</p>}</div>;
}

function Orders({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => { const t = setTimeout(() => { setTerm(q); setPage(1); }, 350); return () => clearTimeout(t); }, [q]);
  const params = new URLSearchParams({ page: String(page), ...(status ? { status } : {}), ...(term ? { q: term } : {}) });
  const { data, error, loading, reload } = useLoad<{ orders: Order[]; total: number; pageSize: number }>(`/api/admin/orders?${params}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  async function setOrderStatus(o: Order, next: OrderStatus) {
    if (next === o.status) return;
    if (next === 'cancelled' && !confirm(`Cancel order ${o.order_number}?`)) return;
    try { await api('/api/admin/orders', { method: 'PATCH', body: JSON.stringify({ id: o.id, status: next }) }); setNote(`${o.order_number} → ${next}`); await reload(); onChange(); } catch (e) { setNote((e as Error).message); }
  }
  const exportUrl = `/api/admin/export?${new URLSearchParams({ ...(status ? { status } : {}), ...(term ? { q: term } : {}) })}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order no., name, phone, city" className="field max-w-xs" aria-label="Search orders" />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {(['', ...STATUSES] as const).map((s) => (
            <button key={s || 'all'} onClick={() => { setStatus(s); setPage(1); }} aria-pressed={status === s} className={`rounded-full border px-3 py-1.5 text-xs capitalize ${status === s ? 'border-gold-300 bg-gold-300/15 text-gold-100' : 'border-white/10 text-smoke hover:text-ivory'}`}>{s || 'All'}</button>
          ))}
        </div>
        <a href={exportUrl} className="btn btn-glass ml-auto !py-2 text-sm">Export CSV</a>
      </div>
      <p role="status" className="mt-3 h-5 text-xs text-gold-200">{note}</p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <ul className={`mt-2 space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
        {data?.orders.map((o) => (
          <li key={o.id} className="surface rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button onClick={() => setOpen(open === o.id ? null : o.id)} className="text-left" aria-expanded={open === o.id}>
                <span className="font-mono text-sm font-semibold text-gold-100">{o.order_number}</span>
                <span className="ml-3 text-sm">{o.customer_name}</span>
                <span className="ml-3 text-xs text-smoke">{o.city} · {when(o.created_at)}</span>
              </button>
              <span className={`rounded-full px-2.5 py-1 text-xs capitalize ${TONE[o.status]}`}>{o.status}</span>
              {!o.owner_notified && <span className="rounded-full bg-red-400/10 px-2 py-1 text-[11px] text-red-300" title="The owner email did not send; check RESEND_API_KEY">email not sent</span>}
              <span className="ml-auto font-semibold text-gold-200">{formatPKR(o.total)}</span>
              <select value={o.status} onChange={(e) => setOrderStatus(o, e.target.value as OrderStatus)} className="field !w-auto !py-1.5 text-sm" aria-label={`Status for ${o.order_number}`}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {open === o.id && (
              <div className="mt-4 grid gap-4 border-t border-white/10 pt-4 text-sm md:grid-cols-2">
                <div className="space-y-1">
                  <p><span className="text-smoke">Phone </span><a className="text-gold-200 underline" href={`tel:${o.phone}`}>{o.phone}</a> · <a className="text-gold-200 underline" target="_blank" rel="noopener noreferrer" href={`https://wa.me/92${o.phone.slice(1)}`}>WhatsApp</a></p>
                  {o.email && <p><span className="text-smoke">Email </span>{o.email}</p>}
                  <p><span className="text-smoke">Address </span>{o.address}, {o.city}</p>
                  {o.notes && <p><span className="text-smoke">Notes </span>{o.notes}</p>}
                </div>
                <div>
                  <ul className="space-y-1">{o.order_items.map((i, k) => <li key={k} className="flex justify-between gap-4"><span>{i.quantity} × {i.product_name}</span><span className="text-smoke">{formatPKR(i.line_total)}</span></li>)}</ul>
                  <p className="mt-2 flex justify-between border-t border-white/10 pt-2 text-smoke"><span>Delivery</span><span>{o.shipping_fee ? formatPKR(o.shipping_fee) : 'Free'}</span></p>
                  <p className="flex justify-between font-semibold text-gold-200"><span>Collect on delivery</span><span>{formatPKR(o.total)}</span></p>
                </div>
              </div>
            )}
          </li>
        ))}
        {data && data.orders.length === 0 && <li className="py-10 text-center text-smoke">No orders match.</li>}
      </ul>
      <div className="mt-5 flex items-center justify-between text-sm text-smoke">
        <span>{data ? `${data.total} order${data.total === 1 ? '' : 's'}` : ''}</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-glass !px-4 !py-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="btn btn-glass !px-4 !py-2" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

function Inbox() {
  const { data, error, reload } = useLoad<{ messages: { id: string; name: string; email: string; phone: string | null; message: string; handled: boolean; created_at: string }[] }>('/api/admin/messages');
  const toggle = async (id: string, handled: boolean) => { await api('/api/admin/messages', { method: 'PATCH', body: JSON.stringify({ id, handled }) }); await reload(); };
  return (
    <div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <ul className="space-y-3">
        {data?.messages.map((m) => (
          <li key={m.id} className={`surface rounded-2xl p-5 ${m.handled ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-center gap-3 text-sm"><strong>{m.name}</strong><a className="text-gold-200 underline" href={`mailto:${m.email}`}>{m.email}</a>{m.phone && <span className="text-smoke">{m.phone}</span>}<span className="ml-auto text-xs text-smoke">{when(m.created_at)}</span></div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ivory/85">{m.message}</p>
            <button className="mt-3 text-xs text-gold-200 underline" onClick={() => toggle(m.id, !m.handled)}>{m.handled ? 'Mark unhandled' : 'Mark handled'}</button>
          </li>
        ))}
        {data && data.messages.length === 0 && <li className="py-10 text-center text-smoke">No messages yet.</li>}
      </ul>
    </div>
  );
}

function Subscribers() {
  const { data, error } = useLoad<{ subscribers: { email: string; created_at: string }[]; total: number }>('/api/admin/subscribers');
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><p className="text-sm text-smoke">{data?.total ?? 0} subscribers</p><a href="/api/admin/subscribers?format=csv" className="btn btn-glass !py-2 text-sm">Export CSV</a></div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <ul className="surface divide-y divide-white/10 rounded-2xl text-sm">{data?.subscribers.map((s) => <li key={s.email} className="flex justify-between gap-4 px-5 py-3"><span>{s.email}</span><span className="text-smoke">{when(s.created_at)}</span></li>)}</ul>
    </div>
  );
}

function Activity() {
  const { data, error } = useLoad<{ events: { id: number; at: string; action: string; target: string | null; meta: Record<string, unknown> }[] }>('/api/admin/audit');
  return (
    <div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <ul className="surface divide-y divide-white/10 rounded-2xl text-sm">
        {data?.events.map((e) => <li key={e.id} className="flex flex-wrap gap-x-4 px-5 py-3"><span className="font-mono text-gold-100">{e.action}</span>{e.target && <span>{e.target}</span>}<span className="ml-auto text-smoke">{when(e.at)}</span></li>)}
      </ul>
    </div>
  );
}

const TABS = ['Orders', 'Products', 'Home pictures', 'Social links', 'Inbox', 'Subscribers', 'Activity'] as const;

export default function AdminPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Orders');
  const { data: stats, reload: reloadStats } = useLoad<Stats>('/api/admin/stats');
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => { timer.current = setInterval(() => { if (!document.hidden) void reloadStats(); }, 60_000); return () => clearInterval(timer.current); }, [reloadStats]);

  async function logout() { await fetch('/api/admin/logout', { method: 'POST' }); router.replace('/admin/login'); router.refresh(); }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-5xl leading-none sm:text-6xl">Owner dashboard</h1>
        <button onClick={logout} className="btn btn-glass !py-2 text-sm">Sign out</button>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Stat label="New orders" value={stats?.byStatus.pending ?? '–'} hint="waiting to be confirmed" />
        <Stat label="Today" value={stats ? formatPKR(stats.revenue.today) : '–'} />
        <Stat label="Last 7 days" value={stats ? formatPKR(stats.revenue.week) : '–'} />
        <Stat label="Last 30 days" value={stats ? formatPKR(stats.revenue.month) : '–'} hint={stats ? `${stats.ordersLast30} orders` : undefined} />
        <Stat label="Unread messages" value={stats?.unhandledMessages ?? '–'} />
        <Stat label="Subscribers" value={stats?.subscribers ?? '–'} />
      </div>
      <div role="tablist" aria-label="Dashboard sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-white/10">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`whitespace-nowrap px-4 py-3 text-sm font-medium ${tab === t ? 'border-b-2 border-gold-300 text-gold-100' : 'text-smoke hover:text-ivory'}`}>{t}</button>)}
      </div>
      {tab === 'Orders' && <Orders onChange={reloadStats} />}
      {tab === 'Products' && <ProductManager />}
      {tab === 'Home pictures' && <SiteManager section="pictures" />}
      {tab === 'Social links' && <SiteManager section="social" />}
      {tab === 'Inbox' && <Inbox />}
      {tab === 'Subscribers' && <Subscribers />}
      {tab === 'Activity' && <Activity />}
    </div>
  );
}
