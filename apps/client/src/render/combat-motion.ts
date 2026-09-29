import { ABILITIES } from "../../../../packages/shared/data";
import type { ClassId } from "../../../../packages/shared/classes";
import clips from "./hero-clips.json";

export function combatMotion(classId: ClassId, abilityId?: string, combo = 0) {
  const ability = ABILITIES[abilityId ?? ""];
  if (ability?.effect === "guard" || ability?.effect === "evasion")
    return { clip: "Block", duration: 0.45, impact: 0.05 };
  if (ability?.effect === "heal" || abilityId === "challenge")
    return { clip: "Spellcast_Raise", duration: 0.7, impact: 0.2 };
  if (abilityId === "shield-strike")
    return { clip: "Block_Attack", duration: 0.5, impact: 0.2 };
  if (classId === "mage") {
    const quick = abilityId === "icelance" || abilityId === "counterspell";
    return {
      clip:
        abilityId === "meteor"
          ? "Spellcast_Long"
          : abilityId === "frostbolt"
            ? "Spellcast_Raise"
            : "Spellcast_Shoot",
      duration:
        abilityId === "meteor"
          ? 1.45
          : abilityId === "frostbolt"
            ? 0.65
            : quick || !abilityId
              ? 0.5
              : 0.85,
      impact:
        abilityId === "meteor"
          ? 1.2
          : abilityId === "frostbolt"
            ? 0.4
            : quick || !abilityId
              ? 0.14
              : 0.55,
    };
  }
  const sequence =
    classId === "barbarian"
      ? clips.Barbarian
      : classId === "rogue"
        ? clips.Rogue
        : clips.Knight;
  const signature: Record<string, number> = {
    crush: 1,
    execute: 1,
    whirlwind: 2,
    sweep: 1,
    eviscerate: 2,
  };
  const spin = abilityId === "whirlwind";
  return {
    clip: sequence[
      signature[abilityId ?? ""] ?? combo % (classId === "barbarian" ? 2 : 3)
    ],
    duration: spin
      ? 0.7
      : classId === "rogue"
        ? 0.42
        : classId === "barbarian"
          ? 0.78
          : 0.56,
    impact: spin
      ? 0.26
      : classId === "rogue"
        ? 0.14
        : classId === "barbarian"
          ? 0.32
          : 0.23,
  };
}

export function movementScale(
  stunUntil: number | undefined,
  slowUntil: number | undefined,
  now: number,
) {
  return (stunUntil ?? 0) > now ? 0 : (slowUntil ?? 0) > now ? 0.55 : 1;
}

export function projectileDuration(
  abilityId: string | undefined,
  distance: number,
) {
  return abilityId === "meteor"
    ? 0.46
    : Math.max(0.2, Math.min(0.5, distance / 28));
}
export function impactDelay(
  abilityId: string | undefined,
  distance: number,
  windup: number,
  hero: boolean,
) {
  const ability = ABILITIES[abilityId ?? ""];
  if (["guard", "heal", "evasion"].includes(ability?.effect ?? "")) return 0;
  if (abilityId === "frostbolt") return windup + 0.15;
  if (hero && ability && ability.range <= 5) return windup + 0.02;
  return windup + projectileDuration(abilityId, distance);
}
