import type { Metadata } from 'next';
import TrackForm from '@/components/checkout/TrackForm';

export const metadata: Metadata = { title: 'Track your order', description: 'Check the status of your Makhdoom Fragrances order with your order number and phone number.', alternates: { canonical: '/track' } };

export default function TrackPage() {
  return (
    <section className="container-x pb-24 pt-36 sm:pt-40">
      <h1 className="font-display text-6xl font-medium leading-none md:text-8xl">Track your order</h1>
      <p className="mb-10 mt-4 max-w-xl text-smoke">Enter the order number from your confirmation and the mobile number you ordered with.</p>
      <TrackForm />
    </section>
  );
}
