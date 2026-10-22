'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Product } from '@/lib/types';
import { SHIPPING } from '@/lib/config';
import { useCart } from '@/lib/cart-store';
import AddToCartButton from './AddToCartButton';
import { WhatsAppIcon } from '@/components/ui/icons';
import { waLink } from '@/lib/format';
import { SITE } from '@/lib/config';

export default function PurchasePanel({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const router = useRouter();
  const add = useCart((s) => s.add);

  const ask = waLink(SITE.whatsapp, `Assalam o Alaikum! I would like to order ${qty} × ${product.name}. Please confirm availability.`);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="text-sm text-smoke" id="qty-l">Quantity</span>
        <div role="group" aria-labelledby="qty-l" className="inline-flex items-center rounded-full border border-white/15">
          <button type="button" className="grid h-11 w-11 place-items-center" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus size={16} /></button>
          <span className="w-8 text-center tabular-nums" aria-live="polite">{qty}</span>
          <button type="button" className="grid h-11 w-11 place-items-center" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(SHIPPING.maxQtyPerItem, q + 1))}><Plus size={16} /></button>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <AddToCartButton product={product} quantity={qty} className="flex-1" />
        {product.in_stock && (
          <button type="button" className="btn btn-glass flex-1" onClick={() => { add(product, qty, false); router.push('/checkout'); }}>Buy now</button>
        )}
      </div>
      <a href={ask} target="_blank" rel="noopener noreferrer" className="btn btn-glass w-full"><WhatsAppIcon width={18} height={18} /> Ask or order on WhatsApp</a>
    </div>
  );
}
