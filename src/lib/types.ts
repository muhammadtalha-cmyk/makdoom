export type Gender = 'men' | 'women' | 'unisex' | 'couple';

export interface Product {
  id: string;
  slug: string;
  name: string;
  inspired_by: string | null;
  gender: Gender;
  price: number;
  compare_at_price: number | null;
  tagline: string;
  short_description: string;
  description: string;
  scent_family: string[];
  accent: string;
  is_bundle: boolean;
  bundle_slugs: string[];
  image: string;
  /** Second catalogue picture, revealed when a shopper hovers the card. Falls back to the first gallery photo. */
  hover_image?: string | null;
  gallery: string[];
  in_stock: boolean;
  featured: boolean;
  sort_order: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled';

export interface OrderLine {
  slug: string;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface OrderSummary {
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  customer: { name: string; phone: string; email: string | null; city: string; address: string; notes: string | null };
  lines: OrderLine[];
  subtotal: number;
  shipping: number;
  total: number;
  demo?: boolean;
}
