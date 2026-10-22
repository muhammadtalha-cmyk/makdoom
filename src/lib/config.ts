const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) ? n : fallback;
};

export const SITE = {
  name: 'Makhdoom Fragrances',
  short: 'Makhdoom',
  tagline: 'Premium quality perfumes for men & women',
  description:
    'Makhdoom Fragrances — premium quality Eau de Parfum for men and women. Long-lasting scents at affordable prices. Cash on delivery, nationwide across Pakistan.',
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  whatsapp: (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '923488317780').replace(/\D/g, ''),
  whatsappCatalog: 'https://wa.me/c/923488317780',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'makhdoomfragrances@gmail.com',
  // PLACEHOLDERS — replace with the brand's real profile URLs (env vars) before launch.
  socials: {
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? 'https://www.instagram.com/',
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL ?? 'https://www.facebook.com/',
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL ?? 'https://www.tiktok.com/',
  },
} as const;

// Delivery rules. Confirm with the brand owner. Server re-computes these, the browser only displays them.
export const SHIPPING = {
  fee: num(process.env.NEXT_PUBLIC_SHIPPING_FEE, 250),
  freeOver: num(process.env.NEXT_PUBLIC_FREE_SHIPPING_OVER, 4000),
  maxQtyPerItem: 10,
};

export const PK_CITIES = [
  'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Hyderabad',
  'Gujranwala', 'Sialkot', 'Sargodha', 'Bahawalpur', 'Sukkur', 'Larkana', 'Abbottabad', 'Mardan', 'Gujrat',
  'Sahiwal', 'Rahim Yar Khan', 'Sheikhupura', 'Jhelum', 'Mirpur AJK', 'Muzaffarabad',
];

export const NAV_LINKS = [
  { href: '/shop', label: 'Shop' },
  { href: '/product/couple-deal', label: 'Couple deal' },
  { href: '/track', label: 'Track order' },
  { href: '/contact', label: 'Contact' },
];

export function shippingFor(subtotal: number) {
  if (subtotal <= 0) return 0;
  return subtotal >= SHIPPING.freeOver ? 0 : SHIPPING.fee;
}
