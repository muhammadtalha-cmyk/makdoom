'use client';
import { useState } from 'react';
import { Check } from 'lucide-react';
import { formatPKR } from '@/lib/format';

interface Result { order_number: string; status: string; city: string; subtotal: number; shipping_fee: number; total: number; created_at: string; items: { product_name: string; quantity: number; line_total: number }[] }

const STEPS = [
  { id: 'pending', label: 'Order placed' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'dispatched', label: 'Out for delivery' },
  { id: 'delivered', label: 'Delivered' },
];

export default function TrackForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNumber: fd.get('orderNumber'), phone: fd.get('phone') }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not find that order.');
      setResult(json.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = result ? STEPS.findIndex((s) => s.id === result.status) : -1;

  return (
    <div className="mx-auto max-w-2xl">
      <form onSubmit={onSubmit} className="glass rounded-3xl p-6 sm:p-8" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="orderNumber" className="mb-1.5 block text-sm font-medium">Order number</label>
            <input id="orderNumber" name="orderNumber" className="field uppercase" placeholder="MF-AB12CD" autoCapitalize="characters" required />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">Mobile number</label>
            <input id="phone" name="phone" type="tel" inputMode="tel" className="field" placeholder="0300 1234567" required />
          </div>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        <button className="btn btn-gold mt-6 w-full" disabled={busy}>{busy ? 'Looking up…' : 'Track order'}</button>
      </form>

      {result && (
        <div className="glass-strong mt-6 rounded-3xl p-6 sm:p-8" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-4xl">{result.order_number}</h2>
            <p className="text-sm text-smoke">Placed {new Date(result.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          {result.status === 'cancelled' ? (
            <p className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-red-200">This order was cancelled. Message us on WhatsApp if this is a mistake.</p>
          ) : (
            <ol className="mt-6 grid grid-cols-4 gap-2">
              {STEPS.map((s, i) => (
                <li key={s.id} className="text-center">
                  <span className={`mx-auto grid h-10 w-10 place-items-center rounded-full border text-sm ${i <= stepIndex ? 'border-gold-300 bg-gold-300 text-black' : 'border-white/20 text-smoke'}`}>{i <= stepIndex ? <Check size={18} /> : i + 1}</span>
                  <p className={`mt-2 text-xs ${i <= stepIndex ? 'text-gold-100' : 'text-smoke'}`}>{s.label}</p>
                </li>
              ))}
            </ol>
          )}
          <ul className="mt-6 space-y-1.5 border-t border-white/10 pt-5 text-sm">
            {result.items.map((i) => <li key={i.product_name} className="flex justify-between"><span>{i.product_name} × {i.quantity}</span><span>{formatPKR(i.line_total)}</span></li>)}
            <li className="flex justify-between pt-2 text-gold-200"><span>Total (cash on delivery) · {result.city}</span><strong>{formatPKR(result.total)}</strong></li>
          </ul>
        </div>
      )}
    </div>
  );
}
