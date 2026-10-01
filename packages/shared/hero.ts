import { gearStats } from "./gear";
import type { PlayerView, Profile } from "./types";
export function heroLevel(profile: Pick<Profile, "creatures">) {
  return Math.max(1, ...profile.creatures.map((c) => c.level));
}
export function heroMaxHp(profile: Profile) {
  return 140 + heroLevel(profile) * 12 + gearStats(profile).health;
}
export function heroHp(profile: Profile) {
  return profile.heroHp ?? heroMaxHp(profile);
}

export function heroCanWalk(player: Pick<PlayerView, "hp" | "duelId">) {
  return player.hp > 0 || !player.duelId;
}

export const DUEL_LEVEL = 10;
export function heroCombatLevel(
  profile: Pick<Profile, "creatures">,
  dueling: boolean,
) {
  return dueling ? DUEL_LEVEL : heroLevel(profile);
}
