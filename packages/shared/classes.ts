import type { Ability } from "./data";
export const CLASS_IDS = ["knight", "mage", "rogue", "barbarian"] as const;
export type ClassId = (typeof CLASS_IDS)[number];
export type ResourceKind = "valor" | "rage" | "energy" | "mana";
export const RESOURCES: Record<
  ResourceKind,
  { name: string; color: string; description: string }
> = {
  valor: {
    name: "Valor",
    color: "#f2c55c",
    description:
      "Builds as you strike and endure blows. Slowly fades out of combat.",
  },
  rage: {
    name: "Rage",
    color: "#d9483b",
    description:
      "Builds from dealing and taking damage. Fades quickly out of combat.",
  },
  energy: {
    name: "Energy",
    color: "#f4dd58",
    description: "Refills rapidly. Builders earn combo points for finishers.",
  },
  mana: {
    name: "Mana",
    color: "#4f8ff0",
    description: "Regenerates faster when you have not cast for a few seconds.",
  },
};
export interface Weapon {
  name: string;
  /** Milliseconds between automatic swings. */
  speed: number;
  min: number;
  max: number;
  range: number;
}
export interface HeroClass {
  name: string;
  model: string;
  weapon: string;
  offhand?: string;
  role: string;
  description: string;
  resource: ResourceKind;
  swing: Weapon;
  /** Base critical strike chance. */
  crit: number;
  dodge: number;
  parry: number;
  block: number;
  /** Threat generated per point of damage. */
  threat: number;
  abilities: Ability[];
}
export const GCD_MS = 1000;
export const COMBO_MAX = 5;
export const CLASSES: Record<ClassId, HeroClass> = {
  knight: {
    name: "Knight",
    model: "Knight",
    weapon: "1H_Sword",
    offhand: "Badge_Shield",
    role: "Sword & shield · Defender",
    description:
      "Hold the line. Block blows, taunt enemies away from allies and interrupt their spells.",
    resource: "valor",
    swing: { name: "Sword", speed: 2200, min: 8, max: 13, range: 4 },
    crit: 0.06,
    dodge: 0.05,
    parry: 0.07,
    block: 0.25,
    threat: 2,
    abilities: [
      {
        ...skill("slash", "Sword Slash", "stone", 20, 0, 4),
        generate: 15,
        description: "A quick sword strike. Generates 15 Valor.",
      },
      {
        ...skill("shield-strike", "Shield Strike", "stone", 28, 8, 4, "stun"),
        cost: 15,
        interrupt: true,
        description:
          "Bash with your shield, interrupting spells and stunning the target for 0.9s.",
      },
      {
        ...skill("rally", "Second Wind", "leaf", 0, 12, 0, "heal"),
        cost: 30,
        description: "Restore 24% of your health.",
      },
      {
        ...skill("bulwark", "Bulwark", "stone", 0, 12, 0, "guard"),
        offGcd: true,
        description:
          "Raise your shield. Reduce all damage taken by 65% for 4 seconds.",
      },
      {
        ...skill("challenge", "Challenge", "spirit", 4, 8, 20, "taunt"),
        offGcd: true,
        unlock: 2,
        description:
          "Taunt an enemy into attacking you for 3 seconds and take the top of its threat list.",
      },
      {
        ...skill("sweep", "Crusader Sweep", "stone", 22, 6, 5),
        cost: 20,
        aoe: 5,
        aoeSelf: true,
        unlock: 3,
        description:
          "Sweep your blade around you, striking every enemy within 5m.",
      },
    ],
  },
  mage: {
    name: "Mage",
    model: "Mage",
    weapon: "2H_Staff",
    role: "Staff & elemental magic",
    description:
      "Command fire and frost from range. Freeze foes, then shatter them.",
    resource: "mana",
    swing: { name: "Staff", speed: 2600, min: 6, max: 9, range: 4 },
    crit: 0.07,
    dodge: 0.05,
    parry: 0,
    block: 0,
    threat: 1,
    abilities: [
      {
        ...skill("firebolt", "Firebolt", "flame", 21, 0, 18),
        cost: 8,
        description: "Hurl a bolt of fire. 0.55s cast; moving interrupts.",
      },
      {
        ...skill("frostbolt", "Frost Nova", "tide", 30, 6, 16, "slow"),
        cost: 14,
        aoe: 3.2,
        description:
          "Erupt frost at the target, damaging and chilling enemies within 3m.",
      },
      {
        ...skill("meteor", "Meteor", "flame", 44, 10, 20, "burn"),
        cost: 24,
        aoe: 3.2,
        description:
          "Call down a meteor that burns every enemy near the target. 1.2s cast; moving interrupts.",
      },
      {
        ...skill("barrier", "Arcane Barrier", "spirit", 0, 12, 0, "guard"),
        offGcd: true,
        description: "Reduce all damage taken by 65% for 4 seconds.",
      },
      {
        ...skill("counterspell", "Counterspell", "spirit", 6, 12, 20),
        cost: 8,
        interrupt: true,
        offGcd: true,
        unlock: 2,
        description:
          "Interrupt the target's spell and lock out its abilities for 4 seconds.",
      },
      {
        ...skill("icelance", "Ice Lance", "tide", 14, 0, 18),
        cost: 7,
        shatter: true,
        unlock: 3,
        description:
          "An instant shard of ice. Deals triple damage to chilled or stunned targets.",
      },
    ],
  },
  rogue: {
    name: "Rogue",
    model: "Rogue",
    weapon: "Knife",
    offhand: "Knife_Offhand",
    role: "Twin daggers",
    description:
      "Build combo points with fast strikes, then unleash devastating finishers.",
    resource: "energy",
    swing: { name: "Daggers", speed: 1500, min: 5, max: 8, range: 4 },
    crit: 0.12,
    dodge: 0.1,
    parry: 0.04,
    block: 0,
    threat: 0.8,
    abilities: [
      {
        ...skill("stab", "Quick Stab", "spirit", 16, 0, 3.5),
        cost: 30,
        combo: 1,
        description: "A fast strike that awards 1 combo point.",
      },
      {
        ...skill("venom", "Venom Blade", "leaf", 18, 5, 4, "poison"),
        cost: 35,
        combo: 1,
        description:
          "Poison the target for damage over 8 seconds. Awards 1 combo point.",
      },
      {
        ...skill("ambush", "Ambush", "spirit", 36, 8, 5, "stun"),
        cost: 50,
        combo: 2,
        crit: 0.25,
        description:
          "A brutal strike with +25% critical chance that stuns for 0.9s. Awards 2 combo points.",
      },
      {
        ...skill("evasion", "Evasion", "spirit", 0, 14, 0, "evasion"),
        offGcd: true,
        description: "Dodge 50% of incoming attacks for 5 seconds.",
      },
      {
        ...skill("eviscerate", "Eviscerate", "stone", 10, 0, 4),
        cost: 35,
        finisher: 16,
        unlock: 2,
        description:
          "Finisher. Consumes combo points for heavy damage: more points, bigger hit.",
      },
      {
        ...skill("kick", "Kick", "spirit", 6, 10, 4),
        cost: 20,
        interrupt: true,
        offGcd: true,
        unlock: 3,
        description:
          "Interrupt the target's spell and lock out its abilities for 4 seconds.",
      },
    ],
  },
  barbarian: {
    name: "Barbarian",
    model: "Barbarian",
    weapon: "2H_Axe",
    role: "Two-handed axe",
    description:
      "Rage fuels crushing blows. Critical strikes send you into an Enrage.",
    resource: "rage",
    swing: { name: "Great Axe", speed: 3000, min: 15, max: 23, range: 4.5 },
    crit: 0.1,
    dodge: 0.05,
    parry: 0.05,
    block: 0,
    threat: 1.1,
    abilities: [
      {
        ...skill("cleave", "Axe Cleave", "stone", 24, 0, 4.5),
        generate: 12,
        aoe: 2.2,
        description:
          "A wide swing that also hits enemies beside your target. Generates 12 Rage.",
      },
      {
        ...skill("crush", "Skullcrusher", "stone", 42, 6, 4.5, "stun"),
        cost: 30,
        interrupt: true,
        description:
          "A crushing overhead blow that interrupts and stuns for 0.9s.",
      },
      {
        ...skill("blood-rush", "Blood Rush", "flame", 0, 15, 0, "heal"),
        cost: 20,
        description: "Restore 24% of your health.",
      },
      {
        ...skill("ironhide", "Ironhide", "stone", 0, 12, 0, "guard"),
        offGcd: true,
        description: "Reduce all damage taken by 65% for 4 seconds.",
      },
      {
        ...skill("execute", "Execute", "flame", 62, 0, 4.5),
        cost: 25,
        execute: 0.25,
        unlock: 2,
        description:
          "Attempt to finish off a wounded enemy. Only usable below 25% health.",
      },
      {
        ...skill("whirlwind", "Whirlwind", "stone", 26, 8, 5),
        cost: 25,
        aoe: 5,
        aoeSelf: true,
        unlock: 3,
        description: "Spin with your axe, striking every enemy within 5m.",
      },
    ],
  },
};
function skill(
  id: string,
  name: string,
  element: Ability["element"],
  power: number,
  cooldown: number,
  range: number,
  effect?: Ability["effect"],
): Ability {
  return { id, name, element, power, cooldown, range, effect, description: "" };
}
export function heroClass(id?: ClassId) {
  return CLASSES[id ?? "knight"];
}
export function abilityUnlocked(ability: Ability, level: number) {
  return level >= (ability.unlock ?? 1);
}
