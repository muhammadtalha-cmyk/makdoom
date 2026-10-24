import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { SITE } from '@/lib/config';
import { supportWhatsAppUrl } from '@/lib/whatsapp';
import ContactForm from '@/components/checkout/ContactForm';
import { WhatsAppIcon } from '@/components/ui/icons';
import { SOCIAL_BLURB, SOCIAL_ICONS } from '@/components/ui/social-icons';
import { getSiteSettings } from '@/lib/site-settings';

export const metadata: Metadata = { title: 'Contact us', description: 'Questions about an order or a fragrance? Message Makhdoom Fragrances on WhatsApp, email or the contact form.', alternates: { canonical: '/contact' } };

export default async function ContactPage() {
  const { socials } = await getSiteSettings(); // links the owner manages in the dashboard (Social links tab)
  const rows = [
    { href: supportWhatsAppUrl(), label: 'WhatsApp', sub: `+${SITE.whatsapp.replace(/^(\d{2})(\d{3})(\d+)/, '$1 $2 $3')}`, Icon: WhatsAppIcon },
    { href: `mailto:${SITE.email}`, label: 'Email', sub: SITE.email, Icon: Mail },
    ...socials.map((s) => ({ href: s.url, label: s.label, sub: SOCIAL_BLURB[s.key], Icon: SOCIAL_ICONS[s.key] })),
  ];
  return (
    <section className="container-x pb-24 pt-36 sm:pt-40">
      <h1 className="font-display text-6xl font-medium leading-none md:text-8xl">Contact us</h1>
      <p className="mb-12 mt-4 max-w-xl text-smoke">The fastest way to reach us is WhatsApp. Prefer email? Use the form.</p>
      <div className="grid gap-8 lg:grid-cols-5">
        <ul className="space-y-3 lg:col-span-2">
          {rows.map(({ href, label, sub, Icon }) => (
            <li key={label}>
              <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="glass flex items-center gap-4 rounded-2xl p-4 transition-colors hover:border-gold-300/50">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-gold-300/40 text-gold-200"><Icon width={22} height={22} /></span>
                <span><span className="block font-semibold">{label}</span><span className="text-sm text-smoke">{sub}</span></span>
              </a>
            </li>
          ))}
        </ul>
        <div className="lg:col-span-3"><ContactForm /></div>
      </div>
    </section>
  );
}
