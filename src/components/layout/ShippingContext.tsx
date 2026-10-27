'use client';
import { createContext, useContext, useMemo } from 'react';
import type { ShippingSettings } from '@/lib/site-settings';
import { DEFAULT_SHIPPING } from '@/lib/site-settings';
import { formatPKR } from '@/lib/format';

export interface ShippingContextValue extends ShippingSettings {
  shippingFor: (subtotal: number) => number;
  bannerText: string;
}

const ShippingContext = createContext<ShippingContextValue>({
  ...DEFAULT_SHIPPING,
  shippingFor: (subtotal: number) => (subtotal >= DEFAULT_SHIPPING.freeOver ? 0 : DEFAULT_SHIPPING.fee),
  bannerText: `Cash on delivery across Pakistan · Free delivery over ${formatPKR(DEFAULT_SHIPPING.freeOver)}`,
});

export function ShippingProvider({
  initialSettings,
  children,
}: {
  initialSettings?: ShippingSettings;
  children: React.ReactNode;
}) {
  const s = initialSettings ?? DEFAULT_SHIPPING;

  const value = useMemo<ShippingContextValue>(() => {
    const calc = (subtotal: number) => {
      if (subtotal <= 0) return 0;
      if (s.alwaysFree || s.fee === 0) return 0;
      if (s.freeOver > 0 && subtotal >= s.freeOver) return 0;
      return s.fee;
    };

    let banner = s.banner?.trim();
    if (!banner) {
      if (s.alwaysFree || s.fee === 0) {
        banner = 'Cash on delivery across Pakistan · Free delivery on all orders';
      } else if (s.freeOver > 0) {
        banner = `Cash on delivery across Pakistan · Free delivery over ${formatPKR(s.freeOver)}`;
      } else {
        banner = `Cash on delivery across Pakistan · Delivery ${formatPKR(s.fee)}`;
      }
    }

    return {
      ...s,
      shippingFor: calc,
      bannerText: banner,
    };
  }, [s]);

  return <ShippingContext.Provider value={value}>{children}</ShippingContext.Provider>;
}

export function useShipping() {
  return useContext(ShippingContext);
}
