'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { OrderSummary } from '@/lib/types';
import { formatPKR } from '@/lib/format';
import { orderWhatsAppUrl } from '@/lib/whatsapp';
import { WhatsAppIcon } from '@/components/ui/icons';

const COUNTDOWN = 3;

/**
 * Order placed → this page → WhatsApp opens automatically with the confirmation message →
 * when the customer comes back (Back button / app switch) this same page is waiting for them.
 */
export default function ThankYou() {
  const [order, setOrder] = useState<OrderSummary | null | undefined>(undefined);
  const [left, setLeft] = useState(COUNTDOWN);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('mk:lastOrder');
      setOrder(raw ? (JSON.parse(raw) as OrderSummary) : null);
    } catch {
      setOrder(null);
    }
  }, []);

  useEffect(() => {
    if (!order) return;
    const flag = `mk:wa:${order.orderNumber}`;
    if (sessionStorage.getItem(flag)) return; // already sent them once — don't loop on Back
    setRedirecting(true);
    const tick = window.setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    const go = window.setTimeout(() => {
      sessionStorage.setItem(flag, '1');
      window.location.href = orderWhatsAppUrl(order);
    }, COUNTDOWN * 1000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(go);
    };
  }, [order]);

  // coming back from WhatsApp (Back button or app switch): drop the countdown message
  useEffect(() => {
    let away = false;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') away = true;
      else if (away) setRedirecting(false);
    };
    const onShow = (e: PageTransitionEvent) => e.persisted && setRedirecting(false);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onShow);
    };
  }, []);

  const openNow = () => {
    if (!order) return;
    sessionStorage.setItem(`mk:wa:${order.orderNumber}`, '1');
    window.location.href = orderWhatsAppUrl(order);
  };

  if (order === undefined) return <section className="min-h-[70svh]" />;

  return (
    <section className="container-x grid min-h-[80svh] place-items-center pb-24 pt-36">
      <div className="glass-strong w-full max-w-2xl rounded-[32px] p-8 text-center sm:p-12">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-gold-300/60 bg-gold-300/10 text-gold-200 shadow-gold">
          <Check size={38} strokeWidth={1.6} />
        </div>
        <h1 className="mt-6 font-display text-5xl font-medium leading-none sm:text-6xl">Thank you{order ? `, ${order.customer.name.split(' ')[0]}` : ''}</h1>

        {order ? (
          <>
            <p className="mt-4 text-ivory/80">Your order <strong className="text-gold-200">{order.orderNumber}</strong> is placed. You will pay <strong>{formatPKR(order.total)}</strong> in cash when it arrives.</p>
            {order.demo && <p className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">Demo order: the database is not connected yet, so this order was not saved.</p>}

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5 text-left text-sm">
              <ul className="space-y-1.5">
                {order.lines.map((l) => <li key={l.slug} className="flex justify-between gap-4"><span>{l.name} × {l.quantity}</span><span>{formatPKR(l.line_total)}</span></li>)}
              </ul>
              <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-smoke"><span>Delivery</span><span>{order.shipping === 0 ? 'Free' : formatPKR(order.shipping)}</span></div>
              <p className="mt-3 text-smoke">Delivering to {order.customer.address}, {order.customer.city}</p>
            </div>

            {redirecting && left > 0 ? (
              <p className="mt-6 text-gold-100" role="status">Opening WhatsApp to confirm your order in {left}…</p>
            ) : (
              <p className="mt-6 text-sm text-smoke">Send the confirmation message on WhatsApp so we can verify your order.</p>
            )}
            <button type="button" onClick={openNow} className="btn btn-gold mt-4 w-full sm:w-auto"><WhatsAppIcon width={18} height={18} /> Confirm on WhatsApp</button>
          </>
        ) : (
          <p className="mt-4 text-ivory/80">We have your order. If you need anything, message us on WhatsApp or track your order with your order number.</p>
        )}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/track" className="btn btn-glass">Track my order</Link>
          <Link href="/shop" className="btn btn-glass">Continue shopping</Link>
        </div>
      </div>
    </section>
  );
}
