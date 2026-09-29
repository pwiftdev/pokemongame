import { CLASS_IDS } from "../../../packages/shared/classes.js";
import { SPECIES } from "../../../packages/shared/data.js";
import { maxHp } from "../../../packages/shared/rules.js";
import { heroMaxHp } from "../../../packages/shared/hero.js";
import type { Profile } from "../../../packages/shared/types.js";
export function validateProfile(profile: Profile) {
  if (profile.classId && !CLASS_IDS.includes(profile.classId))
    throw new Error("Invalid class.");
  if (
    profile.heroHp !== undefined &&
    (!Number.isFinite(profile.heroHp) ||
      profile.heroHp < 0 ||
      profile.heroHp > heroMaxHp(profile))
  )
    throw new Error("Invalid hero health.");
  if (!Number.isSafeInteger(profile.balance) || profile.balance < 0)
    throw new Error("Invalid balance.");
  if (
    new Set(profile.team).size !== profile.team.length ||
    profile.team.length > 3 ||
    profile.team.some((id) => !profile.creatures.some((c) => c.id === id)) ||
    (profile.active !== null && !profile.team.includes(profile.active))
  )
    throw new Error("Invalid team.");
  if (
    new Set(profile.creatures.map((c) => c.id)).size !==
    profile.creatures.length
  )
    throw new Error("Duplicate creature identity.");
  if (
    Object.values(profile.inventory).some(
      (count) => !Number.isSafeInteger(count) || count < 0,
    )
  )
    throw new Error("Invalid inventory.");
  for (const c of profile.creatures)
    if (
      !Number.isInteger(c.level) ||
      c.level < 1 ||
      c.level > 20 ||
      !Number.isFinite(c.hp) ||
      c.hp < 0 ||
      c.hp > c.maxHp ||
      !Number.isSafeInteger(c.xp) ||
      c.xp < 0
    )
      throw new Error("Invalid creature state.");
}

export function normalizeProfile(profile: Profile): Profile {
  for (const c of profile.creatures) {
    const old = SPECIES[c.species];
    if (!old || old.companion) continue;
    const species =
      old.element === "flame" || old.element === "spark"
        ? "charmander"
        : old.element === "tide" || old.element === "stone"
          ? "squirtle"
          : "bulbasaur";
    const ratio = c.hp / Math.max(1, c.maxHp);
    c.species = species;
    c.maxHp = maxHp(species, c.level, c.evolved);
    c.hp = Math.round(c.maxHp * ratio);
    const moves = SPECIES[species].moves;
    c.moves = [
      moves[0],
      ...(c.level >= 3 ? [moves[1]] : []),
      ...(c.level >= 5 ? [moves[2]] : []),
      moves[3],
    ];
  }
  profile.heroHp ??= heroMaxHp(profile);
  profile.waystones ??= ["waystone-town"];
  for (const id of profile.waystones)
    profile.quests[`attune:${id.replace("waystone-", "")}`] = 1;
  return profile;
}
