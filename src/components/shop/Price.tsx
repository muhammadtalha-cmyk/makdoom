import { formatPKR } from '@/lib/format';

export default function Price({ price, compare, size = 'md' }: { price: number; compare: number | null; size?: 'md' | 'lg' }) {
  const off = compare && compare > price ? Math.round(((compare - price) / compare) * 100) : 0;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className={`font-display font-semibold text-gold-200 ${size === 'lg' ? 'text-4xl' : 'text-2xl'}`}>{formatPKR(price)}</span>
      {compare && compare > price && (
        <>
          <s className="text-sm text-smoke" aria-label={`Was ${formatPKR(compare)}`}>{formatPKR(compare)}</s>
          <span className="rounded-full bg-gold-300/15 px-2 py-0.5 text-xs font-semibold text-gold-200">Save {off}%</span>
        </>
      )}
    </div>
  );
}
