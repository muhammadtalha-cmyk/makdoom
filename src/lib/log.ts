/** Structured JSON logs (one line each) that Vercel/Datadog/etc. can index. Never log customer PII. */
type Level = 'info' | 'warn' | 'error';
const redact = (v: unknown): unknown => {
  if (typeof v === 'string') return v.replace(/\b(?:\+?92|0)3\d{9}\b/g, '[phone]').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]');
  return v;
};
function write(level: Level, msg: string, meta?: Record<string, unknown>) {
  const entry: Record<string, unknown> = { t: new Date().toISOString(), level, msg };
  if (meta) for (const [k, v] of Object.entries(meta)) entry[k] = v instanceof Error ? { name: v.name, message: String(redact(v.message)) } : redact(v);
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(JSON.stringify(entry));
}
export const log = {
  info: (m: string, meta?: Record<string, unknown>) => write('info', m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => write('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => write('error', m, meta),
};
