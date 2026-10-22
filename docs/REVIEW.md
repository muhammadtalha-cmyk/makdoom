# Production review

## 1. Animation / UX defects found and fixed
See `docs/PERFORMANCE.md` for the table of root causes. In short: a leaked WebGL context, a fake 600 ms "ready" timer, a racy environment map, a second full-scene reflector render, three competing animation loops with triple smoothing, live blur/blend layers over the canvas, fixed DPR/MSAA with no adaptation, and no recovery from context loss or shader failure.

## 2. Backend / security defects found and fixed
| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | Rate limiter was in-memory only (reset on every cold start, not shared between serverless instances) and could be flushed by key flooding | High | Durable limiter (Supabase `rl_hit()` or Upstash) + in-process burst guard that cannot be flooded (tested) |
| 2 | `X-Forwarded-For` first entry trusted: IP spoofing bypassed every limit | High | Nearest-trusted-proxy selection (`TRUSTED_PROXY_HOPS`), tested |
| 3 | Order + items inserted in two calls with a compensating delete | High | Single transaction `create_order()` |
| 4 | Double-click / retry created duplicate orders | High | Idempotency key (unique index); duplicate returns the same order and sends no second email |
| 5 | CSV export vulnerable to formula injection from customer-controlled fields | High | Cells starting `= + - @ \t \r` neutralised (tested) |
| 6 | No CSRF protection on form/admin POSTs | Medium | Origin / `Sec-Fetch-Site` checks (strict for admin) |
| 7 | Admin session: no revocation, secret fell back to the password, length-leaking compare, no cookie prefix | Medium | Signed random-sid session, mandatory 32+ char secret in prod (admin stays disabled otherwise), SHA-256 + `timingSafeEqual`, `__Host-` cookie, `ADMIN_SESSION_EPOCH` kill-switch, edge middleware gate |
| 8 | Login brute-force limited per IP only, in memory | Medium | Per-IP + global durable limits, jitter delay, audit trail |
| 9 | No CSP / HSTS / COOP / CORP; `X-Frame-Options: SAMEORIGIN` | Medium | Full header set in `next.config.mjs` |
| 10 | Unbounded request bodies; DB error messages could reach clients | Medium | Streaming byte cap; central `route()` wrapper returns generic errors + request id |
| 11 | Catalogue read with the service-role key; every request hit the DB; admin edits took up to 60 s to appear | Medium | Anon-key reads, `unstable_cache` + tag purge on admin edit; checkout always prices from an uncached read and refuses stale fallback data in production |
| 12 | Emails sent inside the request (latency, partial failure) | Low | `after()` sends them post-response; `owner_notified` set only on success; admin shows "email not sent" |
| 13 | Stale prices in the customer's localStorage cart | Low | `/api/catalog` reconciliation at checkout with a visible notice |
| 14 | Contact form silently lost messages when DB insert failed | Low | Error handled; 503 only when neither DB nor email can work |
| 15 | Admin: 300 orders, no search/pagination/detail; messages & subscribers collected but never viewable | Feature gap | Server-side search + filter + pagination, order detail, product copy editing, inbox, subscribers, activity log, stats, CSV exports |

## 3. Verification status: be precise
Verified **in this review environment** (no network, so dependencies could not be installed):
- 11 unit tests pass: session tokens (tamper/expiry/revocation), CSV injection, rate limiter (incl. flood resistance), client-IP spoofing, CSRF, body cap, choreography continuity (no pops across the whole scroll, phone and desktop), layout-swap-under-fog, governor stability.
- All 13 custom GLSL programs compile and link on a real WebGL2 context; floor and post-effect shaders were rendered and inspected.
- Whole `src/` parses with `tsc`; no syntax errors and no unknown-symbol/arity errors (remaining diagnostics were solely from missing `@types/*` packages).

**Not verified here, so you must run them:** `npm install && npm run typecheck && npm run build`, and look at the hero on a real GPU and a real phone (`?perf`). Three.js shader *patches* into `MeshPhysicalMaterial` are applied atomically and fall back safely, and any shader error triggers safe mode, but I could not execute them against three.js itself. The Supabase SQL has not been run against a live database. Run `schema.sql` in a staging project first.

## 4. Still recommended before launch
- Replace placeholder social URLs; confirm shipping rules.
- Verify a sending domain in Resend (customer receipts).
- Upload real HDRI/photo assets if you want photographic studio reflections (the studio environment is procedural).
- Add uptime monitoring on `/api/health` and error tracking (Sentry) if you expect volume.
