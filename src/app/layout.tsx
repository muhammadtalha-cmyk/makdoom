import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource-variable/montserrat/wght.css';
import './globals.css';
import { SITE } from '@/lib/config';
import Providers from '@/components/layout/Providers';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/layout/CartDrawer';
import WhatsAppFab from '@/components/layout/WhatsAppFab';
import SiteLoader from '@/components/layout/SiteLoader';
import { getSiteSettings } from '@/lib/site-settings';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: 'Makhdoom Fragrances — Premium Perfumes for Men & Women', template: '%s · Makhdoom Fragrances' },
  description: SITE.description,
  keywords: ['perfume Pakistan', 'Makhdoom Fragrances', 'Eau de Parfum', 'long lasting perfume', 'cash on delivery perfume', 'Cyrus', 'Nova', 'Mira', 'Zest', 'Flova'],
  openGraph: { type: 'website', siteName: SITE.name, title: 'Makhdoom Fragrances — Premium Perfumes for Men & Women', description: SITE.description, url: SITE.url, images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'Makhdoom Fragrances' }], locale: 'en_PK' },
  twitter: { card: 'summary_large_image', title: 'Makhdoom Fragrances', description: SITE.description, images: ['/og.jpg'] },
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
  manifest: '/manifest.webmanifest',
  alternates: { canonical: '/' },
};

export const viewport: Viewport = { themeColor: '#050505', width: 'device-width', initialScale: 1 };

const orgJsonLd = (sameAs: string[]) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE.name,
  url: SITE.url,
  logo: `${SITE.url}/images/brand/logo-original.jpg`,
  email: SITE.email,
  sameAs,
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { socials } = await getSiteSettings();
  return (
    <html lang="en-PK" className="mk-boot">
      <body>
        <Script
          id="tiktok-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

  ttq.load('DBFLCRBC77UASCMGLNHG');
  ttq.page();
}(window, document, 'ttq');`,
          }}
        />
        <noscript><style>{'html.mk-boot .hero-rise{animation:rise 1s both;opacity:1}.mk-loader{display:none!important}'}</style></noscript>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd(socials.map((s) => s.url))) }} />
        <SiteLoader />
        <Providers>
          <a href="#main" className="sr-only z-[100] rounded-full bg-gold-300 px-4 py-2 font-semibold text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <CartDrawer />
          <WhatsAppFab />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
