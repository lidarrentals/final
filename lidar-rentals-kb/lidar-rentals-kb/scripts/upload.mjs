// Usage: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload.mjs
// Requires Node 18+. Uploads everything in ./content to the private "kb" bucket (re-run any time to update).
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname, sep } from 'node:path';
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, KB_BUCKET: bucket = 'kb' } = process.env;
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.'); process.exit(1); }
const types = { '.json': 'application/json', '.webp': 'image/webp' };
async function* walk(d) { for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) yield* walk(p); else yield p; } }
let n = 0;
for await (const f of walk('content')) {
  const path = relative('content', f).split(sep).join('/');
  const r = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, { method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'x-upsert': 'true', 'Content-Type': types[extname(f)] || 'application/octet-stream' }, body: await readFile(f) });
  if (!r.ok) { console.error(`\nFAILED ${path}: ${r.status} ${await r.text()}`); process.exit(1); }
  process.stdout.write(`\r${++n} files uploaded`);
}
console.log('\nDone.');
