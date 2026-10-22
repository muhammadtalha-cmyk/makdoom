import { getAdminClient } from './supabase';
import { hash, clientIp } from './security';
import { log } from './log';

/** Append-only trail of admin actions (sign-ins, status changes, price edits). Failure to write never blocks the action. */
export async function audit(req: Request, action: string, target?: string, meta?: Record<string, unknown>) {
  log.info('audit', { action, target });
  const db = getAdminClient();
  if (!db) return;
  const { error } = await db.from('audit_log').insert({ action, target: target ?? null, meta: meta ?? {}, ip_hash: hash(clientIp(req)) });
  if (error) log.warn('audit write failed', { msg: error.message });
}
