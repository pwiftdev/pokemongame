import { isGuest } from "../../../../packages/shared/access";
import {
  GEAR,
  GEAR_CATALOG,
  GEAR_SLOTS,
  SLOT_NAMES,
  RARITY_COLORS,
  gearStats,
  gearCanEquip,
  type GearSlot,
  type GearItem,
} from "../../../../packages/shared/gear";
import { heroLevel, heroMaxHp } from "../../../../packages/shared/hero";
import type { Profile } from "../../../../packages/shared/types";
import { escape as esc, icon } from "./icons";
export type GearTab = "owned" | "shop" | "collectibles";
const glyph = (slot: GearSlot) =>
  icon(slot === "weapon" ? "sword" : slot === "back" ? "spark" : "shield");
function stats(item: Pick<GearItem, "power" | "armor" | "health">) {
  return (
    [
      item.power ? `+${item.power} power` : "",
      item.health ? `+${item.health} health` : "",
      item.armor ? `${item.armor}% damage reduction` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Cosmetic · No combat stats"
  );
}
function comparison(item: GearItem, current?: GearItem) {
  return (["power", "health", "armor"] as const)
    .map((key) => {
      const delta = item[key] - (current?.[key] ?? 0);
      return delta
        ? `<span class="${delta > 0 ? "gear-gain" : "gear-loss"}">${delta > 0 ? "+" : ""}${delta}${key === "armor" ? "%" : ""} ${key}</span>`
        : "";
    })
    .join("");
}
export function gearPanel(
  profile: Profile,
  slot: GearSlot,
  tab: GearTab,
  previewId: string | undefined,
  busy: boolean,
  atShop: boolean,
) {
  const guest = isGuest(profile),
    level = heroLevel(profile),
    bonuses = gearStats(profile),
    owned = profile.gear?.owned ?? [],
    equipped = profile.gear?.equipped ?? {};
  const preview = GEAR[previewId ?? ""];
  const rows = GEAR_CATALOG.filter(
    (item) =>
      (!item.classId || item.classId === profile.classId) &&
      (tab === "collectibles"
        ? item.slot === "back"
        : item.slot === slot &&
          (tab === "shop" ? !item.goal : owned.includes(item.id))),
  );
  return `<div class="gear-workbench" data-combat-busy="${busy}"><aside data-panel-scroll="gear-character"><div id="gear-preview" class="gear-preview"><canvas aria-label="Equipment preview"></canvas><span class="gear-preview-status">Loading character…</span></div><p class="gear-preview-note">${preview ? `Trying on ${esc(preview.name)} · not yet equipped` : "Your equipped appearance"}</p><div class="gear-totals"><strong>${heroMaxHp(profile)} health</strong><span>+${bonuses.power} weapon power</span><span>${bonuses.armor}% damage reduction</span></div><div class="gear-paperdoll">${GEAR_SLOTS.map(
    (s) => {
      const item = GEAR[equipped[s] ?? ""];
      return `<div><button class="secondary gear-slot ${slot === s ? "selected" : ""}" data-action="gear-slot:${s}">${glyph(s)}<span><small>${SLOT_NAMES[s]}</small><strong style="color:${item ? RARITY_COLORS[item.rarity] : "inherit"}">${item ? esc(item.name) : s === "weapon" ? "Class weapon" : "Base appearance"}</strong></span></button>${item ? `<button class="secondary compact" data-action="gear-remove:${s}" aria-label="Unequip ${SLOT_NAMES[s]}" ${busy ? "disabled" : ""}>×</button>` : ""}</div>`;
    },
  ).join(
    "",
  )}</div><p class="subtle">Bosses drop unowned gear from your level tier; elites sometimes drop it too. Hero stats apply in PvE. Duels keep equal stats.</p></aside><section><div class="gear-tabs">${(
    [
      ["owned", "My equipment"],
      ["shop", "Mira’s armory"],
      ["collectibles", "Collectibles"],
    ] as const
  )
    .map(
      ([id, label]) =>
        `<button class="secondary compact ${tab === id ? "active" : ""}" data-action="gear-tab:${id}">${label}</button>`,
    )
    .join(
      "",
    )}</div><div class="gear-section-heading"><h3>${tab === "collectibles" ? "Trophies & adornments" : SLOT_NAMES[slot]}</h3><strong>${profile.balance.toLocaleString()} PD</strong></div><p class="subtle">${busy ? "Finish your encounter before changing or buying equipment." : tab === "shop" || tab === "collectibles" ? (guest ? "Connect a Phantom or Solflare wallet to buy equipment. You can still browse and try items on." : atShop ? "You are at Mira’s shop. Purchases go into your equipment collection." : "Browse and try on anything. Visit Mira’s Field Supply in Hearthwick to buy.") : "Select a slot to browse your collection. Equip outside combat. Changing equipment never restores health."}</p><div class="gear-catalog" data-panel-scroll="gear-catalog">${
    rows
      .map((item) => {
        const have = owned.includes(item.id),
          wearing = equipped[item.slot] === item.id,
          usable = gearCanEquip(item, profile.classId, level),
          goal = item.goal,
          progress = goal ? (profile.quests[goal.key] ?? 0) : 0;
        return `<article class="gear-card" style="--rarity:${RARITY_COLORS[item.rarity]}"><div class="gear-card-title">${glyph(item.slot)}<div><span class="eyebrow">${item.rarity} · Level ${item.level}${wearing ? " · EQUIPPED" : have ? " · OWNED" : ""}</span><h3>${esc(item.name)}</h3></div></div><p>${stats(item)}</p><div class="gear-comparison">${wearing ? "Equipped" : comparison(item, GEAR[equipped[item.slot] ?? ""])}</div>${goal ? `<p>${esc(goal.label)} · ${Math.min(progress, goal.count)}/${goal.count}</p><progress value="${Math.min(progress, goal.count)}" max="${goal.count}" aria-label="${esc(goal.label)}"></progress>` : ""}<div class="gear-card-actions"><button class="secondary compact" data-action="gear-preview:${item.id}">Try on</button>${have ? `<button class="primary compact" data-action="gear-equip:${item.id}" ${wearing || busy || !usable ? "disabled" : ""}>${wearing ? "Equipped" : "Equip"}</button>` : goal ? `<button class="primary compact" data-action="gear-claim:${item.id}" ${busy || progress < goal.count ? "disabled" : ""}>Claim collectible</button>` : `<button class="primary compact" data-action="gear-buy:${item.id}" ${busy || guest || !atShop || !usable || profile.balance < item.price ? "disabled" : ""}>Buy · ${item.price} PD</button>`}</div></article>`;
      })
      .join("") ||
    '<div class="empty-state">No equipment in this slot yet. Browse Mira’s armory to find your first upgrade.</div>'
  }</div></section></div>`;
}
