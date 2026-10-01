import {
  GEAR,
  emptyGear,
  gearCanEquip,
  type GearSlot,
} from "../../../packages/shared/gear.js";
import { heroHp, heroLevel, heroMaxHp } from "../../../packages/shared/hero.js";
import type { Profile } from "../../../packages/shared/types.js";
import type { Transaction } from "./db.js";
function itemFor(profile: Profile, id: string) {
  const item = Object.hasOwn(GEAR, id) ? GEAR[id] : undefined;
  if (!item) throw new Error("Unknown equipment.");
  if (!gearCanEquip(item, profile.classId, heroLevel(profile)))
    throw new Error(
      `Requires level ${item.level}${item.classId ? ` ${item.classId}` : ""}.`,
    );
  return item;
}
export async function buyGear(
  profile: Profile,
  tx: Transaction,
  id: string,
  reference: string,
) {
  const item = itemFor(profile, id);
  if (item.goal)
    throw new Error("Earn this collectible through its achievement.");
  const gear = (profile.gear ??= emptyGear());
  if (gear.owned.includes(id))
    throw new Error("You already own this equipment.");
  if (
    !(await tx.credit(
      profile,
      -item.price,
      `equipment: ${item.name}`,
      reference,
    ))
  )
    throw new Error("This purchase was already processed.");
  gear.owned.push(id);
}
export function equipGear(profile: Profile, slot: GearSlot, id: string | null) {
  const gear = (profile.gear ??= emptyGear());
  if (id) {
    const item = itemFor(profile, id);
    if (item.slot !== slot || !gear.owned.includes(id))
      throw new Error("You do not own equipment for that slot.");
  }
  const hp = heroHp(profile);
  if (id) gear.equipped[slot] = id;
  else delete gear.equipped[slot];
  profile.heroHp = Math.min(hp, heroMaxHp(profile));
}
export function claimCollectible(profile: Profile, id: string) {
  const item = itemFor(profile, id),
    gear = (profile.gear ??= emptyGear());
  if (!item.goal || (profile.quests[item.goal.key] ?? 0) < item.goal.count)
    throw new Error("Complete this collectible’s achievement first.");
  if (gear.owned.includes(id))
    throw new Error("This collectible is already in your collection.");
  gear.owned.push(id);
}

export function awardEncounterGear(
  profile: Profile,
  encounter: string,
  boss: boolean,
  elite: boolean,
) {
  if (!boss && !elite) return undefined;
  let seed = 2166136261;
  for (const char of `${encounter}:${profile.id}`)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  if (!boss && seed % 4 !== 0) return undefined;
  const gear = (profile.gear ??= emptyGear()),
    level = heroLevel(profile);
  const eligible = Object.values(GEAR).filter(
    (item) =>
      item.slot !== "back" && gearCanEquip(item, profile.classId, level),
  );
  const tier = Math.max(1, ...eligible.map((item) => item.tier));
  const candidates = eligible.filter(
    (item) => item.tier === tier && !gear.owned.includes(item.id),
  );
  const item = candidates[seed % Math.max(1, candidates.length)];
  if (item) gear.owned.push(item.id);
  return item;
}
