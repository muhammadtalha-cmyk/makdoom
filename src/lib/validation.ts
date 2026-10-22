import { z } from 'zod';
import { normalizePkPhone } from './format';
import { SHIPPING } from './config';
import { isAllowedImageUrl } from './product-images';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export const orderSchema = z.object({
  name: z.string().transform(clean).pipe(z.string().min(2, 'Enter your full name').max(80)),
  phone: z
    .string()
    .transform((v) => normalizePkPhone(v) ?? '')
    .pipe(z.string().regex(/^03\d{9}$/, 'Enter a valid mobile number, e.g. 0300 1234567')),
  email: z
    .string()
    .transform(clean)
    .pipe(z.union([z.literal(''), z.string().email('Enter a valid email or leave it empty').max(120)]))
    .optional()
    .transform((v) => (v ? v : null)),
  city: z.string().transform(clean).pipe(z.string().min(2, 'Enter your city').max(60)),
  address: z.string().transform(clean).pipe(z.string().min(10, 'Enter your full delivery address').max(300)),
  notes: z
    .string()
    .transform(clean)
    .pipe(z.string().max(300))
    .optional()
    .transform((v) => (v ? v : null)),
  items: z
    .array(z.object({ slug: z.string().min(1).max(60), quantity: z.number().int().min(1).max(SHIPPING.maxQtyPerItem, `Maximum ${SHIPPING.maxQtyPerItem} per item`) }))
    .min(1, 'Your bag is empty')
    .max(20),
  idempotencyKey: z.string().uuid().optional(), // generated per checkout attempt; a retried/double-clicked submit never creates a second order
  website: z.string().optional(), // honeypot
});

export const trackSchema = z.object({
  orderNumber: z.string().transform((v) => v.trim().toUpperCase()).pipe(z.string().regex(/^MF-[A-Z0-9]{6}$/, 'Order numbers look like MF-AB12CD')),
  phone: z
    .string()
    .transform((v) => normalizePkPhone(v) ?? '')
    .pipe(z.string().regex(/^03\d{9}$/, 'Enter the mobile number used for the order')),
});

export const contactSchema = z.object({
  name: z.string().transform(clean).pipe(z.string().min(2).max(80)),
  email: z.string().transform(clean).pipe(z.string().email().max(120)),
  phone: z.string().transform(clean).pipe(z.string().max(30)).optional(),
  message: z.string().transform(clean).pipe(z.string().min(5, 'Write a short message').max(1500)),
  website: z.string().optional(),
});

export const subscribeSchema = z.object({
  email: z.string().transform(clean).pipe(z.string().email('Enter a valid email').max(120)),
  website: z.string().optional(),
});

const uuid = z.string().uuid();
export const orderStatusSchema = z.enum(['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled']);
export const adminOrderPatch = z.object({ id: uuid, status: orderStatusSchema });
const imageUrl = z.string().trim().refine(isAllowedImageUrl, 'Please use the image uploader: only pictures uploaded from the dashboard are allowed.');
const slug = z.string().trim().toLowerCase().min(2, 'The web address needs at least 2 characters').max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Web address: lowercase letters, numbers and single dashes only (e.g. royal-oud)');
const emptyToNull = (v: string) => (v === '' ? null : v);
const productFields = {
  name: z.string().trim().min(1, 'Enter a name').max(80),
  inspired_by: z.string().trim().max(80).transform(emptyToNull).nullable(),
  gender: z.enum(['men', 'women', 'unisex', 'couple']),
  tagline: z.string().trim().max(160),
  short_description: z.string().trim().max(400),
  description: z.string().trim().max(4000),
  price: z.number().int('Price must be a whole number').min(1).max(1_000_000),
  compare_at_price: z.number().int().min(1).max(1_000_000).nullable(),
  scent_family: z.array(z.string().trim().min(1).max(30)).max(8, 'At most 8 scent notes'),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid colour'),
  is_bundle: z.boolean(),
  bundle_slugs: z.array(slug).max(6),
  image: imageUrl,
  hover_image: imageUrl.nullable(),
  gallery: z.array(imageUrl).max(12, 'At most 12 gallery pictures'),
  in_stock: z.boolean(),
  featured: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
};
export const adminProductCreate = z.object({
  slug,
  name: productFields.name,
  gender: productFields.gender,
  price: productFields.price,
  image: productFields.image,
  inspired_by: productFields.inspired_by.optional(),
  tagline: productFields.tagline.optional(),
  short_description: productFields.short_description.optional(),
  description: productFields.description.optional(),
  compare_at_price: productFields.compare_at_price.optional(),
  scent_family: productFields.scent_family.optional(),
  accent: productFields.accent.optional(),
  is_bundle: productFields.is_bundle.optional(),
  bundle_slugs: productFields.bundle_slugs.optional(),
  hover_image: productFields.hover_image.optional(),
  gallery: productFields.gallery.optional(),
  in_stock: productFields.in_stock.optional(),
  featured: productFields.featured.optional(),
  sort_order: productFields.sort_order.optional(),
});
/** The web address (slug) is deliberately not editable: carts, orders and shared links refer to it. */
export const adminProductPatch = z.object({
  id: uuid,
  name: productFields.name.optional(),
  inspired_by: productFields.inspired_by.optional(),
  gender: productFields.gender.optional(),
  tagline: productFields.tagline.optional(),
  short_description: productFields.short_description.optional(),
  description: productFields.description.optional(),
  price: productFields.price.optional(),
  compare_at_price: productFields.compare_at_price.optional(),
  scent_family: productFields.scent_family.optional(),
  accent: productFields.accent.optional(),
  is_bundle: productFields.is_bundle.optional(),
  bundle_slugs: productFields.bundle_slugs.optional(),
  image: productFields.image.optional(),
  hover_image: productFields.hover_image.optional(),
  gallery: productFields.gallery.optional(),
  in_stock: productFields.in_stock.optional(),
  featured: productFields.featured.optional(),
  sort_order: productFields.sort_order.optional(),
});
export const adminProductDelete = z.object({ id: uuid });
export const adminMessagePatch = z.object({ id: uuid, handled: z.boolean() });
export const adminOrdersQuery = z.object({
  status: orderStatusSchema.optional(),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
