'use client';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useCallback, useState } from 'react';
import { Box } from 'lucide-react';
import { CHAPTER_SLUGS } from '@/components/hero/chapters';

const Viewer = dynamic(() => import('./ProductViewer3D'), { ssr: false, loading: () => <div className="grid h-full place-items-center text-sm text-smoke">Loading 3D bottle…</div> });

export default function ProductGallery({ slug, name, accent, images }: { slug: string; name: string; accent: string; images: string[] }) {
  const has3d = (CHAPTER_SLUGS as readonly string[]).includes(slug);
  const [view, setView] = useState<number | '3d'>(has3d ? '3d' : 0);
  const [broken, setBroken] = useState(false); // WebGL unavailable or lost: fall back to photos
  const onFail = useCallback(() => { setBroken(true); setView(0); }, []);
  const show3d = has3d && !broken;

  return (
    <div>
      <div className="surface relative aspect-[4/5] overflow-hidden rounded-[28px] p-0 sm:aspect-square lg:aspect-[4/5]">
        {view === '3d' && show3d ? (
          <>
            <Viewer slug={slug} name={name} accent={accent} onFail={onFail} />
            <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-ivory/80">Drag to rotate</p>
          </>
        ) : (
          <Image src={images[typeof view === 'number' ? view : 0]} alt={`${name} perfume`} fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
        )}
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto no-scrollbar" role="tablist" aria-label="Product views">
        {show3d && (
          <button role="tab" aria-selected={view === '3d'} aria-label="3D view" onClick={() => setView('3d')} className={`grid h-20 w-20 shrink-0 place-items-center rounded-2xl border transition-colors ${view === '3d' ? 'border-gold-300 text-gold-200' : 'border-white/15 text-smoke hover:border-white/40'}`}>
            <Box size={24} strokeWidth={1.4} />
          </button>
        )}
        {images.map((src, i) => (
          <button key={src} role="tab" aria-selected={view === i} aria-label={`Photo ${i + 1}`} onClick={() => setView(i)} className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border transition-colors ${view === i ? 'border-gold-300' : 'border-white/15 hover:border-white/40'}`}>
            <Image src={src} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
