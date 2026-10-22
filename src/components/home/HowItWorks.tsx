const steps = [
  { title: 'Choose your fragrance', text: 'Add your favourites to the bag. No account needed.' },
  { title: 'Place your order', text: 'Enter your name, phone and address. That is all we need.' },
  { title: 'Confirm on WhatsApp', text: 'Your order opens in WhatsApp so we can confirm it with you.' },
  { title: 'Pay on delivery', text: 'The parcel arrives at your door. Pay the rider in cash.' },
];

export default function HowItWorks() {
  return (
    <section className="section-y defer !pt-0" aria-labelledby="how-h">
      <div className="container-x">
        <h2 id="how-h" className="font-display text-5xl font-medium leading-[0.95] md:text-7xl">Ordering takes a minute</h2>
        <ol className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
          <span className="rule-gold absolute left-[15px] top-2 hidden h-px w-[calc(100%-30px)] md:block" aria-hidden />
          {steps.map((s, i) => (
            <li key={s.title} className="relative pl-12 md:pl-0 md:pt-12">
              <span className="absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full border border-gold-300/60 bg-onyx text-sm font-semibold text-gold-200 md:top-[-16px]">{i + 1}</span>
              <h3 className="font-display text-2xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-smoke">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
