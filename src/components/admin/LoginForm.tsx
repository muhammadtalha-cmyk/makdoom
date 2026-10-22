'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: new FormData(e.currentTarget).get('password') }) });
    if (res.ok) router.replace('/admin');
    else setError((await res.json().catch(() => ({}))).error || 'Could not sign in.');
    setBusy(false);
  }
  return (
    <form onSubmit={onSubmit} className="glass-strong mx-auto w-full max-w-sm rounded-3xl p-8">
      <h1 className="font-display text-4xl">Owner login</h1>
      <label htmlFor="pw" className="mb-1.5 mt-6 block text-sm font-medium">Password</label>
      <input id="pw" name="password" type="password" className="field" autoComplete="current-password" required />
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      <button className="btn btn-gold mt-6 w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
