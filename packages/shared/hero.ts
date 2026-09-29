import type { Profile } from "./types";
export function heroLevel(profile: Pick<Profile, "creatures">) {
  return Math.max(1, ...profile.creatures.map((c) => c.level));
}
export function heroMaxHp(profile: Profile) {
  return 140 + heroLevel(profile) * 12;
}
export function heroHp(profile: Profile) {
  return profile.heroHp ?? heroMaxHp(profile);
}
