# Hero architecture & performance budgets

## Load sequence (v2: the page never waits for the 3D)
| Step | What happens | Budget |
|---|---|---|
| 0 | Server HTML: branded CSS loader + complete hero (headline, buttons) | instant, no JS needed |
| 1 | JS hydrates → capability probe → the 3D chunk starts downloading immediately (`loadScene`) | |
| 2 | Loader leaves when hydrated + fonts settled (min 1.1 s, hard cap 3.5 s). **It no longer waits for WebGL.** | ≈ 1–1.5 s on a normal connection |
| 3 | Scene mounts right after first paint. Order: first bottle's label painted → **every** program compiled (including hidden effects) → driver starts rendering → 4 warm-up frames → poster fades out → intro plays | no frame is rendered before the shaders exist |
| 4 | Runtime: governor lowers render *resolution* first (free), only then the tier | |

Fallbacks: `Save-Data` / 2G → static hero straight away. A *hard* failure (context lost 3×, shader error in safe mode) → static hero, remembered for 30 min. A slow load is **never** remembered; a 30 s watchdog shows the static hero for that visit only. Use `?perf` for fps/tier, `?tier=0..3` to force a tier, and DevTools → Performance → Timings (`mk-*` marks) to see each step.

## What was slowing the old build (found in this pass)
| Symptom | Cause | Fix |
|---|---|---|
| 5–10 s before anything is usable | The site loader was gated on the 3D finishing its shader compile | Loader decoupled; the 3D fades in when ready |
| Animation randomly "skipped" on reload | Any watchdog timeout set a **session-wide** flag that forced the static hero for every later reload; a reload mid-scroll also skipped the intro | No flag for slow loads; hard-failure flag expires after 30 min; reload restarts at the top |
| Page froze while scrolling into Zest/Flova/the dissolve | Hidden effects (particle morph, citrus, petals, flare) compiled on first use | All programs pre-warmed before the first frame |
| Frames rendered during compile | The render loop was attached before shaders were compiled | Loop attached only after compile |
| Compile ran twice | Scene setup effect re-ran whenever the hero re-rendered (new array each render) | Stable props + one-shot guard |
| Stutter when the governor dropped a tier | Every tier had its own shader cache key, so a tier change recompiled everything | Tier-independent keys; resolution is lowered before tier |
| Ultra tier on integrated GPUs | Any desktop with ≥8 GB RAM started on tier 3 | GPU-aware start tier (integrated → medium, dGPU → ultra, 4K buffers capped) |
| Heavy first paint on slow links | 212 KB + 82 KB raw logo PNGs, 3 fonts fetched for every label, below-the-fold images marked `priority` | 57 KB / 19 KB WebP logos, one font per label, priority only for visible images |

## Why the old hero was flaky (root causes, all fixed)

| Symptom | Cause | Fix |
|---|---|---|
| 3D sometimes missing | Support check created a WebGL context and never released it; no context-loss handling | `probeWebGL()` releases its context; `webglcontextlost` rebuilds the canvas (2 retries, then static hero) |
| Animations vanish / reappear | "ready" was a 600 ms timer; env map captured on frame 1 (`frames={1}`) | Ready = labels painted + `compileAsync` of every material + 4 rendered frames. Env map is baked synchronously (`StudioEnv`) |
| Shade changes between loads | Race between env capture, `MeshReflectorMaterial` (2nd scene render) and transmissive glass | Deterministic PMREM studio; reflector replaced by an analytic floor shader (no render targets) |
| Not smooth / laggy | Lenis lerp + `damp()` + R3F = triple smoothing, 3 independent rAF loops | One ticker. Lenis → `HeroDriver` → DOM → `advance()` in a fixed order. No second smoother when Lenis is active |
| Phone jank | `backdrop-filter` over a live canvas, full-screen `mix-blend-mode` grain, DPR 2 + 4× MSAA, Lenis on touch, URL-bar resize moving progress | Opaque `.surface`, grain only inside the post pass, DPR/MSAA by tier, native touch scroll, `svh` probe for stable scroll range |
| Black screen on weak GPUs | Nothing detected slow or failing GPUs | Runtime `Governor` (tiers 3→0), shader-error self-heal (safe mode), 12 s watchdog → static hero |

## Frame order (one `requestAnimationFrame`, `src/lib/ticker.ts`)
`Lenis (-10)` → `HeroDriver.tick (10)`: read `scrollY` → progress/velocity → DOM overlay → `advance(time)` (R3F runs with `frameloop="never"`) → governor.
Choreography (`src/lib/3d/choreo.ts`) is a **pure function** of scroll → camera, dissolve, fog, particles; it is unit-tested for continuity (no pops).

## Budgets (`src/lib/3d/quality.ts`)
| Tier | Target | DPR | Post | Glass | Particles (dissolve / dust) | Extras |
|---|---|---|---|---|---|---|
| 3 ultra | desktop dGPU | ≤2 | MSAA 4, bloom, cinema | refractive + dispersion + scratches + condensation | 9000 / 260 | 3 beams, 7 mist, liquid-metal orb, flares |
| 2 high | laptop / strong phone | ≤1.6 | MSAA 2 | same | 5500 / 160 | 2 beams, 4 mist, orb |
| 1 medium | typical phone | ≤1.35 | bloom + cinema | refractive, no dispersion | 2800 / 90 | 1 beam, 2 mist |
| 0 lite | software GL / very weak | 1 | none (renderer tone-mapping) | fake glass | – / 40 | – |

Governor: >26 ms average for 1.4 s → drop a tier; <17.5 ms for 6 s → climb once (never after 2 drops). Add `?perf` to the URL to see fps/tier/progress.

Hard rules: no `backdrop-filter` or `mix-blend-mode` over the canvas; no per-frame allocations in `useFrame`; one draw call per particle system; every custom shader must pass `npm run test:shaders`.

## Chapter / camera script
`0–0.10` bottle condenses from particles · chapters Cyrus, Nova, Mira, Zest, Flova (each hand-over dissolves into particles; values are computed in `hero-state.ts` from `CHAPTER_SLUGS`, 0.16 apart, so every beat keeps its original scroll length) · the camera flies **through the last bottle's glass** into the perfume · the haze clears, all five bottles condense in a line-up (layout swap is hidden under 100 % fog, verified by test) · `0.925–1` finale copy.
