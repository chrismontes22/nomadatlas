const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s ?? ''));
const r = (v) => (v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(r).join('') : esc(v));
/** Tagged template: interpolations are escaped unless wrapped in raw() or produced by html. Arrays are joined. */
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += r(vals[i]) + strings[i + 1];
  return new Raw(out);
}
export const str = (v) => r(v);
// JSON-LD: escape "</" so a value can never close the script element ("\/" is a valid JSON escape).
export const jsonLd = (obj) => raw('<script type="application/ld+json">' + JSON.stringify(obj).replace(/<\//g, '<\\/') + '</script>');
export const when = (cond, fn) => (cond ? fn() : '');
