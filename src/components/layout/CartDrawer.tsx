'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { SHIPPING } from '@/lib/config';
import { formatPKR, waLink } from '@/lib/format';
import { SITE } from '@/lib/config';
import { cartShipping, cartSubtotal, useCart } from '@/lib/cart-store';
import { WhatsAppIcon } from '@/components/ui/icons';

export default function CartDrawer() {
  const { items, open, setOpen, setQty, remove, hydrated } = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const list = hydrated ? items : [];
  const subtotal = cartSubtotal(list);
  const shipping = cartShipping(list);
  const remaining = Math.max(0, SHIPPING.freeOver - subtotal);
  const progress = Math.min(100, (subtotal / SHIPPING.freeOver) * 100);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // Navigating (including the browser Back/Forward buttons) must never leave the bag open on top of the new page.
  useEffect(() => { setOpen(false); }, [pathname, setOpen]);

  const waText = () => {
    const lines = list.map((i) => `• ${i.name} × ${i.quantity} — ${formatPKR(i.price * i.quantity)}`).join('\n');
    return `Assalam o Alaikum! I would like to order:\n${lines}\n\nSubtotal: ${formatPKR(subtotal)}`;
  };

  return (
    // z-[90]: the header is z-[80] and used to sit ON TOP of the drawer, swallowing every click on the close (X) button.
    <div className={`fixed inset-0 z-[90] ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open} inert={!open}>
      <div className={`absolute inset-0 bg-black/80 transition-opacity duration-500 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={() => setOpen(false)} />
      <aside role="dialog" aria-modal="true" aria-label="Shopping bag" data-lenis-prevent className={`surface absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col transition-transform duration-500 [transition-timing-function:var(--ease-out)] ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="font-display text-3xl font-medium">Your bag</h2>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Close bag">
            <X size={22} strokeWidth={1.6} />
          </button>
        </div>
        <div className="rule-gold" />

        {list.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
            <p className="font-display text-3xl">Your bag is empty</p>
            <p className="text-sm text-smoke">Pick a signature scent and pay in cash when it arrives.</p>
            <Link href="/shop" onClick={() => setOpen(false)} className="btn btn-gold">Shop fragrances</Link>
          </div>
        ) : (
          <>
            <div className="px-6 pt-4">
              <p className="mb-2 text-xs text-ivory/75">
                {remaining > 0 ? <>Add <strong className="text-gold-200">{formatPKR(remaining)}</strong> more for free delivery</> : <strong className="text-gold-200">You have free delivery</strong>}
              </p>
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-100 transition-[width] duration-700" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <ul className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {list.map((i) => (
                <li key={i.slug} className="flex gap-4">
                  <Link href={`/product/${i.slug}`} onClick={() => setOpen(false)} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10">
                    <Image src={i.image} alt={i.name} fill sizes="80px" className="object-cover" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-xl leading-tight">{i.name}</p>
                        <p className="text-sm text-gold-200">{formatPKR(i.price)}</p>
                      </div>
                      <button type="button" onClick={() => remove(i.slug)} className="grid h-9 w-9 place-items-center rounded-full text-smoke hover:bg-white/10 hover:text-white" aria-label={`Remove ${i.name}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="inline-flex w-fit items-center rounded-full border border-white/15">
                      <button type="button" onClick={() => setQty(i.slug, i.quantity - 1)} className="grid h-9 w-9 place-items-center" aria-label={`Decrease ${i.name}`}><Minus size={14} /></button>
                      <span className="w-7 text-center text-sm tabular-nums" aria-live="polite">{i.quantity}</span>
                      <button type="button" onClick={() => setQty(i.slug, i.quantity + 1)} className="grid h-9 w-9 place-items-center" aria-label={`Increase ${i.name}`}><Plus size={14} /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-3 border-t border-white/10 px-6 py-5">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-smoke">Subtotal</dt><dd>{formatPKR(subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-smoke">Delivery</dt><dd>{shipping === 0 ? 'Free' : formatPKR(shipping)}</dd></div>
                <div className="flex items-baseline justify-between pt-1"><dt className="font-display text-2xl">Total</dt><dd className="font-display text-2xl text-gold-200">{formatPKR(subtotal + shipping)}</dd></div>
              </dl>
              <p className="text-xs text-smoke">Payment: cash on delivery. No card needed.</p>
              <Link href="/checkout" onClick={() => setOpen(false)} className="btn btn-gold w-full">Checkout</Link>
              <a href={waLink(SITE.whatsapp, waText())} target="_blank" rel="noopener noreferrer" className="btn btn-glass w-full"><WhatsAppIcon width={18} height={18} /> Order on WhatsApp instead</a>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
