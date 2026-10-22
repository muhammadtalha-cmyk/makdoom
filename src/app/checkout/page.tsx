import type { Metadata } from 'next';
import CheckoutForm from '@/components/checkout/CheckoutForm';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default function CheckoutPage() {
  return (
    <section className="container-x pb-24 pt-36 sm:pt-40">
      <h1 className="mb-10 font-display text-6xl font-medium leading-none md:text-7xl">Checkout</h1>
      <CheckoutForm />
    </section>
  );
}
