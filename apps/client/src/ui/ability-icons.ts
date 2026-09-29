import { ABILITIES, ELEMENTS } from "../../../../packages/shared/data";
import { AURAS, type AuraId } from "../../../../packages/shared/combat-rules";

const glyphs: Record<string, string> = {
  sword:
    '<path d="M20 4v4L10 18l-4-4L16 4Z"/><path d="m5 13 6 6M7.5 16.5 4 20"/>',
  shieldBash:
    '<path d="M11 4 4 7v5c0 5 7 9 7 9s7-4 7-9V7Z"/><path d="m20 2-1.5 1.5M22 7h-2M16 1v2"/>',
  heartPlus:
    '<path d="M12 20 4.5 12.5C1 9 4 3.5 8.5 5c1.4.5 2.6 1.6 3.5 3 .9-1.4 2.1-2.5 3.5-3C20 3.5 23 9 19.5 12.5Z"/><path d="M12 10v5m-2.5-2.5h5"/>',
  shield:
    '<path d="M12 3 5 6v5c0 5 7 9 7 9s7-4 7-9V6Z"/><path d="M12 3v17M5 11h14"/>',
  horn: '<path d="M3 10v4h3l8 5V5L6 10Z"/><path d="M17.5 8.5c1.3 1.5 1.3 5.5 0 7M20.5 6c2.6 3 2.6 9 0 12"/>',
  sweep:
    '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M18 2v4.5h-4.5"/><path d="M12 7v7m-2 0h4m-2 0v3"/>',
  firebolt:
    '<path d="M8.5 21C5.5 21 3 18.7 3 15.8 3 12 7.5 10.8 7 6c3 2 5.5 5 5 8.5 1-.8 1.7-2 1.7-3.6 2 1.8 2.3 4.3 1.3 6.5-.9 2.1-3.5 3.6-6.5 3.6Z"/><path d="m15 9 6-6m-3 9 4-3"/>',
  snowflake:
    '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="m9 3.5 3 2 3-2M9 20.5l3-2 3 2"/>',
  meteor:
    '<circle cx="15" cy="15" r="5"/><path d="m3 3 8 8M8 2.5l5.5 5.5M2.5 8 8 13.5"/>',
  hex: '<path d="M12 2 21 7v10l-9 5-9-5V7Z"/><path d="m12 7 4.5 2.5v5L12 17l-4.5-2.5v-5Z"/>',
  counter:
    '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/><path d="M15 6.5h.01M8.5 16h.01"/>',
  shard: '<path d="m12 2 4 8-4 12-4-12Z"/><path d="M12 2v20M8 10h8"/>',
  dagger:
    '<path d="m19 3-1 5-7 7-3-3 7-7Z"/><path d="m6 10.5 7.5 7.5M8.5 15.5 4 20"/>',
  venom:
    '<path d="M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11Z"/><path d="M9 14c0 2 1.3 3 3 3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 16h14a3 3 0 1 1-3 3M3 12h17"/>',
  claws: '<path d="M5 4c3 5 4 11 3 16M11 3c3 6 3 12 1 18M17 4c2 5 2 11 0 16"/>',
  boot: '<path d="M7 3h5v9l7 3c1.5.7 2 2.3 2 4H4v-4l3-3Z"/><path d="M4 17h17"/>',
  axe: '<path d="m4 21 13-17"/><path d="M12 5c4 1 5-1 7-3l3 7c-4 4-8 4-10 1Z"/>',
  skull:
    '<path d="M12 3a8 8 0 0 0-8 8c0 3 1.7 4.8 3 5.8V20h10v-3.2c1.3-1 3-2.8 3-5.8a8 8 0 0 0-8-8Z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10.5 20v-3m3 3v-3"/>',
  bloodDrop:
    '<path d="M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11Z"/><path d="M12 11v6m-3-3h6"/>',
  armor:
    '<path d="M4 6l8-3 8 3v6c0 5-8 9-8 9s-8-4-8-9Z"/><path d="M4.5 11h15M6.5 16h11"/>',
  execute:
    '<path d="M12 2v13"/><path d="M12 3c-4 0-6 2-6 4.5S8 12 12 12Z"/><path d="M3 21h18M8 17.5h8"/>',
  whirl:
    '<path d="M12 12a1.5 1.5 0 1 1 1.5 1.5 3.5 3.5 0 1 1 3.5-3.5 6 6 0 1 1-6-6 8.5 8.5 0 1 1-8.5 8.5"/>',
  stars:
    '<path d="m7 3 1 2.2 2.4.3-1.8 1.6.5 2.4L7 8.3 4.9 9.5l.5-2.4L3.6 5.5 6 5.2Z"/><path d="m17 10 1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3Z"/><path d="M4 20c3-4 13-4 16 0"/>',
  rage: '<path d="M12 3c2 4-1 5 1.5 8.5C15 10 16 8.5 16 6.5c4 4 4 9.5-.5 12.5a7 7 0 0 1-7 0C4 16 4 10.5 8 7c0 2.5 1.2 3.5 1.2 3.5C10.5 8 9.5 6 12 3Z"/><path d="M9.5 15.5 11 17m3.5-1.5L13 17"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  capsule:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><circle cx="12" cy="12" r="2.2"/>',
  fist: '<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V10m0-4a1.5 1.5 0 0 1 3 0v4m0-3a1.5 1.5 0 0 1 3 0v4m0-2a1.5 1.5 0 0 1 3 0v4c0 4-3 7-7 7h-1c-3 0-5-2-6-5l-1.5-3.5A1.5 1.5 0 0 1 7 11"/>',
};
const ABILITY_GLYPHS: Record<string, string> = {
  slash: "sword",
  "shield-strike": "shieldBash",
  rally: "heartPlus",
  bulwark: "shield",
  challenge: "horn",
  sweep: "sweep",
  firebolt: "firebolt",
  frostbolt: "snowflake",
  meteor: "meteor",
  barrier: "hex",
  counterspell: "counter",
  icelance: "shard",
  stab: "dagger",
  venom: "venom",
  ambush: "eye",
  evasion: "wind",
  eviscerate: "claws",
  kick: "boot",
  cleave: "axe",
  crush: "skull",
  "blood-rush": "bloodDrop",
  ironhide: "armor",
  execute: "execute",
  whirlwind: "whirl",
  dash: "arrow",
  catch: "capsule",
  auto: "fist",
};
const AURA_GLYPHS: Record<AuraId, string> = {
  guard: "shield",
  evasion: "wind",
  enrage: "rage",
  stun: "stars",
  slow: "snowflake",
  burn: "firebolt",
  poison: "venom",
  taunted: "horn",
  silenced: "counter",
};
function svg(glyph: string, cls: string) {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[glyph] ?? glyphs.sword}</svg>`;
}
export function abilityColor(id: string) {
  const ability = ABILITIES[id];
  return ability ? ELEMENTS[ability.element].color : "#9ec7dd";
}
/** Square icon tile for an ability, tinted by its element. */
export function abilityIcon(id: string, cls = "") {
  return `<span class="ability-icon ${cls}" style="--tint:${abilityColor(id)}">${svg(ABILITY_GLYPHS[id] ?? "sword", "ability-glyph")}</span>`;
}
export function auraIcon(id: AuraId) {
  return `<span class="aura-icon" style="--tint:${AURAS[id].color}">${svg(AURA_GLYPHS[id], "aura-glyph")}</span>`;
}
