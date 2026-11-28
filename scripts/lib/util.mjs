import { inflateRawSync } from 'node:zlib';
import { mkdir, writeFile, readFile, access, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

export const UA = 'NomadAtlasDataBuilder/1.0 (open-data static site build script)';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function exists(p) { try { await access(p); return true; } catch { return false; } }
export async function ensureDir(p) { await mkdir(p, { recursive: true }); }
/** Writes to a temporary file and renames it into place, so an interrupted run never leaves a half-written file. */
export async function writeAtomic(p, data) {
  await ensureDir(dirname(p));
  const tmp = p + '.' + process.pid + '.tmp';
  await writeFile(tmp, data);
  // Windows (and OneDrive or antivirus scanners) can lock the target for a moment: retry the rename a few times.
  for (let i = 0; ; i++) {
    try { await rename(tmp, p); return; } catch (e) {
      if (i >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { await rm(tmp, { force: true }); throw e; }
      await sleep(100 * (i + 1));
    }
  }
}
export async function writeJSON(p, v, pretty = false) { await writeAtomic(p, JSON.stringify(v, null, pretty ? 2 : 0)); }
export async function readJSON(p) { return JSON.parse(await readFile(p, 'utf8')); }

/** fetch with retries + timeout. The timeout covers the whole response, body included. Returns Buffer. */
export async function download(url, { retries = 4, timeout = 120000, headers = {} } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try { return await fetchOnce(url, timeout, headers); } catch (e) {
      lastErr = e;
      if (e.status === 404) throw e;
      if (i < retries) await sleep(800 * (i + 1) ** 2);
    }
  }
  throw lastErr;
}
async function fetchOnce(url, timeout, headers) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal });
    if (res.status === 404) { const e = new Error('404 ' + url); e.status = 404; throw e; }
    if (!res.ok) throw new Error(res.status + ' ' + url);
    return Buffer.from(await res.arrayBuffer());
  } finally { clearTimeout(t); }
}

/**
 * Downloads once into a cache file and returns the Buffer. opts.validate(buf) throws when a payload is wrong (an error page,
 * a truncated body): a bad download is never cached, and a bad file already in the cache is downloaded again.
 */
export async function cached(file, url, opts = {}) {
  if (!opts.force && (await exists(file))) {
    const buf = await readFile(file);
    try { opts.validate?.(buf); return buf; } catch (e) { console.warn('[cache] downloading ' + file + ' again: ' + e.message); }
  }
  const buf = await download(url, opts);
  try { opts.validate?.(buf); } catch (e) { throw new Error(url + ': ' + e.message); }
  await writeAtomic(file, buf);
  return buf;
}

// Validators for cached().
export const isJSON = (check = () => true) => (buf) => {
  let j; try { j = JSON.parse(buf.toString('utf8')); } catch { j = undefined; }
  if (j === undefined || !check(j)) throw new Error('unexpected response: ' + buf.toString('utf8', 0, 200));
};
export const isZip = (buf) => { if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) throw new Error('not a zip file'); };
export const hasText = (needle) => (buf) => { if (!buf.toString('utf8', 0, 4096).includes(needle)) throw new Error('expected "' + needle + '" near the start'); };

/** Minimal ZIP reader (deflate + stored). Returns Map(name -> Buffer) for entries matching filter. */
export function unzip(buf, filter = () => true) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad central directory');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (!filter(name)) continue;
    if (method !== 0 && method !== 8) throw new Error('Unsupported zip compression method ' + method + ' for ' + name);
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('Bad local header for ' + name);
    const lNameLen = buf.readUInt16LE(local + 26), lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + csize);
    // Never inflate past the size the archive declares: guards against zip bombs and corrupt downloads.
    out.set(name, method === 0 ? Buffer.from(data) : inflateRawSync(data, { maxOutputLength: Math.max(1, usize) }));
  }
  return out;
}

/** RFC4180-ish CSV parser */
export function parseCSV(text) {
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

export async function pool(items, n, fn) {
  const results = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; results[k] = await fn(items[k], k); }
  }));
  return results;
}

const stripMarks = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '');
export function slugify(s) {
  return stripMarks(s).toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
}
export const fold = (s) => stripMarks(s).toLowerCase().trim();
