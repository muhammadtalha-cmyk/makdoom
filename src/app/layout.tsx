import type { Metadata, Viewport } from 'next';
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
  verification: { google: 'google70675cb061893c1b' },
};

export const viewport: Viewport = { themeColor: '#050505', width: 'device-width', initialScale: 1 };

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE.name,
  url: SITE.url,
  logo: `${SITE.url}/images/brand/logo-original.jpg`,
  email: SITE.email,
  sameAs: Object.values(SITE.socials),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PK" className="mk-boot">
      <body>
        <noscript><style>{'html.mk-boot .hero-rise{animation:rise 1s both;opacity:1}.mk-loader{display:none!important}'}</style></noscript>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <SiteLoader />
        <Providers>
          <a href="#main" className="sr-only z-[100] rounded-full bg-gold-300 px-4 py-2 font-semibold text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <CartDrawer />
          <WhatsAppFab />
        </Providers>
      </body>
    </html>
  );
}
