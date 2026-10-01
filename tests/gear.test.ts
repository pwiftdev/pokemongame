import { describe, expect, it, vi } from "vitest";
import {
  GEAR,
  GEAR_CATALOG,
  gearStats,
  armorMultiplier,
  emptyGear,
  validGear,
} from "../packages/shared/gear";
import { heroHp, heroMaxHp } from "../packages/shared/hero";
import { makeCreature } from "../apps/server/src/gameplay";
import {
  buyGear,
  equipGear,
  claimCollectible,
  awardEncounterGear,
} from "../apps/server/src/gear";
import { normalizeProfile, validateProfile } from "../apps/server/src/profile";
import { commandSchema } from "../apps/server/src/commands";
import type { Profile } from "../packages/shared/types";
import type { Transaction } from "../apps/server/src/db";
const profile = (level = 1): Profile => {
  const c = makeCreature("bulbasaur", level);
  return {
    id: "gear-test",
    nickname: "Gear",
    classId: "knight",
    balance: 180,
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
};
function transaction() {
  const credit = vi.fn(async (p: Profile, amount: number) => {
    if (p.balance + amount < 0) throw new Error("Not enough PD.");
    p.balance += amount;
    return true;
  });
  return { credit, tx: { credit } as unknown as Transaction };
}
describe("equipment ownership and economy", () => {
  it("offers increasingly powerful class weapons and five complete armor tiers", () => {
    expect(new Set(GEAR_CATALOG.map((i) => i.id)).size).toBe(
      GEAR_CATALOG.length,
    );
    for (const cls of ["knight", "mage", "rogue", "barbarian"]) {
      const weapons = GEAR_CATALOG.filter((i) => i.classId === cls);
      expect(weapons).toHaveLength(5);
      expect(
        weapons.every((i, n) => !n || i.power > weapons[n - 1].power),
      ).toBe(true);
    }
    expect(GEAR_CATALOG.filter((i) => i.slot === "chest")).toHaveLength(5);
  });
  it("debits the listed price once and rejects owned, locked, wrong-class and forged purchases", async () => {
    const p = profile(),
      { tx, credit } = transaction();
    await buyGear(p, tx, "knight-weapon-1", "request");
    expect(p.balance).toBe(100);
    expect(p.gear?.owned).toEqual(["knight-weapon-1"]);
    for (const id of [
      "knight-weapon-1",
      "knight-weapon-5",
      "mage-weapon-1",
      "unknown",
      "__proto__",
      "sigil-warden",
    ])
      await expect(buyGear(p, tx, id, id)).rejects.toThrow();
    expect(credit).toHaveBeenCalledTimes(1);
  });
  it("does not add ownership when the debit fails or was already acknowledged", async () => {
    const p = profile(),
      { tx, credit } = transaction();
    p.balance = 0;
    await expect(buyGear(p, tx, "chest-1", "one")).rejects.toThrow();
    expect(p.gear?.owned).toEqual([]);
    credit.mockResolvedValueOnce(false);
    await expect(buyGear(p, tx, "chest-1", "two")).rejects.toThrow();
    expect(p.gear?.owned).toEqual([]);
  });
  it("requires ownership and correct slots when equipping", () => {
    const p = profile();
    expect(() => equipGear(p, "weapon", "knight-weapon-1")).toThrow();
    p.gear = { owned: ["knight-weapon-1", "chest-1"], equipped: {} };
    expect(() => equipGear(p, "head", "chest-1")).toThrow();
    equipGear(p, "weapon", "knight-weapon-1");
    equipGear(p, "chest", "chest-1");
    expect(gearStats(p)).toEqual({ power: 4, health: 24, armor: 2 });
    expect(validGear(p)).toBe(true);
  });
  it("never heals or revives through gear swapping", () => {
    const p = profile();
    p.gear = { owned: ["chest-1"], equipped: {} };
    p.heroHp = 90;
    equipGear(p, "chest", "chest-1");
    expect(heroHp(p)).toBe(90);
    expect(heroMaxHp(p)).toBe(176);
    equipGear(p, "chest", null);
    expect(heroHp(p)).toBe(90);
    p.heroHp = 0;
    equipGear(p, "chest", "chest-1");
    expect(heroHp(p)).toBe(0);
    p.heroHp = 176;
    equipGear(p, "chest", null);
    expect(heroHp(p)).toBe(152);
  });
  it("migrates old profiles and removes invalid equipped slots without deleting owned gear", () => {
    const p = profile();
    normalizeProfile(p);
    expect(p.gear).toBeUndefined();
    p.gear = {
      owned: ["knight-weapon-1", "mage-weapon-1"],
      equipped: { weapon: "mage-weapon-1" },
    };
    expect(() => validateProfile(p)).toThrow();
    normalizeProfile(p);
    expect(p.gear.owned).toHaveLength(2);
    expect(p.gear.equipped.weapon).toBeUndefined();
    validateProfile(p);
  });
  it("rejects malformed commands and invalid ownership states", () => {
    for (const command of [
      { kind: "gearBuy", item: "chest-1", price: 0 },
      { kind: "gearEquip", slot: "fake", item: "chest-1" },
    ])
      expect(commandSchema.safeParse(command).success).toBe(false);
    const p = profile();
    p.gear = emptyGear();
    p.gear.owned = ["chest-1", "chest-1"];
    expect(validGear(p)).toBe(false);
  });
});
describe("collectibles and encounter loot", () => {
  it("requires achievements, prevents duplicate claims, and awards no combat stats", () => {
    const p = profile();
    expect(() => claimCollectible(p, "banner-vanguard")).toThrow();
    p.quests.defeats = 25;
    claimCollectible(p, "banner-vanguard");
    equipGear(p, "back", "banner-vanguard");
    expect(gearStats(p)).toEqual({ power: 0, health: 0, armor: 0 });
    expect(() => claimCollectible(p, "banner-vanguard")).toThrow();
  });
  it("boss drops are deterministic, class-appropriate and level-appropriate", () => {
    const a = profile(8),
      b = profile(8);
    const drop = awardEncounterGear(a, "boss-1", true, false)!;
    expect(drop.id).toBe(awardEncounterGear(b, "boss-1", true, false)?.id);
    expect(drop.tier).toBe(3);
    expect(drop.classId ?? "knight").toBe("knight");
    for (let i = 0; i < 8; i++) awardEncounterGear(a, `boss-${i}`, true, false);
    expect(new Set(a.gear?.owned).size).toBe(a.gear?.owned.length);
    expect(awardEncounterGear(a, "ordinary", false, false)).toBeUndefined();
  });
  it("caps mitigation and keeps every catalog price safe", () => {
    expect(armorMultiplier(10)).toBe(0.9);
    expect(armorMultiplier(900)).toBe(0.6);
    expect(
      Object.values(GEAR).every(
        (i) => Number.isSafeInteger(i.price) && i.price >= 0,
      ),
    ).toBe(true);
  });
});
