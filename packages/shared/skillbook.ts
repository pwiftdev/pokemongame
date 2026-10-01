import { abilityUnlocked, heroClass, type ClassId } from "./classes";
import { heroLevel } from "./hero";
import type { Profile } from "./types";

export const ACTION_SLOTS = 6;
export interface CombatLoadout {
  slots: (string | null)[];
  layout: "row" | "split";
  labels: boolean;
}
export function defaultLoadout(classId?: ClassId, level = 1): CombatLoadout {
  const learned = heroClass(classId).abilities.filter((a) =>
    abilityUnlocked(a, level),
  );
  return {
    slots: Array.from(
      { length: ACTION_SLOTS },
      (_, i) => learned[i]?.id ?? null,
    ),
    layout: "row",
    labels: true,
  };
}
export function combatLoadout(profile: Profile): CombatLoadout {
  return profile.combat ?? defaultLoadout(profile.classId, heroLevel(profile));
}
export function equippedAbilities(profile: Profile) {
  const skills = heroClass(profile.classId).abilities;
  return combatLoadout(profile).slots.map((id) =>
    skills.find((a) => a.id === id),
  );
}
export function validLoadout(profile: Profile, value: CombatLoadout) {
  if (
    !value ||
    !Array.isArray(value.slots) ||
    value.slots.length !== ACTION_SLOTS ||
    !["row", "split"].includes(value.layout) ||
    typeof value.labels !== "boolean"
  )
    return false;
  const learned = heroClass(profile.classId).abilities.filter((a) =>
    abilityUnlocked(a, heroLevel(profile)),
  );
  const ids = value.slots.filter((id) => id !== null);
  return (
    new Set(ids).size === ids.length &&
    ids.every((id) => learned.some((a) => a.id === id))
  );
}
export function placeSkill(
  loadout: CombatLoadout,
  id: string,
  slot: number,
): CombatLoadout {
  if (!Number.isInteger(slot) || slot < 0 || slot >= ACTION_SLOTS)
    return loadout;
  const slots = [...loadout.slots];
  const before = slots.indexOf(id);
  if (before >= 0) slots[before] = slots[slot];
  slots[slot] = id;
  return { ...loadout, slots };
}
