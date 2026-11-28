import { raw } from './html.mjs';

// Line icons on a 24 px grid, drawn with currentColor. Decorative only: always aria-hidden next to visible text.
const P = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
  wallet: '<path d="M4 8.5V7a2.5 2.5 0 0 1 2.5-2.5H17v4"/><rect x="4" y="8.5" width="16" height="11" rx="2.5"/><path d="M15.5 14h1.5"/>',
  passport: '<rect x="5" y="3" width="14" height="18" rx="2.2"/><circle cx="12" cy="10.5" r="3.3"/><path d="M8.7 10.5h6.6M12 7.2c1.2 1.1 1.2 5.5 0 6.6M12 7.2c-1.2 1.1-1.2 5.5 0 6.6M9 17.2h6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m9 14.8 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.4 2.1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  plane: '<path d="M21 15.6v-1.8l-7.6-4.6V4.6a1.4 1.4 0 0 0-2.8 0v4.6L3 13.8v1.8l7.6-2.3v4.3l-2.1 1.6v1.3l3.5-1 3.5 1v-1.3l-2.1-1.6v-4.3z"/>',
  wifi: '<path d="M2.5 9.2a14 14 0 0 1 19 0M5.6 12.6a9.4 9.4 0 0 1 12.8 0M8.7 16a5 5 0 0 1 6.6 0"/><path d="M12 19.4h.01" stroke-width="2.6"/>',
  shield: '<path d="M12 3 5 6v5.6c0 4.3 3 8 7 9.4 4-1.4 7-5.1 7-9.4V6z"/><path d="m9 12 2.1 2.1L15.2 10"/>',
  heart: '<path d="M12 20s-7.5-4.5-7.5-10.1A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.6C19.5 15.5 12 20 12 20z"/><path d="M7.6 12.4h2.2l1.1-2 2 4 1.1-2h2.4"/>',
  wind: '<path d="M3 8.5h10.6a2.6 2.6 0 1 0-2.6-2.6M3 12.5h15.4a2.6 2.6 0 1 1-2.6 2.6M3 16.5h7.5"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.6 3.7 5.6 3.7 9s-1.3 6.4-3.7 9c-2.4-2.6-3.7-5.6-3.7-9S9.6 5.6 12 3z"/>',
  route: '<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8.4 18h6.1a3.25 3.25 0 0 0 0-6.5h-5a3.25 3.25 0 0 1 0-6.5h6.1"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/><path d="M9 7.5h7M9 11h5"/>',
};
export const icon = (name) => raw('<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (P[name] || '') + '</svg>');
export const iconTile = (name, tone) => raw('<span class="icontile' + (tone ? ' tone-' + tone : '') + '" aria-hidden="true">' + icon(name).s + '</span>');
