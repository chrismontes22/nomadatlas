import { inflateRawSync } from 'node:zlib';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';

export const UA = 'NomadAtlasDataBuilder/1.0 (open-data static site build script)';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function exists(p) { try { await access(p); return true; } catch { return false; } }
export async function ensureDir(p) { await mkdir(p, { recursive: true }); }
export async function writeJSON(p, v, pretty = false) { await ensureDir(dirname(p)); await writeFile(p, JSON.stringify(v, null, pretty ? 2 : 0)); }
export async function readJSON(p) { return JSON.parse(await readFile(p, 'utf8')); }

/** fetch with retries + timeout. Returns Buffer. */
export async function download(url, { retries = 4, timeout = 120000, headers = {} } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeout);
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 404) { const e = new Error('404 ' + url); e.status = 404; throw e; }
      if (!res.ok) throw new Error(res.status + ' ' + url);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      lastErr = e;
      if (e.status === 404) throw e;
      await sleep(800 * (i + 1) ** 2);
    }
  }
  throw lastErr;
}

/** download once into a cache file; returns the Buffer */
export async function cached(file, url, opts = {}) {
  if (!opts.force && (await exists(file))) return readFile(file);
  const buf = await download(url, opts);
  await ensureDir(dirname(file));
  await writeFile(file, buf);
  return buf;
}

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
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (!filter(name)) continue;
    const lNameLen = buf.readUInt16LE(local + 26), lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + csize);
    out.set(name, method === 0 ? Buffer.from(data) : inflateRawSync(data));
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
