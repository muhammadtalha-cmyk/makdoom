import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin-auth';
import { getAdminClient } from '@/lib/supabase';
import AdminPanel from '@/components/admin/AdminPanel';

export const metadata: Metadata = { title: 'Owner dashboard', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  if (!getAdminClient()) {
    return <section className="container-x pb-24 pt-36"><div className="surface rounded-3xl p-8"><h1 className="font-display text-4xl">Database not connected</h1><p className="mt-2 text-smoke">Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then redeploy.</p></div></section>;
  }
  return <section className="container-x pb-24 pt-32"><AdminPanel /></section>;
}
