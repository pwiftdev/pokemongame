import {
  normalizeAppearance,
  validAppearance,
} from "../../../packages/shared/appearance.js";
import { CLASS_IDS } from "../../../packages/shared/classes.js";
import { SPECIES } from "../../../packages/shared/data.js";
import { POKEMON, STAT_KEYS } from "../../../packages/shared/pokemon.js";
import {
  equippedMoves,
  individualValues,
  NATURES,
  pokemonStats,
} from "../../../packages/shared/pokemon-rules.js";
import { heroMaxHp } from "../../../packages/shared/hero.js";
import type { Profile } from "../../../packages/shared/types.js";
export function validateProfile(profile: Profile) {
  if (profile.appearance && !validAppearance(profile.appearance))
    throw new Error("Invalid character appearance.");
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
      !SPECIES[c.species] ||
      !Number.isFinite(c.maxHp) ||
      c.maxHp <= 0 ||
      (c.nature !== undefined && !Object.hasOwn(NATURES, c.nature)) ||
      (c.ivs !== undefined &&
        STAT_KEYS.some(
          (key) =>
            !Number.isInteger(c.ivs![key]) ||
            c.ivs![key] < 0 ||
            c.ivs![key] > 31,
        )) ||
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
  profile.appearance = normalizeAppearance(profile.appearance);
  for (const c of profile.creatures) {
    if (c.dataVersion === 1) continue;
    const old = SPECIES[c.species];
    const species = old?.companion
      ? c.species
      : old?.element === "flame" || old?.element === "spark"
        ? "charmander"
        : old?.element === "tide" || old?.element === "stone"
          ? "squirtle"
          : "bulbasaur";
    const ratio = Math.max(0, Math.min(1, c.hp / Math.max(1, c.maxHp)));
    c.species = c.evolved
      ? (POKEMON[species].evolutions[0]?.species ?? species)
      : species;
    c.ivs = individualValues(c.id);
    c.nature = "Hardy";
    c.shiny ??= false;
    c.maxHp = pokemonStats(c.species, c.level, c.ivs, c.nature).hp;
    c.hp = Math.round(c.maxHp * ratio);
    c.moves = equippedMoves(c.species, c.level);
    c.dataVersion = 1;
  }
  profile.pokedex ??= { seen: [], caught: [], rewards: [] };
  for (const c of profile.creatures) {
    if (!profile.pokedex.seen.includes(c.species))
      profile.pokedex.seen.push(c.species);
    if (!profile.pokedex.caught.includes(c.species))
      profile.pokedex.caught.push(c.species);
  }
  profile.heroHp ??= heroMaxHp(profile);
  profile.waystones ??= ["waystone-town"];
  for (const id of profile.waystones)
    profile.quests[`attune:${id.replace("waystone-", "")}`] = 1;
  return profile;
}
