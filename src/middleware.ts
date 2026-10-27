import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/admin-token';

/**
 * MAINTENANCE MODE TOGGLE
 * Set to true right now to temporarily pause the website safely for SEO.
 * Search engine bots (Googlebot) receive HTTP 503 Service Unavailable with a Retry-After header,
 * which instructs them to keep all rankings and indexed pages intact and return later.
 *
 * HOW TO RESUME IN 1-2 DAYS:
 * Option 1: In Vercel -> Project Settings -> Environment Variables, add MAINTENANCE_MODE=false and redeploy.
 * Option 2: Change isMaintenance to false here and push.
 */
const isMaintenance = process.env.MAINTENANCE_MODE !== 'false';

const maintenanceHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scheduled Maintenance · Makhdoom Fragrances</title>
  <meta name="robots" content="noindex, nofollow" />
  <link rel="icon" href="/favicon.png" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #070605;
      background-image: radial-gradient(circle at 50% 20%, rgba(203, 163, 88, 0.14), transparent 60%), radial-gradient(circle at 80% 80%, rgba(203, 163, 88, 0.05), transparent 50%);
      color: #faf6ee;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }
    .card {
      max-width: 580px;
      width: 100%;
      background: rgba(26, 23, 20, 0.7);
      border: 1px solid rgba(203, 163, 88, 0.25);
      border-radius: 28px;
      padding: 48px 32px;
      box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    .logo {
      width: 170px;
      height: auto;
      margin: 0 auto 28px;
      display: block;
    }
    .badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 9999px;
      background: rgba(203, 163, 88, 0.12);
      border: 1px solid rgba(203, 163, 88, 0.3);
      color: #e2bc5f;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    h1 {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 38px;
      font-weight: 500;
      line-height: 1.1;
      color: #faf6ee;
      margin-bottom: 14px;
      letter-spacing: -0.02em;
    }
    p {
      color: rgba(250, 246, 238, 0.75);
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(203, 163, 88, 0.4), transparent);
      margin: 28px 0;
    }
    .wa-box {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      padding: 20px;
    }
    .wa-box p {
      font-size: 13px;
      color: rgba(250, 246, 238, 0.7);
      margin-bottom: 14px;
    }
    .btn-wa {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: linear-gradient(135deg, #e2bc5f, #cba358);
      color: #070605;
      font-weight: 700;
      font-size: 14px;
      padding: 13px 26px;
      border-radius: 9999px;
      text-decoration: none;
      transition: transform 0.2s, opacity 0.2s;
    }
    .btn-wa:hover {
      transform: translateY(-1px);
      opacity: 0.95;
    }
    .footer {
      margin-top: 32px;
      font-size: 12px;
      color: rgba(250, 246, 238, 0.4);
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="/images/brand/logo-lockup.png" alt="Makhdoom Fragrances" class="logo" />
    <span class="badge">Scheduled System Updates</span>
    <h1>We’ll be right back</h1>
    <p>Our online store is temporarily pausing for scheduled updates and inventory preparation. We expect to be fully back online shortly.</p>
    
    <div class="divider"></div>

    <div class="wa-box">
      <p>Need to place an order or inquire about our fragrances? Our team is active on WhatsApp:</p>
      <a href="https://wa.me/923488317780?text=Assalam%20o%20Alaikum!%20I%20would%20like%20to%20inquire%20about%20an%20order." class="btn-wa" target="_blank" rel="noopener noreferrer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z"/>
        </svg>
        Order on WhatsApp (+92 348 8317780)
      </a>
    </div>

    <div class="footer">
      © 2026 Makhdoom Fragrances. All rights reserved.
    </div>
  </div>
</body>
</html>`;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Always pass through static assets, images, robots.txt, sitemap, and Google Search Console verification
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname === '/favicon.ico' ||
    pathname === '/favicon.png' ||
    pathname === '/apple-touch-icon.png' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.startsWith('/google') ||
    pathname === '/api/health'
  ) {
    return NextResponse.next();
  }

  // 2. Check admin authentication
  const prod = process.env.NODE_ENV === 'production';
  const cookie = req.cookies.get(prod ? '__Host-mk_admin' : 'mk_admin')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET || (prod ? '' : 'dev-only-secret-' + (process.env.ADMIN_PASSWORD ?? ''));
  const isAdmin = await verifySession(secret, cookie, process.env.ADMIN_SESSION_EPOCH || '1');

  // 3. Admin routes handling
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (pathname !== '/admin/login' && !isAdmin) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // 4. If logged-in as admin or maintenance mode is OFF, allow normal browsing
  if (isAdmin || !isMaintenance) {
    return NextResponse.next();
  }

  // 5. Public visitors & Search Engines: Return HTTP 503 Service Unavailable with Retry-After header
  return new NextResponse(maintenanceHtml, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': '86400', // Tells Googlebot to wait 24 hours before re-checking, preventing de-indexing
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except files with extensions.
     */
    '/((?!.*\\.[\\w]+$).*)',
  ],
};
