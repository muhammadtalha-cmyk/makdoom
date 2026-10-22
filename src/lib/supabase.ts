import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = Boolean(url && (service || anon));

const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;
let publicClient: SupabaseClient | null | undefined;
let adminClient: SupabaseClient | null | undefined;

/** Read-only public client (RLS applies). Falls back to the service client for reads if no anon key was provided. Reused across requests. */
export function getPublicClient(): SupabaseClient | null {
  if (publicClient === undefined) publicClient = url && anon ? createClient(url, anon, opts) : null;
  return publicClient;
}

/** Server-only client with the service-role key. Bypasses RLS: never import from client components. */
export function getAdminClient(): SupabaseClient | null {
  if (adminClient === undefined) adminClient = url && service ? createClient(url, service, opts) : null;
  return adminClient;
}
