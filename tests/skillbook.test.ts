import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { CLASSES, CLASS_IDS } from "../packages/shared/classes";
import {
  defaultLoadout,
  combatLoadout,
  equippedAbilities,
  placeSkill,
  validLoadout,
} from "../packages/shared/skillbook";
import { mobilityDestination } from "../packages/shared/class-mobility";
import { PLACES } from "../packages/shared/data";
import { distance, walkable } from "../packages/shared/rules";
import { makeCreature, abilityFor } from "../apps/server/src/gameplay";
import { normalizeProfile, validateProfile } from "../apps/server/src/profile";
import { commandSchema } from "../apps/server/src/commands";
import {
  hiddenHero,
  revealHero,
  vanishHero,
} from "../apps/server/src/class-combat";
import type { Profile } from "../packages/shared/types";
import type { Player, Wild } from "../apps/server/src/room";
function profile(level = 1): Profile {
  const c = makeCreature("bulbasaur", level);
  return {
    id: "rogue",
    nickname: "Explorer",
    classId: "rogue",
    balance: 0,
    creatures: [c],
    team: [c.id],
    active: c.id,
    inventory: {},
    quests: {},
    claimed: [],
    discoveries: [],
    wins: 0,
    losses: 0,
  };
}
describe("class progression and saved bars", () => {
  it("starts each class with exactly one skill and unlocks a full library", () => {
    for (const id of CLASS_IDS) {
      expect(defaultLoadout(id).slots.filter(Boolean)).toEqual([
        CLASSES[id].abilities[0].id,
      ]);
      expect(CLASSES[id].abilities.some((a) => a.mobility)).toBe(true);
      expect(
        CLASSES[id].abilities.every((a) => a.unlock! >= 1 && a.unlock! <= 10),
      ).toBe(true);
      expect(defaultLoadout(id, 10).slots.filter(Boolean)).toHaveLength(6);
    }
    expect(defaultLoadout("mage", 2).slots[1]).toBe("blink");
    expect(defaultLoadout("rogue", 2).slots[1]).toBe("vanish");
  });
  it("checks ownership, real unlock level, unique slots and exact shape", () => {
    const p = profile(),
      base = defaultLoadout("rogue");
    expect(validLoadout(p, base)).toBe(true);
    for (const id of ["vanish", "firebolt", "forged", "stab"])
      expect(
        validLoadout(p, {
          ...base,
          slots: ["stab", id, null, null, null, null],
        }),
      ).toBe(false);
    expect(validLoadout(p, { ...base, slots: [] })).toBe(false);
    expect(
      commandSchema.safeParse({
        kind: "combatLoadout",
        requestId: randomUUID(),
        ...base,
        slots: ["stab"],
      }).success,
    ).toBe(false);
    expect(
      validLoadout(profile(10), {
        ...base,
        slots: [
          "stab",
          "vanish",
          "shadowstep",
          "kick",
          "ambush",
          "fan-of-knives",
        ],
      }),
    ).toBe(true);
  });
  it("swaps equipped skills without duplication and leaves other slots alone", () => {
    const bar = defaultLoadout("rogue", 10);
    const swapped = placeSkill(bar, "stab", 3);
    expect(swapped.slots[3]).toBe("stab");
    expect(swapped.slots[0]).toBe("shadowstep");
    expect(bar.slots[0]).toBe("stab");
    expect(placeSkill(bar, "stab", -1)).toBe(bar);
    expect(placeSkill(bar, "stab", 6)).toBe(bar);
  });
  it("preserves custom bars across profile normalization and recovers invalid old bars", () => {
    const p = profile(10);
    p.combat = {
      slots: [
        "vanish",
        null,
        "ambush",
        "shadowstep",
        "evasion",
        "fan-of-knives",
      ],
      layout: "split",
      labels: false,
    };
    const saved = structuredClone(p.combat);
    normalizeProfile(p);
    validateProfile(p);
    expect(combatLoadout(p)).toEqual(saved);
    expect(abilityFor(p, 0).id).toBe("vanish");
    expect(() => abilityFor(p, 1)).toThrow();
    expect(equippedAbilities(p)[5]?.id).toBe("fan-of-knives");
    p.combat.slots[0] = "firebolt";
    expect(() => validateProfile(p)).toThrow();
    normalizeProfile(p);
    expect(p.combat).toBeUndefined();
    expect(combatLoadout(p)).toEqual(defaultLoadout("rogue", 10));
  });
});
describe("class movement collision", () => {
  it("blinks nine metres and stops before a building", () => {
    expect(mobilityDestination({ x: -12, z: -5 }, 0)).toEqual({ x: -12, z: 4 });
    const end = mobilityDestination({ x: -39, z: 10 }, Math.PI / 2);
    expect(end.x).toBeLessThan(-38);
    expect(walkable(end.x, end.z)).toBe(true);
  });
  it("stops short of the target and never leaves the arranged arena", () => {
    const start = { x: -12, z: -5 },
      target = { x: -12, z: 5 };
    expect(distance(mobilityDestination(start, 0, target), target)).toBeCloseTo(
      2,
    );
    const arena = PLACES.find((p) => p.id === "arena")!;
    const edge = { x: arena.x + 14, z: arena.z };
    expect(
      distance(mobilityDestination(edge, Math.PI / 2, undefined, true), arena),
    ).toBeLessThan(17);
  });
});
describe("Vanish", () => {
  function hero() {
    return {
      profile: profile(2),
      auras: new Map(),
      guardUntil: 0,
      slowUntil: 0,
      stunUntil: 0,
      cast: {},
      auto: {},
      petTarget: "mob",
      pet: { cast: {}, command: {} },
    } as unknown as Player;
  }
  it("clears outgoing combat and own threat while retaining other players' combat", () => {
    const p = hero(),
      w = {
        threat: new Map([
          ["rogue", 200],
          ["tank", 100],
        ]),
        target: "rogue",
        cast: {},
      } as unknown as Wild;
    vanishHero(p, [w], 1000);
    expect(hiddenHero(p, 1001)).toBe(true);
    expect(hiddenHero(p, 9000)).toBe(false);
    expect(p.cast).toBeUndefined();
    expect(p.auto).toBeUndefined();
    expect(p.pet?.command).toBeUndefined();
    expect(p.petTarget).toBeUndefined();
    expect(w.threat.has("rogue")).toBe(false);
    expect(w.target).toBe("tank");
    expect(w.resetting).toBe(false);
    expect(w.state).toBe("chase");
  });
  it("resets abandoned enemies and breaks stealth explicitly", () => {
    const p = hero(),
      w = {
        threat: new Map([["rogue", 10]]),
        target: "rogue",
      } as unknown as Wild;
    vanishHero(p, [w], 1000);
    expect(w.resetting).toBe(true);
    expect(w.state).toBe("retreat");
    revealHero(p);
    expect(hiddenHero(p, 1001)).toBe(false);
  });
});
