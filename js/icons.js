// Minimal line-icon set (feather-style), used by the sidebar, topbar and
// dashboard cards. Each function returns a raw <svg> string sized by CSS
// (width/height come from the .icon / .nav-icon classes, not from here).
const wrap = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const Icon = {
  dashboard: wrap('<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>'),
  workout: wrap('<path d="M6.5 6.5 17.5 17.5"/><path d="M4 4l3 3M17 17l3 3"/><rect x="2.2" y="9.3" width="4.5" height="5.4" rx="1.2" transform="rotate(-45 2.2 9.3)"/><rect x="17.3" y="9.3" width="4.5" height="5.4" rx="1.2" transform="rotate(-45 17.3 9.3)"/>'),
  trophy: wrap('<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5a3 3 0 0 0 3 5"/><path d="M16 5h3a3 3 0 0 1-3 5"/><path d="M12 13v3"/><path d="M9 20h6"/><path d="M10 16.5h4l.6 3.5H9.4l.6-3.5Z"/>'),
  stats: wrap('<path d="M4 20V10"/><path d="M11 20V4"/><path d="M18 20v-7"/>'),
  history: wrap('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>'),
  sync: wrap('<path d="M21 12a9 9 0 0 1-15.3 6.5"/><path d="M3 12a9 9 0 0 1 15.3-6.5"/><path d="M21 3v6h-6"/><path d="M3 21v-6h6"/>'),
  logout: wrap('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
  search: wrap('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  bell: wrap('<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  plus: wrap('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  flame: wrap('<path d="M12 2s-6 6-6 11a6 6 0 0 0 12 0c0-2-1-3-1-3s-.5 2-2 2c1-3-1-5-1-7 0 0-2 2-2 4a5 5 0 0 0 0-3Z"/>'),
  dumbbell: wrap('<path d="M6.5 6.5 17.5 17.5"/><rect x="2.2" y="9.3" width="4.5" height="5.4" rx="1.2" transform="rotate(-45 2.2 9.3)"/><rect x="17.3" y="9.3" width="4.5" height="5.4" rx="1.2" transform="rotate(-45 17.3 9.3)"/>'),
  check: wrap('<path d="M20 6 9 17l-5-5"/>'),
  arrowRight: wrap('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'),
  chevronRight: wrap('<path d="m9 18 6-6-6-6"/>'),
  target: wrap('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  clock: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
};
