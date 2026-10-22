'use client';
import { useState } from 'react';

export default function ContactForm() {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState('busy');
    setError('');
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fd)) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not send.');
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
      setState('idle');
    }
  }

  if (state === 'done') return <div className="glass rounded-3xl p-8" role="status"><h2 className="font-display text-4xl">Message sent</h2><p className="mt-2 text-smoke">Thank you. We will reply as soon as we can.</p></div>;
  return (
    <form onSubmit={onSubmit} className="glass space-y-5 rounded-3xl p-6 sm:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="c-name" className="mb-1.5 block text-sm font-medium">Name</label><input id="c-name" name="name" className="field" autoComplete="name" required /></div>
        <div><label htmlFor="c-email" className="mb-1.5 block text-sm font-medium">Email</label><input id="c-email" name="email" type="email" inputMode="email" className="field" autoComplete="email" required /></div>
      </div>
      <div><label htmlFor="c-phone" className="mb-1.5 block text-sm font-medium">Phone (optional)</label><input id="c-phone" name="phone" type="tel" inputMode="tel" className="field" autoComplete="tel" /></div>
      <div><label htmlFor="c-msg" className="mb-1.5 block text-sm font-medium">Message</label><textarea id="c-msg" name="message" rows={5} className="field resize-none" required /></div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button className="btn btn-gold w-full sm:w-auto" disabled={state === 'busy'}>{state === 'busy' ? 'Sending…' : 'Send message'}</button>
    </form>
  );
}
