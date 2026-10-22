'use client';
import { useState } from 'react';
import { Check, ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-store';
import type { Product } from '@/lib/types';

export default function AddToCartButton({ product, quantity = 1, className = '', label = 'Add to bag', openDrawer = true }: { product: Product; quantity?: number; className?: string; label?: string; openDrawer?: boolean }) {
  const add = useCart((s) => s.add);
  const [done, setDone] = useState(false);

  if (!product.in_stock) return <button className={`btn btn-glass ${className}`} disabled>Sold out</button>;
  return (
    <button
      type="button"
      className={`btn btn-gold ${className}`}
      onClick={() => {
        add(product, quantity, openDrawer);
        setDone(true);
        window.setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? <Check size={18} /> : <ShoppingBag size={18} />}
      <span aria-live="polite">{done ? 'Added' : label}</span>
    </button>
  );
}
