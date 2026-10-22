import { randomUUID } from 'crypto';
import { adminRoute } from '@/lib/admin-route';
import { audit } from '@/lib/audit';
import { getAdminClient } from '@/lib/supabase';
import { HttpError, json } from '@/lib/security';
import { IMAGE_BUCKET, bucketPrefix } from '@/lib/product-images';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 4 * 1024 * 1024; // stays under the 4.5 MB request limit of serverless hosts; the dashboard shrinks photos first

/** Identify the real file type from its first bytes. The browser-supplied type and file name are never trusted. */
function sniff(b: Uint8Array): { ext: string; type: string } | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', type: 'image/png' };
  if (b.length > 12 && Buffer.from(b.subarray(0, 4)).toString('latin1') === 'RIFF' && Buffer.from(b.subarray(8, 12)).toString('latin1') === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  return null;
}

export const POST = adminRoute('upload', true, async (req) => {
  const db = getAdminClient();
  if (!db) throw new HttpError(503, 'Database is not configured.');
  if (!bucketPrefix()) throw new HttpError(503, 'Image storage is not configured.');
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES + 64 * 1024) throw new HttpError(413, 'That picture is too large (maximum 4 MB).');
  if (!(req.headers.get('content-type') ?? '').toLowerCase().includes('multipart/form-data')) throw new HttpError(415, 'Send the picture as a file upload.');

  let form: FormData;
  try { form = await req.formData(); } catch { throw new HttpError(400, 'Could not read the upload.'); }
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Choose a picture to upload.');
  if (file.size === 0) throw new HttpError(400, 'That file is empty.');
  if (file.size > MAX_BYTES) throw new HttpError(413, 'That picture is too large (maximum 4 MB).');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) throw new HttpError(415, 'Only JPG, PNG or WebP pictures are allowed.');

  const path = `${new Date().toISOString().slice(0, 7)}/${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${kind.ext}`;
  const put = () => db.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: kind.type, cacheControl: '31536000', upsert: false });
  let { error } = await put();
  if (error && /bucket.*not found/i.test(error.message)) {
    // first upload on a fresh project: create the public bucket automatically
    await db.storage.createBucket(IMAGE_BUCKET, { public: true, fileSizeLimit: MAX_BYTES, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] });
    ({ error } = await put());
  }
  if (error) throw new HttpError(500, 'Could not store the picture. Please try again.');

  await audit(req, 'image.upload', path, { bytes: file.size });
  return json({ ok: true, url: `${bucketPrefix()}${path}` }, 201);
});
