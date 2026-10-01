import { describe, expect, it } from "vitest";
import {
  creatureAttackChances,
  difficulty,
  heroAttackChances,
  landed,
  outcomeScale,
  regenResource,
  resourceFromDealt,
  resourceFromTaken,
  resourceMax,
  resourceStart,
  rollOutcome,
  swingDamage,
  threatLeader,
} from "../packages/shared/combat-rules";
import {
  CLASSES,
  CLASS_IDS,
  abilityUnlocked,
} from "../packages/shared/classes";
import { ABILITIES } from "../packages/shared/data";
import { moveAmongCreatures } from "../packages/shared/rules";
import {
  applyAura,
  auraViews,
  clearAuras,
  dueTicks,
  hasAura,
  type AuraHolder,
} from "../apps/server/src/auras";
import {
  abilityAvailability,
  abilityHighlighted,
} from "../apps/client/src/ui/combat";
import type { PlayerView, WildView } from "../packages/shared/types";

describe("hit table", () => {
  const chances = { miss: 0.1, dodge: 0.1, parry: 0.1, block: 0.1, crit: 0.1 };
  it("resolves one roll in miss, dodge, parry, block, crit, hit order", () => {
    expect(rollOutcome(chances, 0.05)).toBe("miss");
    expect(rollOutcome(chances, 0.15)).toBe("dodge");
    expect(rollOutcome(chances, 0.25)).toBe("parry");
    expect(rollOutcome(chances, 0.35)).toBe("block");
    expect(rollOutcome(chances, 0.45)).toBe("crit");
    expect(rollOutcome(chances, 0.55)).toBe("hit");
  });
  it("scales damage by outcome, with spells critting for less", () => {
    expect(outcomeScale("crit", false)).toBe(2);
    expect(outcomeScale("crit", true)).toBe(1.6);
    expect(outcomeScale("block", false)).toBe(0.5);
    expect(outcomeScale("dodge", false)).toBe(0);
    expect(landed("block")).toBe(true);
    expect(landed("parry")).toBe(false);
  });
  it("makes higher-level enemies harder to hit and spells undodgeable", () => {
    const mage = CLASSES.mage;
    const even = heroAttackChances(mage, ABILITIES.firebolt, 5, 5);
    const higher = heroAttackChances(mage, ABILITIES.firebolt, 5, 8);
    expect(higher.miss).toBeGreaterThan(even.miss);
    expect(even.dodge).toBe(0);
    expect(
      heroAttackChances(CLASSES.rogue, ABILITIES.stab, 5, 5).dodge,
    ).toBeGreaterThan(0);
    expect(
      heroAttackChances(CLASSES.rogue, ABILITIES.ambush, 1, 1).crit,
    ).toBeCloseTo(0.37);
  });
  it("gives knights blocks and parries and doubles dodge under Evasion", () => {
    const knight = creatureAttackChances(CLASSES.knight, 3, 3, {
      melee: true,
      evasion: false,
      elite: false,
    });
    expect(knight.block).toBe(0.25);
    expect(knight.parry).toBeGreaterThan(0);
    const rogue = creatureAttackChances(CLASSES.rogue, 3, 3, {
      melee: false,
      evasion: true,
      elite: false,
    });
    expect(rogue.parry).toBe(0);
    expect(rogue.dodge).toBeCloseTo(0.6);
  });
  it("scales weapon swings with level", () => {
    expect(swingDamage(CLASSES.barbarian, 1, 0)).toBe(15);
    expect(swingDamage(CLASSES.barbarian, 11, 1)).toBeCloseTo(23 * 2.2);
  });
});

describe("class resources", () => {
  it("starts rage and valor empty, energy and mana full", () => {
    expect(resourceStart("rage", 3)).toBe(0);
    expect(resourceStart("valor", 3)).toBe(0);
    expect(resourceStart("energy", 3)).toBe(100);
    expect(resourceStart("mana", 3)).toBe(resourceMax("mana", 3));
    expect(resourceMax("mana", 3)).toBe(120);
  });
  it("regenerates energy steadily, mana faster after casting stops, and decays rage out of combat", () => {
    expect(regenResource("energy", 10, 100, 1, true)).toBe(22);
    const casting = regenResource("mana", 0, 100, 1, true, 1000);
    const resting = regenResource("mana", 0, 100, 1, true, 9000);
    expect(resting).toBeGreaterThan(casting);
    expect(regenResource("rage", 50, 100, 1, true)).toBe(50);
    expect(regenResource("rage", 50, 100, 1, false)).toBe(46);
    expect(regenResource("valor", 1, 100, 1, false)).toBe(0);
    expect(regenResource("energy", 99, 100, 1, false)).toBe(100);
  });
  it("earns rage and valor from dealing and taking damage", () => {
    expect(resourceFromDealt("rage", 20, true)).toBe(9);
    expect(resourceFromDealt("rage", 2, true)).toBe(5);
    expect(resourceFromDealt("mana", 20, true)).toBe(0);
    expect(resourceFromTaken("valor", 10, true)).toBe(11);
    expect(resourceFromTaken("energy", 10, false)).toBe(0);
  });
  it("gives every class a growing skill library with builders and spenders", () => {
    for (const id of CLASS_IDS) {
      const abilities = CLASSES[id].abilities;
      expect(abilities.length).toBeGreaterThanOrEqual(8);
      expect(abilities.filter((a) => abilityUnlocked(a, 1))).toHaveLength(1);
      expect(abilities.every((a) => abilityUnlocked(a, 10))).toBe(true);
      expect(abilities.some((a) => a.cost)).toBe(true);
      expect(abilities.some((a) => a.interrupt || a.effect === "taunt")).toBe(
        true,
      );
    }
  });
});

describe("threat", () => {
  it("keeps the current target until someone exceeds 110% of its threat", () => {
    const table = new Map([
      ["tank", 100],
      ["mage", 109],
    ]);
    expect(threatLeader(table, "tank")).toBe("tank");
    table.set("mage", 111);
    expect(threatLeader(table, "tank")).toBe("mage");
    expect(threatLeader(table, undefined)).toBe("mage");
  });
  it("lets a taunt override the threat table", () => {
    const table = new Map([
      ["tank", 1],
      ["mage", 500],
    ]);
    expect(threatLeader(table, "mage", "tank")).toBe("tank");
    expect(threatLeader(new Map(), undefined)).toBeUndefined();
  });
  it("colours enemy levels by difficulty", () => {
    expect(difficulty(10, 3)).toBe("deadly");
    expect(difficulty(6, 3)).toBe("hard");
    expect(difficulty(4, 3)).toBe("even");
    expect(difficulty(1, 5)).toBe("easy");
    expect(difficulty(1, 12)).toBe("trivial");
  });
});

describe("auras", () => {
  const holder = (): AuraHolder => ({
    auras: new Map(),
    guardUntil: 0,
    stunUntil: 0,
    slowUntil: 0,
  });
  it("mirrors guard, stun and slow into the fields other rules read", () => {
    const h = holder();
    applyAura(h, "stun", 1000, 900, { ability: "crush" });
    applyAura(h, "evasion", 1000, 5000);
    expect(h.stunUntil).toBe(1900);
    expect(hasAura(h, "stun", 1500)).toBe(true);
    expect(hasAura(h, "evasion", 7000)).toBe(false);
    expect(
      auraViews(h, 1500)
        .map((a) => a.id)
        .sort(),
    ).toEqual(["evasion", "stun"]);
    h.stunUntil = 0;
    expect(auraViews(h, 1500).map((a) => a.id)).toEqual(["evasion"]);
    clearAuras(h);
    expect(auraViews(h, 1500)).toEqual([]);
  });
  it("ticks damage over time once per second until it expires", () => {
    const h = holder();
    applyAura(h, "poison", 0, 3000, { tick: 4 });
    expect(dueTicks(h, 500)).toHaveLength(0);
    expect(dueTicks(h, 1000)).toHaveLength(1);
    expect(dueTicks(h, 1100)).toHaveLength(0);
    expect(dueTicks(h, 2000)).toHaveLength(1);
    expect(dueTicks(h, 3000)).toHaveLength(1);
    expect(dueTicks(h, 4000)).toHaveLength(0);
  });
});

describe("creature bodies", () => {
  const creature = { x: -12, z: -5, hp: 30 };
  it("lets an overlapping player slide around a body without moving deeper", () => {
    const start = { x: -12, z: -5.6 };
    const inward = moveAmongCreatures(start.x, start.z, 0, 0.3, [creature]);
    expect(inward).toEqual(start);
    const slide = moveAmongCreatures(start.x, start.z, 0.3, 0.3, [creature]);
    expect(slide.x).toBeGreaterThan(start.x);
    expect(Math.hypot(slide.x + 12, slide.z + 5)).toBeGreaterThanOrEqual(0.6);
  });
});

describe("ability eligibility", () => {
  const self: PlayerView = {
    id: "self",
    nickname: "Explorer",
    x: -40,
    z: 6,
    yaw: 0,
    moving: false,
    companion: "bulbasaur",
    companionLevel: 1,
    companionEvolved: false,
    hp: 100,
    maxHp: 152,
    level: 1,
    resource: 10,
    resourceMax: 100,
    combo: 0,
    classId: "rogue",
  };
  const target: WildView = {
    id: "wild",
    species: "spriglet",
    x: -41,
    z: 7,
    hp: 20,
    maxHp: 90,
    level: 1,
    state: "chase",
    elite: false,
    boss: false,
    phase: 1,
  };
  const check = (id: string, view = self, gcd = 0) =>
    abilityAvailability(ABILITIES[id], view, target, 0, 100, false, 100, gcd);
  it("reports locks, resources, combo points and the global cooldown", () => {
    expect(check("kick")).toBe("Unlocks at level 6");
    expect(check("stab")).toBe("Not enough Energy");
    expect(check("stab", { ...self, resource: 40 }, 500)).toBe("Recharging");
    expect(check("evasion", { ...self, level: 7 }, 500)).toBe("Ready");
    expect(check("eviscerate", { ...self, level: 5, resource: 40 })).toBe(
      "Build combo points first",
    );
    expect(check("stab", { ...self, resource: 40 })).toBe("Ready");
  });
  it("highlights finishers, executes and interrupts when they matter", () => {
    expect(abilityHighlighted(ABILITIES.execute, self, target, 0)).toBe(true);
    expect(
      abilityHighlighted(
        ABILITIES.eviscerate,
        { ...self, combo: 4 },
        target,
        0,
      ),
    ).toBe(true);
    const casting = {
      ...target,
      cast: {
        ability: "wisp",
        resolvesAt: 900,
        x: 0,
        z: 0,
        radius: 0,
        spell: "bolt" as const,
        interruptible: true,
      },
    };
    expect(abilityHighlighted(ABILITIES.kick, self, casting, 100)).toBe(true);
    expect(abilityHighlighted(ABILITIES.kick, self, target, 100)).toBe(false);
  });
});
