import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin-auth';
import { adminStatus } from '@/lib/env';
import LoginForm from '@/components/admin/LoginForm';

export const metadata: Metadata = { title: 'Owner login', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLogin() {
  if (await isAdmin()) redirect('/admin');
  const status = adminStatus();
  return (
    <section className="container-x grid min-h-[80svh] place-items-center pt-32">
      {status.enabled ? <LoginForm /> : (
        <div className="surface mx-auto max-w-md rounded-3xl p-8">
          <h1 className="font-display text-3xl">Admin is not configured</h1>
          <p className="mt-3 text-sm text-smoke">{status.problem}</p>
        </div>
      )}
    </section>
  );
}
