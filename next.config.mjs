const prod = process.env.NODE_ENV === 'production';

// Pictures uploaded from the owner dashboard live in the public Supabase Storage bucket; allow that one host (and only it).
let supabaseOrigin = null;
try { supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null; } catch { /* invalid URL: ignored */ }

// Content-Security-Policy. Next.js injects small inline bootstrap scripts, so script-src needs 'unsafe-inline' unless you
// adopt per-request nonces (which forces every page to render dynamically and defeats caching). Everything else is locked down.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://analytics.tiktok.com https://*.tiktok.com${prod ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://analytics.tiktok.com https://*.tiktok.com${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
  "font-src 'self' data:",
  "connect-src 'self' https://analytics.tiktok.com https://*.tiktok.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(prod ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  ...(prod ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['three'],
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: supabaseOrigin
      ? [{ protocol: new URL(supabaseOrigin).protocol.replace(':', ''), hostname: new URL(supabaseOrigin).hostname, pathname: '/storage/v1/object/public/product-images/**' }]
      : [],
  },
  experimental: { optimizePackageImports: ['lucide-react', '@react-three/drei'] },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // /public assets are not content-hashed, so no `immutable`: a replaced file must be picked up (revalidates in the background)
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }] },
      { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
};

export default nextConfig;
