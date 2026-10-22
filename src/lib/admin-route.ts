import { requireAdmin } from './admin-auth';
import { enforce } from './rate-limit';
import { assertSameOrigin, route } from './security';
import type { Session } from './admin-token';

/** Every admin endpoint: valid signed session, same-origin for mutations (CSRF), and a per-session request ceiling. */
export function adminRoute(name: string, mutating: boolean, fn: (req: Request, session: Session, rid: string) => Promise<Response>) {
  return route(`admin.${name}`, async (req, rid) => {
    if (mutating) assertSameOrigin(req, true);
    const session = await requireAdmin();
    await enforce(`admin:${session.sid}`, 240, 60, 'Slow down a little.');
    return fn(req, session, rid);
  });
}

/** Strips anything that could alter a PostgREST filter expression. */
export const safeTerm = (s: string) => s.replace(/[^\p{L}\p{N}\s.+@_-]/gu, '').slice(0, 60);
