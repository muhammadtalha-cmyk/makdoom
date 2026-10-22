'use client';
import { useState } from 'react';

export default function Newsletter() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState('loading');
    try {
      const res = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: fd.get('email'), website: fd.get('website') }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not subscribe.');
      setState('done');
      setMsg('You are on the list. Thank you.');
    } catch (err) {
      setState('error');
      setMsg(err instanceof Error ? err.message : 'Could not subscribe.');
    }
  }

  if (state === 'done') return <p className="mt-4 text-sm text-gold-200" role="status">{msg}</p>;
  return (
    <form onSubmit={onSubmit} className="mt-4" noValidate>
      <label htmlFor="nl-email" className="sr-only">Email address</label>
      <div className="flex gap-2">
        <input id="nl-email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="you@email.com" className="field !min-h-[48px] flex-1" />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <button type="submit" disabled={state === 'loading'} className="btn btn-gold !px-5">{state === 'loading' ? '…' : 'Join'}</button>
      </div>
      {state === 'error' && <p className="mt-2 text-sm text-red-300" role="alert">{msg}</p>}
    </form>
  );
}
