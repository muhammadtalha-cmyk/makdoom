import Image from 'next/image';
import Link from 'next/link';
import { SITE } from '@/lib/config';
import { supportWhatsAppUrl } from '@/lib/whatsapp';
import { WhatsAppIcon } from '@/components/ui/icons';
import { SOCIAL_ICONS } from '@/components/ui/social-icons';
import { getSiteSettings } from '@/lib/site-settings';
import Newsletter from './Newsletter';

export default async function Footer() {
  const { socials } = await getSiteSettings(); // links the owner manages in the dashboard (Social links tab)
  return (
    <footer className="relative mt-10 border-t border-white/10 bg-gradient-to-b from-transparent to-black/60">
      <div className="rule-gold" />
      <div className="container-x grid gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Image src="/images/brand/logo-lockup.png" alt="Makhdoom Fragrances — Eau de Parfum" width={220} height={155} className="h-auto w-40" />
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-smoke">Premium quality perfumes for men & women. Long-lasting scents at affordable prices, delivered across Pakistan.</p>
          <div className="mt-6 flex gap-3">
            {socials.map(({ key, url, label }) => {
              const Icon = SOCIAL_ICONS[key];
              return (
                <a key={key} href={url} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid h-11 w-11 place-items-center rounded-full border border-white/15 text-ivory/80 transition-all hover:border-gold-300 hover:text-gold-200">
                  <Icon width={20} height={20} />
                </a>
              );
            })}
            <a href={supportWhatsAppUrl()} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid h-11 w-11 place-items-center rounded-full border border-white/15 text-ivory/80 transition-all hover:border-gold-300 hover:text-gold-200">
              <WhatsAppIcon />
            </a>
          </div>
        </div>

        <nav aria-label="Shop" className="md:col-span-2">
          <h2 className="font-display text-2xl">Shop</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-smoke">
            <li><Link className="hover:text-gold-200" href="/shop">All fragrances</Link></li>
            <li><Link className="hover:text-gold-200" href="/shop?for=men">For him</Link></li>
            <li><Link className="hover:text-gold-200" href="/shop?for=women">For her</Link></li>
            <li><Link className="hover:text-gold-200" href="/product/couple-deal">Couple deal</Link></li>
            <li><a className="hover:text-gold-200" href={SITE.whatsappCatalog} target="_blank" rel="noopener noreferrer">WhatsApp catalogue</a></li>
          </ul>
        </nav>

        <nav aria-label="Help" className="md:col-span-2">
          <h2 className="font-display text-2xl">Help</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-smoke">
            <li><Link className="hover:text-gold-200" href="/track">Track your order</Link></li>
            <li><Link className="hover:text-gold-200" href="/contact">Contact us</Link></li>
            <li><Link className="hover:text-gold-200" href="/policies/shipping-and-cod">Shipping & COD</Link></li>
            <li><Link className="hover:text-gold-200" href="/policies/returns">Returns & exchange</Link></li>
            <li><Link className="hover:text-gold-200" href="/policies/privacy">Privacy</Link></li>
            <li><Link className="hover:text-gold-200" href="/policies/terms">Terms</Link></li>
          </ul>
        </nav>

        <div className="md:col-span-3">
          <h2 className="font-display text-2xl">Be first to know</h2>
          <p className="mt-4 text-sm text-smoke">New scents and limited deals, straight to your inbox.</p>
          <Newsletter />
          <p className="mt-5 text-sm text-smoke"><a className="hover:text-gold-200" href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-smoke/80 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Makhdoom Fragrances. All rights reserved.</p>
          <p className="max-w-xl sm:text-right">Our fragrances are inspired by popular designer scents. Makhdoom Fragrances is not affiliated with, or endorsed by, those brands.</p>
        </div>
      </div>
    </footer>
  );
}
