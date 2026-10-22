'use client';
import { useEffect } from 'react';
import { useCart } from '@/lib/cart-store';
import SmoothScroll from './SmoothScroll';
import Cursor from './Cursor';

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void Promise.resolve(useCart.persist.rehydrate()).then(() => useCart.getState().setHydrated());
  }, []);
  return (
    <>
      <SmoothScroll />
      <Cursor />
      {children}
    </>
  );
}
