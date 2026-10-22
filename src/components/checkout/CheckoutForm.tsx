'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Banknote, Lock } from 'lucide-react';
import { PK_CITIES, SHIPPING } from '@/lib/config';
import { formatPKR } from '@/lib/format';
import { cartShipping, cartSubtotal, useCart } from '@/lib/cart-store';
import type { OrderSummary } from '@/lib/types';

type Errors = Partial<Record<'name' | 'phone' | 'email' | 'city' | 'address' | 'form', string>>;

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ivory/90">{label}</label>
      {children}
      {error ? <p id={`${id}-e`} role="alert" className="mt-1.5 text-sm text-red-300">{error}</p> : hint ? <p className="mt-1.5 text-xs text-smoke">{hint}</p> : null}
    </div>
  );
}

export default function CheckoutForm() {
  const router = useRouter();
  const { items, hydrated, clear, reconcile } = useCart();
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string[]>([]);
  const checked = useRef(false);

  // prices in localStorage may be days old: reconcile with the live catalogue once the bag has loaded
  useEffect(() => {
    if (!hydrated || checked.current) return;
    checked.current = true;
    fetch('/api/catalog').then((r) => (r.ok ? r.json() : null)).then((c) => { if (c) setNotice(reconcile(c)); }).catch(() => {});
  }, [hydrated, reconcile]);

  /** One idempotency key per distinct bag: a double-click, retry or flaky-network resend returns the SAME order instead of creating a duplicate. */
  function idempotencyKey(sig: string) {
    try {
      const saved = JSON.parse(sessionStorage.getItem('mk:idem') ?? 'null') as { sig: string; key: string } | null;
      if (saved?.sig === sig) return saved.key;
      const key = crypto.randomUUID();
      sessionStorage.setItem('mk:idem', JSON.stringify({ sig, key }));
      return key;
    } catch { return crypto.randomUUID(); }
  }

  const list = hydrated ? items : [];
  const subtotal = cartSubtotal(list);
  const shipping = cartShipping(list);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || list.length === 0) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email') || '', city: fd.get('city'), address: fd.get('address'), notes: fd.get('notes') || '', website: fd.get('website') || '',
          items: list.map((i) => ({ slug: i.slug, quantity: i.quantity })),
          idempotencyKey: idempotencyKey(list.map((i) => `${i.slug}:${i.quantity}`).join(',') + String(fd.get('phone'))),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; order?: OrderSummary | null; error?: string; field?: string };
      if (!res.ok || !json.ok) {
        const msg = json.error ?? 'Could not place your order.';
        setErrors((json.field ? { [json.field]: msg } : { form: msg }) as Errors);
        setBusy(false);
        if (json.field) document.getElementById(json.field)?.focus();
        return;
      }
      if (json.order) sessionStorage.setItem('mk:lastOrder', JSON.stringify(json.order));
      sessionStorage.removeItem('mk:idem');
      clear();
      router.replace('/thank-you');
    } catch {
      setErrors({ form: 'Network problem. Please check your connection and try again.' });
      setBusy(false);
    }
  }

  if (hydrated && list.length === 0) {
    return (
      <div className="glass mx-auto max-w-xl rounded-3xl p-10 text-center">
        <h2 className="font-display text-4xl">Your bag is empty</h2>
        <p className="mt-3 text-smoke">Add a fragrance to continue to checkout.</p>
        <Link href="/shop" className="btn btn-gold mt-6">Shop fragrances</Link>
      </div>
    );
  }

  const inv = (k: keyof Errors) => (errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `${k}-e` } : {});

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-5 lg:gap-12">
      <div className="space-y-6 lg:col-span-3">
        <div className="glass rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-3xl">Delivery details</h2>
          <p className="mt-1 text-sm text-smoke">No account needed. We only ask for what the rider needs.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field id="name" label="Full name" error={errors.name}>
              <input id="name" name="name" className="field" autoComplete="name" required placeholder="e.g. Ahmed Khan" {...inv('name')} />
            </Field>
            <Field id="phone" label="Mobile number" error={errors.phone} hint="We confirm your order on this number.">
              <input id="phone" name="phone" type="tel" inputMode="tel" className="field" autoComplete="tel" required placeholder="0300 1234567" {...inv('phone')} />
            </Field>
            <Field id="email" label="Email (optional)" error={errors.email}>
              <input id="email" name="email" type="email" inputMode="email" className="field" autoComplete="email" placeholder="you@email.com" {...inv('email')} />
            </Field>
            <Field id="city" label="City" error={errors.city}>
              <input id="city" name="city" list="cities" className="field" autoComplete="address-level2" required placeholder="Start typing your city" {...inv('city')} />
              <datalist id="cities">{PK_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <div className="sm:col-span-2">
              <Field id="address" label="Full address" error={errors.address} hint="House number, street, area and nearest landmark.">
                <textarea id="address" name="address" rows={3} className="field resize-none" autoComplete="street-address" required placeholder="House 12, Street 4, Block B, near ..." {...inv('address')} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="notes" label="Order notes (optional)">
                <input id="notes" name="notes" className="field" placeholder="Anything the rider should know?" />
              </Field>
            </div>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          </div>
        </div>

        <div className="glass rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-3xl">Payment</h2>
          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-gold-300/50 bg-gold-300/10 p-4">
            <Banknote className="shrink-0 text-gold-200" size={28} strokeWidth={1.3} />
            <div>
              <p className="font-semibold">Cash on delivery</p>
              <p className="text-sm text-ivory/70">Pay the rider in cash when your parcel arrives.</p>
            </div>
          </div>
        </div>
      </div>

      <aside className="lg:col-span-2">
        <div className="glass-strong rounded-3xl p-6 sm:p-8 lg:sticky lg:top-28">
          <h2 className="font-display text-3xl">Order summary</h2>
          <ul className="mt-5 space-y-4">
            {list.map((i) => (
              <li key={i.slug} className="flex items-center gap-4">
                <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10">
                  <Image src={i.image} alt="" fill sizes="64px" className="object-cover" />
                  <span className="absolute -right-0 -top-0 grid h-5 min-w-5 place-items-center rounded-bl-lg bg-gold-300 px-1 text-[11px] font-bold text-black">{i.quantity}</span>
                </div>
                <div className="min-w-0 flex-1"><p className="font-display text-xl leading-tight">{i.name}</p></div>
                <p className="text-sm">{formatPKR(i.price * i.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-6 space-y-2 border-t border-white/10 pt-5 text-sm">
            <div className="flex justify-between"><dt className="text-smoke">Subtotal</dt><dd>{formatPKR(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-smoke">Delivery</dt><dd>{shipping === 0 ? 'Free' : formatPKR(shipping)}</dd></div>
            {shipping > 0 && <p className="text-xs text-gold-200">Free delivery over {formatPKR(SHIPPING.freeOver)}</p>}
            <div className="flex items-baseline justify-between pt-2"><dt className="font-display text-2xl">Total to pay</dt><dd className="font-display text-3xl text-gold-200">{formatPKR(subtotal + shipping)}</dd></div>
          </dl>

          {notice.length > 0 && <ul role="status" className="mt-5 space-y-1 rounded-xl border border-gold-300/30 bg-gold-300/10 p-3 text-sm text-gold-100">{notice.map((n) => <li key={n}>{n}</li>)}</ul>}
          {errors.form && <p role="alert" className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{errors.form}</p>}
          <button type="submit" disabled={busy || !hydrated} className="btn btn-gold mt-6 w-full !min-h-[56px] text-base">
            {busy ? 'Placing your order…' : `Place order · ${formatPKR(subtotal + shipping)}`}
          </button>
          <p className="mt-4 flex items-start gap-2 text-xs text-smoke"><Lock size={14} className="mt-0.5 shrink-0" /> After you place the order, WhatsApp opens with your order details so we can confirm it with you.</p>
        </div>
      </aside>
    </form>
  );
}
