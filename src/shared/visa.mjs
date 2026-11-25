// Visa requirements from the Passport Index Data matrix (MIT).
export const STATUS = {
  home: { label: 'Your passport', short: 'Home', rank: 7, ease: 100 },
  free: { label: 'Visa-free', short: 'Visa-free', rank: 6, ease: 100 },
  voa: { label: 'Visa on arrival', short: 'On arrival', rank: 5, ease: 85 },
  eta: { label: 'Electronic travel authorisation', short: 'eTA', rank: 4, ease: 80 },
  evisa: { label: 'e-Visa', short: 'e-Visa', rank: 3, ease: 50 },
  required: { label: 'Visa required', short: 'Visa needed', rank: 2, ease: 10 },
  banned: { label: 'No admission', short: 'No entry', rank: 1, ease: 0 },
};
export const STATUS_ORDER = ['free', 'voa', 'eta', 'evisa', 'required', 'banned'];
const TOK = { F: 'free', A: 'voa', T: 'eta', E: 'evisa', R: 'required', N: 'banned', '-': 'home' };

export function decode(tok) {
  if (tok && /^\d+$/.test(tok)) return { s: 'free', days: +tok };
  return { s: TOK[tok] || 'required', days: null };
}
const better = (a, b) => {
  if (!b) return a; if (!a) return b;
  const ra = STATUS[a.s].rank, rb = STATUS[b.s].rank;
  if (ra !== rb) return ra > rb ? a : b;
  const da = a.days ?? Infinity, db = b.days ?? Infinity;
  return da >= db ? a : b;
};

export function createVisa(json) {
  const idx = new Map(json.codes.map((c, i) => [c, i]));
  const cache = new Map();
  const row = (p) => { if (!cache.has(p)) { const i = idx.get(p); cache.set(p, i == null ? null : json.rows[i].split(',')); } return cache.get(p); };
  const api = {
    updated: json.updated,
    codes: json.codes,
    has: (iso3) => idx.has(iso3),
    get(passport, dest) {
      const r = row(passport); const j = idx.get(dest);
      if (!r || j == null) return null;
      return decode(r[j]);
    },
    best(passports, dest) {
      let b = null; let from = null;
      for (const p of passports || []) { const v = api.get(p, dest); const nb = better(b, v); if (nb !== b) { b = nb; from = p; } }
      return b ? { ...b, from } : null;
    },
    counts(passports) {
      const out = { free: 0, voa: 0, eta: 0, evisa: 0, required: 0, banned: 0 };
      for (const d of json.codes) { if ((passports || []).includes(d)) continue; const v = api.best(passports, d); if (v && out[v.s] != null) out[v.s]++; }
      out.easy = out.free + out.voa + out.eta;
      return out;
    },
    /** how many passports get visa-free / on-arrival / eTA entry to a destination */
    openness(dest) {
      let n = 0;
      for (const p of json.codes) { if (p === dest) continue; const v = api.get(p, dest); if (v && (v.s === 'free' || v.s === 'voa' || v.s === 'eta')) n++; }
      return n;
    },
  };
  return api;
}

export function stayLabel(v) {
  if (!v) return 'No data';
  if (v.s === 'free') return v.days ? v.days + ' days visa-free' : 'Visa-free';
  return STATUS[v.s].label;
}
export function visaEase(v) {
  if (!v) return null;
  if (v.s === 'free' || v.s === 'home') return v.days == null || v.days >= 90 ? 100 : v.days >= 30 ? 88 : 75;
  return STATUS[v.s].ease;
}
