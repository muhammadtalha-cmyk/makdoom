'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SHIPPING, shippingFor } from './config';
import type { Product } from './types';

export interface CartItem {
  slug: string;
  name: string;
  price: number;
  compareAt: number | null;
  image: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  open: boolean;
  hydrated: boolean;
  add: (p: Product, qty?: number, openDrawer?: boolean) => void;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
  setOpen: (v: boolean) => void;
  setHydrated: () => void;
  /** Syncs prices/availability with the live catalogue (localStorage can hold prices from days ago). Returns human-readable changes. */
  reconcile: (catalog: { slug: string; price: number; compare_at_price: number | null; in_stock: boolean }[]) => string[];
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      open: false,
      hydrated: false,
      add: (p, qty = 1, openDrawer = true) =>
        set((s) => {
          const existing = s.items.find((i) => i.slug === p.slug);
          const items = existing
            ? s.items.map((i) => (i.slug === p.slug ? { ...i, quantity: Math.min(SHIPPING.maxQtyPerItem, i.quantity + qty) } : i))
            : [...s.items, { slug: p.slug, name: p.name, price: p.price, compareAt: p.compare_at_price, image: p.image, quantity: Math.min(SHIPPING.maxQtyPerItem, qty) }];
          return { items, open: openDrawer ? true : s.open };
        }),
      setQty: (slug, qty) =>
        set((s) => ({
          items: qty <= 0 ? s.items.filter((i) => i.slug !== slug) : s.items.map((i) => (i.slug === slug ? { ...i, quantity: Math.min(SHIPPING.maxQtyPerItem, qty) } : i)),
        })),
      remove: (slug) => set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      clear: () => set({ items: [] }),
      setOpen: (open) => set({ open }),
      setHydrated: () => set({ hydrated: true }),
      reconcile: (catalog) => {
        const notes: string[] = [];
        const next: CartItem[] = [];
        for (const i of get().items) {
          const c = catalog.find((x) => x.slug === i.slug);
          if (!c || !c.in_stock) { notes.push(`${i.name} is no longer available and was removed from your bag.`); continue; }
          if (c.price !== i.price) notes.push(`${i.name} price updated to Rs. ${c.price.toLocaleString('en-PK')}.`);
          next.push({ ...i, price: c.price, compareAt: c.compare_at_price });
        }
        if (notes.length) set({ items: next });
        return notes;
      },
    }),
    {
      name: 'mk-cart-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
      skipHydration: true,
    },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((n, i) => n + i.price * i.quantity, 0);
export const cartShipping = (items: CartItem[]) => shippingFor(cartSubtotal(items));
