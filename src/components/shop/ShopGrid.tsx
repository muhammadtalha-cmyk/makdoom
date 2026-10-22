'use client';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Product } from '@/lib/types';
import ProductCard from './ProductCard';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'men', label: 'For him' },
  { id: 'women', label: 'For her' },
  { id: 'couple', label: 'Deals' },
] as const;

const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'low', label: 'Price: low to high' },
  { id: 'high', label: 'Price: high to low' },
  { id: 'save', label: 'Biggest saving' },
] as const;

export default function ShopGrid({ products, initialFilter = 'all' }: { products: Product[]; initialFilter?: string }) {
  const [filter, setFilter] = useState<string>(FILTERS.some((f) => f.id === initialFilter) ? initialFilter : 'all');
  const [sort, setSort] = useState<string>('featured');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    let out = products.filter((p) => (filter === 'all' ? true : p.gender === filter));
    const needle = q.trim().toLowerCase();
    if (needle) out = out.filter((p) => `${p.name} ${p.inspired_by ?? ''} ${p.scent_family.join(' ')}`.toLowerCase().includes(needle));
    const saving = (p: Product) => (p.compare_at_price ?? p.price) - p.price;
    if (sort === 'low') out = [...out].sort((a, b) => a.price - b.price);
    if (sort === 'high') out = [...out].sort((a, b) => b.price - a.price);
    if (sort === 'save') out = [...out].sort((a, b) => saving(b) - saving(a));
    return out;
  }, [products, filter, sort, q]);

  return (
    <div>
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label="Filter fragrances" className="no-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)} className={`min-h-[44px] shrink-0 rounded-full border px-5 text-sm font-medium transition-all ${filter === f.id ? 'border-gold-300 bg-gold-300/15 text-gold-100' : 'border-white/15 text-ivory/75 hover:border-white/35'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <label className="relative flex-1 md:w-56">
            <span className="sr-only">Search fragrances</span>
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-smoke" />
            <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search" className="field !min-h-[44px] !rounded-full !py-2 !pl-10" />
          </label>
          <label>
            <span className="sr-only">Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="field !min-h-[44px] !rounded-full !py-2">
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <p className="font-display text-3xl">Nothing matches that search</p>
          <button className="btn btn-glass mt-6" onClick={() => { setQ(''); setFilter('all'); }}>Clear filters</button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p, i) => <ProductCard key={p.slug} product={p} priority={i < 2} />)}
        </div>
      )}
    </div>
  );
}
