import type { Metadata } from 'next';
import ThankYou from '@/components/checkout/ThankYou';

export const metadata: Metadata = { title: 'Thank you', robots: { index: false } };

export default function ThankYouPage() {
  return <ThankYou />;
}
