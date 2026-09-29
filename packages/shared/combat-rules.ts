import type { HeroClass, ResourceKind } from "./classes";
import type { Ability } from "./data";

export type Outcome =
  | "hit"
  | "crit"
  | "miss"
  | "dodge"
  | "parry"
  | "block"
  | "immune"
  | "evade";
export interface HitChances {
  miss: number;
  dodge: number;
  parry: number;
  block: number;
  crit: number;
}
/** Single-roll attack table in the classic order: miss, dodge, parry, block, crit, hit. */
export function rollOutcome(c: HitChances, roll = Math.random()): Outcome {
  const table: [Outcome, number][] = [
    ["miss", c.miss],
    ["dodge", c.dodge],
    ["parry", c.parry],
    ["block", c.block],
    ["crit", c.crit],
  ];
  let edge = 0;
  for (const [outcome, chance] of table) {
    edge += Math.max(0, chance);
    if (roll < edge) return outcome;
  }
  return "hit";
}
export const landed = (outcome: Outcome) =>
  outcome === "hit" || outcome === "crit" || outcome === "block";
export function outcomeScale(outcome: Outcome, spell: boolean) {
  return outcome === "crit"
    ? spell
      ? 1.6
      : 2
    : outcome === "block"
      ? 0.5
      : landed(outcome)
        ? 1
        : 0;
}
/** ±10% damage variance. */
export const variance = (roll = Math.random()) => 0.9 + roll * 0.2;

export const isSpell = (ability: Ability) => ability.range > 6;
/** Creature elements that fight from range with bolts. */
export const RANGED_ELEMENTS: string[] = ["flame", "tide", "spark", "spirit"];
/** A hero attacking a wild creature. */
export function heroAttackChances(
  cls: HeroClass,
  ability: Ability | undefined,
  heroLevel: number,
  targetLevel: number,
): HitChances {
  const gap = Math.max(0, targetLevel - heroLevel);
  const spell = !!ability && isSpell(ability);
  return {
    miss: (ability ? 0.03 : 0.05) + gap * 0.02,
    dodge: spell ? 0 : 0.04 + gap * 0.01,
    parry: 0,
    block: 0,
    crit: Math.min(0.6, cls.crit + (ability?.crit ?? 0)),
  };
}
/** A wild creature attacking a hero. */
export function creatureAttackChances(
  cls: HeroClass,
  creatureLevel: number,
  heroLevel: number,
  options: { melee: boolean; evasion: boolean; elite: boolean },
): HitChances {
  const gap = Math.max(0, heroLevel - creatureLevel);
  return {
    miss: 0.04 + gap * 0.01,
    dodge: cls.dodge + (options.evasion ? 0.5 : 0),
    parry: options.melee ? cls.parry : 0,
    block: cls.block,
    crit: options.elite ? 0.08 : 0.05,
  };
}
export function swingDamage(
  cls: HeroClass,
  level: number,
  roll = Math.random(),
) {
  const { min, max } = cls.swing;
  return (min + (max - min) * roll) * (1 + (Math.max(1, level) - 1) * 0.12);
}

export function resourceMax(kind: ResourceKind, level: number) {
  return kind === "mana" ? 100 + (Math.max(1, level) - 1) * 10 : 100;
}
export function resourceStart(kind: ResourceKind, level: number) {
  return kind === "mana" || kind === "energy" ? resourceMax(kind, level) : 0;
}
/** Resource after `seconds` of regeneration or decay. */
export function regenResource(
  kind: ResourceKind,
  value: number,
  max: number,
  seconds: number,
  inCombat: boolean,
  sinceCastMs = Infinity,
) {
  const rate =
    kind === "energy"
      ? 12
      : kind === "mana"
        ? max * (sinceCastMs < 4000 ? 0.025 : inCombat ? 0.06 : 0.15)
        : inCombat
          ? 0
          : kind === "rage"
            ? -4
            : -2;
  return Math.max(0, Math.min(max, value + rate * seconds));
}
/** Resource earned by a hero landing damage. */
export function resourceFromDealt(
  kind: ResourceKind,
  damage: number,
  auto: boolean,
) {
  if (kind === "rage") return auto ? Math.max(5, damage * 0.45) : 0;
  if (kind === "valor") return auto ? 6 : 0;
  return 0;
}
/** Resource earned by a hero taking damage. */
export function resourceFromTaken(
  kind: ResourceKind,
  damage: number,
  blocked: boolean,
) {
  if (kind === "rage") return damage * 0.9;
  if (kind === "valor") return damage * 0.6 + (blocked ? 5 : 0);
  return 0;
}

/** The creature's target: taunts win, otherwise switch only when someone exceeds 110% of the current target's threat. */
export function threatLeader(
  table: Map<string, number>,
  current?: string,
  forced?: string,
) {
  if (forced && table.has(forced)) return forced;
  let top: string | undefined,
    topThreat = -1;
  for (const [id, threat] of table)
    if (threat > topThreat) {
      top = id;
      topThreat = threat;
    }
  const held = current !== undefined ? table.get(current) : undefined;
  return held !== undefined && topThreat <= held * 1.1 ? current : top;
}

export type Difficulty = "trivial" | "easy" | "even" | "hard" | "deadly";
/** Classic difficulty colouring of an enemy level relative to yours. */
export function difficulty(targetLevel: number, heroLevel: number): Difficulty {
  const gap = targetLevel - heroLevel;
  return gap >= 5
    ? "deadly"
    : gap >= 3
      ? "hard"
      : gap >= -2
        ? "even"
        : gap >= -5
          ? "easy"
          : "trivial";
}

export type AuraId =
  | "guard"
  | "stun"
  | "slow"
  | "burn"
  | "poison"
  | "evasion"
  | "enrage"
  | "taunted"
  | "silenced";
export interface AuraView {
  id: AuraId;
  until: number;
  duration: number;
  /** Ability that applied it, for naming. */
  ability?: string;
  source?: string;
}
export const AURAS: Record<
  AuraId,
  { name: string; debuff: boolean; color: string; description: string }
> = {
  guard: {
    name: "Guarded",
    debuff: false,
    color: "#7fc6f0",
    description: "Damage taken reduced by 65%.",
  },
  evasion: {
    name: "Evasion",
    debuff: false,
    color: "#b7e3d6",
    description: "Dodge chance increased by 50%.",
  },
  enrage: {
    name: "Enrage",
    debuff: false,
    color: "#e2543f",
    description: "Damage dealt increased by 20%.",
  },
  stun: {
    name: "Stunned",
    debuff: true,
    color: "#f3d36b",
    description: "Cannot move, attack or cast.",
  },
  slow: {
    name: "Chilled",
    debuff: true,
    color: "#8fd7ff",
    description: "Movement slowed.",
  },
  burn: {
    name: "Burning",
    debuff: true,
    color: "#ff8a4a",
    description: "Taking fire damage over time.",
  },
  poison: {
    name: "Poisoned",
    debuff: true,
    color: "#95d45b",
    description: "Taking nature damage over time.",
  },
  taunted: {
    name: "Taunted",
    debuff: true,
    color: "#e8b35e",
    description: "Forced to attack the taunter.",
  },
  silenced: {
    name: "Interrupted",
    debuff: true,
    color: "#c7a4ff",
    description: "Special abilities locked out.",
  },
};
export const ENRAGE_MS = 6000;
export const EVASION_MS = 5000;
export const TAUNT_MS = 3000;
export const LOCKOUT_MS = 4000;
export const DOT_MS = 8000;
/** Out-of-combat health regeneration, as a fraction of maximum per second. */
export const OUT_OF_COMBAT_REGEN = 0.025;
export const REGEN_DELAY_MS = 5000;
