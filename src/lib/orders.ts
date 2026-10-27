import { randomInt } from 'crypto';
import { getProductsFresh } from './catalog';
import { shippingFor } from './config';
import { getSiteSettings } from './site-settings';
import { getAdminClient } from './supabase';
import { isProd } from './env';
import { log } from './log';
import type { OrderLine, OrderStatus, OrderSummary } from './types';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeOrderNumber = () => 'MF-' + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export class OrderError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Re-prices the bag from the live catalogue. The browser's prices are never trusted. */
export async function priceItems(items: { slug: string; quantity: number }[]) {
  let catalogue;
  try { catalogue = await getProductsFresh(); } catch { throw new OrderError('We cannot confirm prices right now. Please try again in a minute or order on WhatsApp.', 503); }
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.slug, (merged.get(i.slug) ?? 0) + i.quantity);

  const lines: OrderLine[] = [];
  for (const [slug, quantity] of merged) {
    const p = catalogue.find((c) => c.slug === slug);
    if (!p) throw new OrderError(`"${slug}" is no longer available. Please refresh your bag.`);
    if (!p.in_stock) throw new OrderError(`${p.name} is currently out of stock.`);
    lines.push({ slug: p.slug, name: p.is_bundle ? `${p.name} (${p.bundle_slugs.map((s) => s.toUpperCase()).join(' + ')})` : p.name, unit_price: p.price, quantity, line_total: p.price * quantity });
  }
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const site = await getSiteSettings();
  const shipping = shippingFor(subtotal, site.shipping);
  return { lines, subtotal, shipping, total: subtotal + shipping };
}

export interface NewOrderInput {
  name: string; phone: string; email: string | null; city: string; address: string; notes: string | null;
  items: { slug: string; quantity: number }[];
  idempotencyKey?: string;
}

interface OrderRow { id: string; order_number: string; status: OrderStatus; customer_name: string; phone: string; email: string | null; city: string; address: string; notes: string | null; subtotal: number; shipping_fee: number; total: number; created_at: string }

async function loadByKey(key: string): Promise<(OrderSummary & { id: string }) | null> {
  const db = getAdminClient();
  if (!db) return null;
  const { data: o } = await db.from('orders').select('*').eq('idempotency_key', key).maybeSingle<OrderRow>();
  if (!o) return null;
  const { data: items } = await db.from('order_items').select('product_slug, product_name, unit_price, quantity, line_total').eq('order_id', o.id);
  return {
    id: o.id, orderNumber: o.order_number, createdAt: o.created_at, status: o.status,
    customer: { name: o.customer_name, phone: o.phone, email: o.email, city: o.city, address: o.address, notes: o.notes },
    lines: (items ?? []).map((i) => ({ slug: i.product_slug, name: i.product_name, unit_price: i.unit_price, quantity: i.quantity, line_total: i.line_total })),
    subtotal: o.subtotal, shipping: o.shipping_fee, total: o.total,
  };
}

/**
 * Creates the order atomically (order + items in ONE database transaction via the create_order() SQL function, so a failure
 * can never leave an order without items or the reverse) and idempotently (the same idempotencyKey always returns the same order).
 * `created` is false when an existing order was returned, so the caller must not send the emails a second time.
 */
export async function createOrder(input: NewOrderInput): Promise<{ order: OrderSummary; created: boolean; id?: string }> {
  const db = getAdminClient();
  if (input.idempotencyKey) {
    const existing = await loadByKey(input.idempotencyKey);
    if (existing) return { order: existing, created: false, id: existing.id };
  }
  const priced = await priceItems(input.items);
  const base = {
    createdAt: new Date().toISOString(), status: 'pending' as const,
    customer: { name: input.name, phone: input.phone, email: input.email, city: input.city, address: input.address, notes: input.notes },
    ...priced,
  };

  if (!db) {
    if (isProd()) throw new OrderError('Ordering is temporarily unavailable. Please order on WhatsApp.', 503);
    log.warn('orders: Supabase not configured, DEMO order (not saved)');
    return { order: { orderNumber: makeOrderNumber(), demo: true, ...base }, created: true };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const orderNumber = makeOrderNumber();
    const { data, error } = await db.rpc('create_order', {
      p_order: {
        order_number: orderNumber, customer_name: input.name, phone: input.phone, email: input.email, city: input.city, address: input.address, notes: input.notes,
        subtotal: priced.subtotal, shipping_fee: priced.shipping, total: priced.total, idempotency_key: input.idempotencyKey ?? '',
      },
      p_items: priced.lines,
    });
    if (error) {
      if (error.code === '23505') {
        if (error.message.includes('idempotency')) { // a concurrent duplicate won the race: return its order
          const again = input.idempotencyKey ? await loadByKey(input.idempotencyKey) : null;
          if (again) return { order: again, created: false, id: again.id };
        }
        continue; // order-number collision: try another number
      }
      log.error('orders: create_order failed', { code: error.code, msg: error.message });
      throw new OrderError('We could not save your order. Please try again or order on WhatsApp.', 500);
    }
    const row = data as { id: string; created_at: string };
    return { order: { orderNumber, ...base, createdAt: row.created_at }, created: true, id: row.id };
  }
  throw new OrderError('We could not save your order. Please try again.', 500);
}
