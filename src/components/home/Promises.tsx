import { Banknote, Gem, Timer, Truck } from 'lucide-react';

const items = [
  { Icon: Gem, title: 'Premium quality', text: 'Concentrated Eau de Parfum, carefully crafted.' },
  { Icon: Timer, title: 'Long-lasting', text: 'Scents that stay with you from morning to night.' },
  { Icon: Truck, title: 'Nationwide delivery', text: 'To your door, anywhere in Pakistan.' },
  { Icon: Banknote, title: 'Cash on delivery', text: 'No card, no account. Pay when it arrives.' },
];

export default function Promises() {
  return (
    <section aria-label="Why Makhdoom" className="border-y border-white/10 bg-black/40">
      <ul className="container-x grid grid-cols-2 divide-white/10 py-2 lg:grid-cols-4 lg:divide-x">
        {items.map(({ Icon, title, text }) => (
          <li key={title} className="flex items-start gap-4 px-2 py-6 lg:px-8">
            <Icon size={26} strokeWidth={1.3} className="mt-1 shrink-0 text-gold-300" aria-hidden />
            <div>
              <h2 className="font-display text-xl font-semibold leading-tight">{title}</h2>
              <p className="mt-1 text-sm text-smoke">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
