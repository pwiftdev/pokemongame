import { icon } from "./icons";

const menus = [
  { id: "gear", glyph: "shield", label: "Gear", key: "I" },
  { id: "skills", glyph: "sword", label: "Skills", key: "K" },
  { id: "collection", glyph: "team", label: "Team", key: "C" },
  { id: "pokedex", glyph: "journal", label: "Pokédex", key: "P" },
  { id: "inventory", glyph: "bag", label: "Bag", key: "B" },
  { id: "quests", glyph: "journal", label: "Quests", key: "J" },
  { id: "map", glyph: "map", label: "Map", key: "M" },
] as const;

export function adventureNavigation(active?: string) {
  return `<nav class="${active ? "panel-nav" : "quick-nav"}" aria-label="Adventure menus">${menus
    .map(
      ({ id, glyph, label, key }) =>
        `<button data-action="panel:${id}" aria-label="${label}" title="${label} (${key})" ${active === id ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${label}</span><kbd>${key}</kbd></button>`,
    )
    .join("")}</nav>`;
}

export function worldMark() {
  return '<img class="world-mark" src="/logo.png" alt="" width="44" height="44"/>';
}
