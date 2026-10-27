'use client';
import { useEffect } from 'react';
import { useCart } from '@/lib/cart-store';
import type { ShippingSettings } from '@/lib/site-settings';
import { ShippingProvider } from './ShippingContext';
import SmoothScroll from './SmoothScroll';
import Cursor from './Cursor';

export default function Providers({ shipping, children }: { shipping?: ShippingSettings; children: React.ReactNode }) {
  useEffect(() => {
    void Promise.resolve(useCart.persist.rehydrate()).then(() => useCart.getState().setHydrated());
  }, []);
  return (
    <ShippingProvider initialSettings={shipping}>
      <SmoothScroll />
      <Cursor />
      {children}
    </ShippingProvider>
  );
}
