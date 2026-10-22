# Makhdoom Fragrances

Next.js 15 · React 19 · Three.js (React Three Fiber) · Supabase · Resend. Cash-on-delivery storefront with an interactive 3D hero and an owner dashboard.

## Deploy in 10 minutes (you only supply credentials)

1. **Supabase** → create a project → SQL Editor → run `supabase/schema.sql`, then `supabase/seed.sql`. (Re-running `schema.sql` is always safe; it is also the upgrade path.)
2. **Vercel** → import this repo → add the environment variables below → Deploy.
3. Open `/admin/login`. If anything is misconfigured the page tells you exactly what.

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | yes | the live URL (canonical links, sitemap, Open Graph) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase → Project Settings → API. The service key is server-only |
| `ADMIN_PASSWORD` | yes | 12+ characters |
| `ADMIN_SESSION_SECRET` | yes | 32+ random chars: `openssl rand -hex 32` |
| `RESEND_API_KEY`, `ORDER_NOTIFY_EMAIL`, `RESEND_FROM` | recommended | new-order emails. Orders are saved and visible in `/admin` even without it |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_EMAIL`, social URLs, shipping rules | optional | see `.env.example` |

At boot the server logs a readiness report (`startup` / `config` lines) listing anything missing. Production never crashes on missing config; it **fails closed** (admin disabled, ordering returns a friendly "use WhatsApp" message).

## Local development
```bash
cp .env.example .env.local   # without Supabase the site runs on bundled data and checkout creates DEMO orders
npm install
npm run dev                  # add ?perf to the URL to see fps / quality tier
```
Quality gates: `npm run typecheck` · `npm test` (backend security + choreography + governor) · `npm run test:shaders` (compiles every GLSL program in headless Chromium: `pip install playwright && playwright install chromium`) · `npm run build`.

## What is where
- `src/components/hero/` and `src/lib/3d/`: the 3D hero. See `docs/PERFORMANCE.md` (architecture, budgets, why it used to be flaky).
- `src/lib/`: server logic. `security.ts` (CSRF, body caps, IP), `rate-limit.ts`, `admin-token.ts`/`admin-auth.ts`, `orders.ts`, `catalog.ts`.
- `src/app/api/`: public routes (`orders`, `track`, `contact`, `subscribe`, `catalog`, `health`) and `admin/*`.
- `supabase/schema.sql`: tables, RLS, atomic `create_order()`, `rl_hit()` rate limiter, audit log.
- `docs/REVIEW.md`: the production review: what was wrong, what changed, what to verify.

## Adding a fragrance to the 3D hero
`src/components/hero/chapters.ts` (`CHAPTER_SLUGS`, in hero order) is the single source of truth: the scroll timeline, floor reflections, particle morph, line-up and shader array sizes all derive from it. A new entry also needs a colour theme in `hero/themes.ts`, a product row (`lib/products-data.ts` + `supabase/seed.sql`), a taller `.hero-wrap` in `globals.css` (+0.16 of the scroll range per chapter) and, optionally, a label style in `hero/textures.ts`.

**Existing database?** Re-run `supabase/seed.sql` once after deploying (it upserts by slug) so Mira exists in the live catalogue, can be ordered, and the sort order is updated.

## Operating notes
- **Catalogue (no developer needed)**: `/admin → Products`. Add, edit and delete perfumes; change price, old price, text, scent notes, stock, featured, order; upload / replace / delete the catalogue picture, the hover picture and any number of gallery pictures. The storefront cache is purged instantly. The 3D bottles themselves are not editable; Cyrus, Nova, Mira, Zest, Flova (3D hero) and the Couple Deal (menu link) can be edited but not deleted, only marked sold out.
- **Hover effect**: each card shows the catalogue (box) picture and reveals the hover picture with an expanding animation. If no hover picture is set, the first gallery picture is used.
- **Picture storage**: uploads go to a public Supabase Storage bucket `product-images` (created by `schema.sql`, or automatically on the first upload). Photos are shrunk in the browser to max 1600px WebP before upload.
- **Upgrading an existing install**: re-run `supabase/schema.sql` once (adds the `hover_image` column and the bucket).
- **Loading screen**: a branded loader (`components/layout/SiteLoader.tsx`) shows for about a second and leaves as soon as the page is usable. It does not wait for the 3D hero, which fades in by itself when its shaders are ready (see `docs/PERFORMANCE.md`).
- **Sign everyone out**: change `ADMIN_SESSION_EPOCH` and redeploy.
- **Health check**: `GET /api/health` (liveness). With `HEALTH_TOKEN` set, send header `x-health-token` for DB/email status.
- **Behind another proxy** (not Vercel): set `TRUSTED_PROXY_HOPS` to the number of proxies that append to `X-Forwarded-For`.
