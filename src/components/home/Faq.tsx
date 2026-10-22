import { Plus } from 'lucide-react';

export const FAQS = [
  { q: 'Do I need an account to order?', a: 'No. Just add items to your bag and check out as a guest with your name, phone number and delivery address.' },
  { q: 'How does cash on delivery work?', a: 'You pay in cash to the rider when your parcel arrives. We do not take any online or card payment.' },
  { q: 'What happens after I place an order?', a: 'Your order is saved and sent to our team, and WhatsApp opens with your order details so we can confirm it with you. You will land on a thank-you page with your order number.' },
  { q: 'How long does delivery take?', a: 'We deliver across Pakistan. Most orders arrive within 3 to 5 working days, depending on your city.' },
  { q: 'What does "inspired by" mean?', a: 'Our Eau de Parfums are created to capture the character of popular designer fragrances. They are Makhdoom Fragrances products, not the original brands.' },
  { q: 'How do I track my order?', a: 'Open Track order and enter your order number and the phone number you ordered with.' },
];

export default function Faq() {
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  return (
    <section className="section-y defer !pt-0" aria-labelledby="faq-h">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div className="container-x grid gap-12 lg:grid-cols-12">
        <h2 id="faq-h" className="font-display text-5xl font-medium leading-[0.95] md:text-6xl lg:col-span-4">Good to know</h2>
        <div className="lg:col-span-8">
          {FAQS.map((f) => (
            <details key={f.q} className="group border-b border-white/12 py-1 first:border-t">
              <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-6 py-3 font-display text-2xl marker:hidden [&::-webkit-details-marker]:hidden">
                {f.q}
                <Plus size={22} strokeWidth={1.4} className="shrink-0 text-gold-300 transition-transform duration-300 group-open:rotate-45" aria-hidden />
              </summary>
              <p className="max-w-2xl pb-6 text-smoke">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
