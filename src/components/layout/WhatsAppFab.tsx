'use client';
import { usePathname } from 'next/navigation';
import { SITE } from '@/lib/config';
import { supportWhatsAppUrl } from '@/lib/whatsapp';
import { WhatsAppIcon } from '@/components/ui/icons';

export default function WhatsAppFab() {
  const path = usePathname();
  if (path.startsWith('/admin') || path.startsWith('/thank-you')) return null;
  return (
    <a href={supportWhatsAppUrl()} target="_blank" rel="noopener noreferrer" aria-label={`Chat with us on WhatsApp ${SITE.whatsapp}`} className="group fixed bottom-5 right-5 z-[60] flex h-14 items-center gap-0 overflow-hidden rounded-full border border-gold-300/40 bg-[#0b0a08]/90 pl-[15px] pr-[15px] text-gold-200 shadow-gold transition-all duration-500 hover:gap-2 hover:pr-5 sm:bottom-7 sm:right-7">
      <WhatsAppIcon width={26} height={26} />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-500 group-hover:max-w-[120px] group-hover:opacity-100">Chat with us</span>
    </a>
  );
}
