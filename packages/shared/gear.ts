import { CLASS_IDS, type ClassId } from "./classes";
import type { Profile } from "./types";
export const GEAR_SLOTS = [
  "weapon",
  "chest",
  "shoulders",
  "head",
  "boots",
  "back",
] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];
export interface GearStats {
  power: number;
  armor: number;
  health: number;
}
export interface GearState {
  owned: string[];
  equipped: Partial<Record<GearSlot, string>>;
}
export interface GearItem extends GearStats {
  id: string;
  name: string;
  slot: GearSlot;
  level: number;
  tier: number;
  rarity: "common" | "uncommon" | "rare" | "epic";
  price: number;
  color: string;
  trim: string;
  classId?: ClassId;
  goal?: { key: string; count: number; label: string };
}
export const SLOT_NAMES: Record<GearSlot, string> = {
  weapon: "Weapon",
  chest: "Chest",
  shoulders: "Shoulders",
  head: "Head",
  boots: "Boots",
  back: "Collectible",
};
export const RARITY_COLORS = {
  common: "#d4dced",
  uncommon: "#67df91",
  rare: "#65baff",
  epic: "#c798ff",
};
const tiers = [
  {
    name: "Wayfarer",
    level: 1,
    price: 80,
    color: "#6d879b",
    trim: "#cad4db",
    rarity: "common" as const,
  },
  {
    name: "Wildwood",
    level: 4,
    price: 220,
    color: "#356b53",
    trim: "#b9d890",
    rarity: "uncommon" as const,
  },
  {
    name: "Azureguard",
    level: 8,
    price: 500,
    color: "#3455aa",
    trim: "#91dcff",
    rarity: "rare" as const,
  },
  {
    name: "Emberforged",
    level: 12,
    price: 900,
    color: "#8c3428",
    trim: "#ffba62",
    rarity: "rare" as const,
  },
  {
    name: "Astral",
    level: 16,
    price: 1500,
    color: "#654292",
    trim: "#e1b7ff",
    rarity: "epic" as const,
  },
];
const weapons = {
  knight: "Longsword",
  mage: "Staff",
  rogue: "Twin Daggers",
  barbarian: "Greataxe",
};
const items: GearItem[] = [];
for (const [index, tier] of tiers.entries()) {
  const rank = index + 1;
  for (const classId of CLASS_IDS)
    items.push({
      ...tier,
      id: `${classId}-weapon-${rank}`,
      name: `${tier.name} ${weapons[classId]}`,
      slot: "weapon",
      tier: rank,
      classId,
      power: [4, 8, 14, 20, 28][index],
      armor: 0,
      health: 0,
    });
  for (const slot of ["chest", "shoulders", "head", "boots"] as const)
    items.push({
      ...tier,
      id: `${slot}-${rank}`,
      name: `${tier.name} ${slot === "chest" ? "Armor" : slot === "head" ? "Crown" : SLOT_NAMES[slot]}`,
      slot,
      tier: rank,
      price: Math.round(tier.price * (slot === "chest" ? 0.9 : 0.55)),
      power: 0,
      health: rank * (slot === "chest" ? 24 : 8),
      armor: rank * (slot === "chest" ? 2 : 1),
    });
}
items.push(
  {
    id: "banner-traveler",
    name: "Traveler’s Banner",
    slot: "back",
    tier: 1,
    level: 1,
    price: 180,
    rarity: "uncommon",
    color: "#225e85",
    trim: "#ffda67",
    power: 0,
    health: 0,
    armor: 0,
  },
  {
    id: "sigil-grove",
    name: "Grovekeeper’s Sigil",
    slot: "back",
    tier: 2,
    level: 1,
    price: 450,
    rarity: "rare",
    color: "#3b9870",
    trim: "#a8ffbc",
    power: 0,
    health: 0,
    armor: 0,
  },
  {
    id: "banner-vanguard",
    name: "Vanguard’s Standard",
    slot: "back",
    tier: 3,
    level: 1,
    price: 0,
    rarity: "rare",
    color: "#922e3b",
    trim: "#ffd394",
    power: 0,
    health: 0,
    armor: 0,
    goal: { key: "defeats", count: 25, label: "Defeat 25 creatures" },
  },
  {
    id: "sigil-warden",
    name: "Warden’s Halo",
    slot: "back",
    tier: 4,
    level: 1,
    price: 0,
    rarity: "epic",
    color: "#7954bd",
    trim: "#dbc1ff",
    power: 0,
    health: 0,
    armor: 0,
    goal: { key: "bosses", count: 3, label: "Defeat 3 world bosses" },
  },
);
export const GEAR: Record<string, GearItem> = Object.fromEntries(
  items.map((item) => [item.id, item]),
);
export const GEAR_CATALOG = items;
export const emptyGear = (): GearState => ({ owned: [], equipped: {} });
export function gearStats(
  profile: Pick<Profile, "gear" | "classId">,
): GearStats {
  const stats = { power: 0, armor: 0, health: 0 };
  for (const slot of GEAR_SLOTS) {
    const item = GEAR[profile.gear?.equipped[slot] ?? ""];
    if (
      !item ||
      item.slot !== slot ||
      (item.classId && item.classId !== profile.classId)
    )
      continue;
    stats.power += item.power;
    stats.armor += item.armor;
    stats.health += item.health;
  }
  return stats;
}
export function gearCanEquip(
  item: GearItem,
  classId: ClassId | undefined,
  level: number,
) {
  return (
    !!classId &&
    (!item.classId || item.classId === classId) &&
    level >= item.level
  );
}
export function validGear(profile: Profile) {
  const gear = profile.gear;
  if (!gear) return true;
  if (
    !Array.isArray(gear.owned) ||
    gear.owned.length > items.length ||
    new Set(gear.owned).size !== gear.owned.length ||
    gear.owned.some(
      (id) => typeof id !== "string" || !Object.hasOwn(GEAR, id),
    ) ||
    !gear.equipped ||
    typeof gear.equipped !== "object" ||
    Array.isArray(gear.equipped)
  )
    return false;
  const level = Math.max(1, ...profile.creatures.map((c) => c.level));
  return Object.entries(gear.equipped).every(([slot, id]) => {
    const item = GEAR[id];
    return (
      item &&
      item.slot === slot &&
      gear.owned.includes(id) &&
      gearCanEquip(item, profile.classId, level)
    );
  });
}
export function normalizeGear(profile: Profile) {
  if (!profile.gear) return;
  const owned = Array.isArray(profile.gear.owned)
    ? [...new Set(profile.gear.owned.filter((id) => Object.hasOwn(GEAR, id)))]
    : [];
  const equipped: GearState["equipped"] = {};
  const level = Math.max(1, ...profile.creatures.map((c) => c.level));
  for (const slot of GEAR_SLOTS) {
    const id = profile.gear.equipped?.[slot],
      item = GEAR[id ?? ""];
    if (
      id &&
      item?.slot === slot &&
      owned.includes(id) &&
      gearCanEquip(item, profile.classId, level)
    )
      equipped[slot] = id;
  }
  profile.gear = { owned, equipped };
}
export const armorMultiplier = (armor: number) =>
  1 - Math.min(0.4, Math.max(0, armor) / 100);
