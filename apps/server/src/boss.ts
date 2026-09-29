import {
  attackHits,
  type AttackShape,
} from "../../../packages/shared/combat.js";
export type BossCast = AttackShape;
export const BOSS_ATTACKS = [
  { id: "zap", name: "Storm pulse", radius: 5 },
  { id: "wave", name: "Thunder sweep", radius: 11 },
  { id: "storm", name: "Skyfall", radius: 4 },
] as const;
export function bossCast(
  boss: { x: number; z: number },
  target: { x: number; z: number },
  index: number,
  now: number,
): BossCast {
  const attack = BOSS_ATTACKS[index % 3],
    center = index % 3 === 2 ? target : boss;
  return {
    ability: attack.id,
    name: attack.name,
    startedAt: now,
    shape: index % 3 === 0 ? "cone" : index % 3 === 1 ? "line" : "circle",
    yaw: Math.atan2(target.x - boss.x, target.z - boss.z),
    arc: Math.PI * 1.25,
    width: 3.5,
    resolvesAt: now + 1200,
    x: center.x,
    z: center.z,
    radius: attack.radius,
  };
}
export const castHits = attackHits;
export { RANGED_ELEMENTS } from "../../../packages/shared/combat-rules.js";
const SPELL_NAMES: Record<string, [bolt: string, mend: string]> = {
  leaf: ["Thorn Volley", "Mending Spores"],
  flame: ["Flame Lance", "Cauterize"],
  tide: ["Tidal Lance", "Soothing Tide"],
  stone: ["Stone Shard", "Stoneskin"],
  spark: ["Chain Spark", "Recharge"],
  spirit: ["Hex Bolt", "Dark Mending"],
};
export const SPELL_CAST_MS = { bolt: 1700, mend: 2000, storm: 2600 };
/** An interruptible spell with a cast bar rather than a ground telegraph. */
export function creatureSpell(
  spell: "bolt" | "mend" | "storm",
  source: { x: number; z: number },
  target: string,
  element: string,
  ability: string,
  now: number,
): BossCast {
  return {
    ability,
    name:
      spell === "storm"
        ? "Stormcall"
        : SPELL_NAMES[element]?.[spell === "bolt" ? 0 : 1],
    spell,
    interruptible: true,
    target,
    x: source.x,
    z: source.z,
    radius: 0,
    startedAt: now,
    resolvesAt: now + SPELL_CAST_MS[spell],
  };
}

export function creatureCast(
  ability: string,
  target: { x: number; z: number },
  now: number,
  source = target,
  index = 0,
  element = "leaf",
): BossCast {
  const ranged = ["flame", "tide", "spark", "spirit"].includes(element);
  const charge = !ranged && index % 3 === 2;
  return {
    ability,
    name: charge
      ? "Rushing strike"
      : ranged
        ? "Aimed bolt"
        : index % 2
          ? "Heavy cleave"
          : "Claw strike",
    shape: ranged || charge ? "line" : "cone",
    x: source.x,
    z: source.z,
    yaw: Math.atan2(target.x - source.x, target.z - source.z),
    radius: ranged ? 13 : charge ? 8 : 3.8,
    width: ranged ? 1.8 : 2.4,
    arc: index % 2 ? Math.PI * 1.2 : Math.PI * 0.85,
    charge,
    startedAt: now,
    releasesAt: ranged ? now + 350 : undefined,
    resolvesAt: now + (charge ? 750 : ranged ? 1000 : index % 2 ? 650 : 380),
  };
}
