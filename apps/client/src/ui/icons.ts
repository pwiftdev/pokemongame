const paths: Record<string, string> = {
  sword: '<path d="m5 19 4-4m-5-2 7 7m-4-6L17 3l4-1-1 4L9 17M3 21l3-3"/>',
  axe: '<path d="m4 21 13-17M12 5c4 1 5-1 7-3l3 7c-4 4-8 4-10 1Z"/>',
  shield: '<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6ZM8 12l3 3 5-6"/>',
  leaf: '<path d="M19 4C8 2 3 8 6 15s15 1 13-11Z"/><path d="m5 20 9-11M9 15l-1-5m4 2 5 1"/>',
  flame:
    '<path d="M12 3c2 5-2 5 1 9 2-1 3-3 3-5 6 6 5 14-4 14S1 13 7 7c0 4 2 5 2 5 2-3-1-6 3-9Z"/>',
  tide: '<path d="M12 3C9 8 5 11 5 15a7 7 0 0 0 14 0c0-4-4-7-7-12Z"/><path d="M9 16c0 2 1 3 3 3"/>',
  stone:
    '<path d="m8 4 9 1 5 10-7 6-12-5Z"/><path d="m8 4 2 10 5 7m-5-7 12 1"/>',
  spark: '<path d="m14 2-9 12h6l-1 8 9-13h-7Z"/>',
  spirit:
    '<path d="M5 13a7 7 0 1 1 14 0v8l-4-3-3 3-3-3-4 3Z"/><path d="M9 11h.01M15 11h.01"/>',
  bag: '<path d="M8 7V5a4 4 0 0 1 8 0v2M5 7h14l2 14H3Z"/><path d="M8 11v2m8-2v2"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
  journal:
    '<path d="M6 3h14v18H6a3 3 0 0 1 0-6h14M6 3a3 3 0 0 0-3 3v12m6-10h7m-7 4h5"/>',
  team: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/>',
  settings:
    '<circle cx="12" cy="12" r="4"/><path d="m9 3 1-2h4l1 2 3 2 2 1 2 4-2 2v3l-2 2-1 3-4 2-2-2H8l-2-2-3-1-2-4 2-2V8l2-2 1-3Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  wallet:
    '<path d="M17 7V4H5a2 2 0 0 0 0 4h15v12H5a2 2 0 0 1-2-2V6"/><path d="M16 14h.01"/>',
  chat: '<path d="M4 4h16v12H9l-5 4Z"/><path d="M8 9h8m-8 3h5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  heart: '<path d="M12 21 3 12C-2 5 8 0 12 7c4-7 14-2 9 5Z"/>',
  arena:
    '<path d="m4 3 13 13m-2-1 5-1 1 7-7-1 1-5M20 3 7 16m2-1-5-1-1 7 7-1-1-5"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  sound:
    '<path d="m3 9 5 0 5-5v16l-5-5H3Zm14-2a8 8 0 0 1 0 10m3-13a12 12 0 0 1 0 16"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 5-5 2 2-5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
};
export function icon(name: string, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.leaf}</svg>`;
}
export function escape(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
