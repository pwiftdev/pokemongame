import { describe, expect, it } from "vitest";
import { QUESTS, PLACES, SPECIES, ITEMS } from "../packages/shared/data";
import {
  HABITATS,
  SPAWNS,
  canRespawn,
  encounterRespawnMs,
} from "../packages/shared/encounters";
import {
  currentQuest,
  questAccepted,
  questDestination,
  questProgress,
  recordQuestEvent,
  tutorialCapture,
} from "../packages/shared/story";
import {
  acceptQuest,
  claimQuest,
  inspectStoryPlace,
  makeCreature,
} from "../apps/server/src/gameplay";
import { isSafeArea, ROADS } from "../packages/shared/regions";
import { walkable, distance } from "../packages/shared/rules";
import type { Profile } from "../packages/shared/types";
import type { Transaction } from "../apps/server/src/db";
const profile = (): Profile => ({
  id: "story-test",
  nickname: "Story",
  balance: 0,
  creatures: [makeCreature("bulbasaur")],
  team: [],
  active: null,
  inventory: {},
  quests: { starter: 1 },
  claimed: ["first-friend"],
  discoveries: [],
  wins: 0,
  losses: 0,
});
const q = (id: string) => QUESTS.find((q) => q.id === id)!;
const place = (id: string) => PLACES.find((p) => p.id === id)!;
const transaction = {
  credit: async (p: Profile, amount: number) => {
    p.balance += amount;
  },
} as unknown as Transaction;
describe("story progression", () => {
  it("requires the preceding chapter, physical quest giver and acceptance before progress", () => {
    const p = profile();
    recordQuestEvent(p, "visit:ranger");
    expect(questProgress(p, q("story-ranger"))).toBe(0);
    expect(() => acceptQuest(p, "story-ranger", place("scholar"))).toThrow(
      "Visit",
    );
    expect(() => acceptQuest(p, "story-orchard", place("ranger"))).toThrow(
      "preceding",
    );
    acceptQuest(p, "story-ranger", place("quest"));
    expect(questAccepted(p, q("story-ranger"))).toBe(true);
    inspectStoryPlace(p, "ranger");
    expect(questProgress(p, q("story-ranger"))).toBe(1);
  });
  it("turns in only at the intended NPC and never grants the reward twice", async () => {
    const p = profile();
    acceptQuest(p, "story-ranger", place("quest"));
    await expect(
      claimQuest(p, transaction, "story-ranger", place("ranger")),
    ).rejects.toThrow("objectives");
    inspectStoryPlace(p, "ranger");
    await expect(
      claimQuest(p, transaction, "story-ranger", place("quest")),
    ).rejects.toThrow("Visit");
    await claimQuest(p, transaction, "story-ranger", place("ranger"));
    expect(p.balance).toBe(25);
    await expect(
      claimQuest(p, transaction, "story-ranger", place("ranger")),
    ).rejects.toThrow("already");
    expect(p.balance).toBe(25);
    expect(p.creatures[0].level).toBe(2);
    expect(p.creatures[0].xp).toBe(7);
  });
  it("counts only the requested camp after accepting and grants a field kit once", () => {
    const p = profile();
    p.claimed.push("story-ranger");
    p.quests.defeats = 100;
    acceptQuest(p, "story-orchard", place("ranger"));
    expect(p.inventory.potion).toBe(2);
    expect(() => acceptQuest(p, "story-orchard", place("ranger"))).toThrow(
      "already",
    );
    expect(p.inventory.potion).toBe(2);
    recordQuestEvent(p, "camp:roots");
    expect(questProgress(p, q("story-orchard"))).toBe(0);
    recordQuestEvent(p, "camp:orchard");
    recordQuestEvent(p, "camp:orchard");
    expect(questProgress(p, q("story-orchard"))).toBe(2);
  });
  it("requires both inscriptions and changes the destination after the first", () => {
    const p = profile();
    p.claimed.push("story-roots");
    acceptQuest(p, "story-wards", place("scholar"));
    inspectStoryPlace(p, "ward-west");
    inspectStoryPlace(p, "ward-west");
    expect(questProgress(p, q("story-wards"))).toBe(1);
    expect(questDestination(p, q("story-wards"))?.name).toBe(
      "Hollow-tree ward",
    );
    inspectStoryPlace(p, "ward-east");
    expect(questProgress(p, q("story-wards"))).toBe(2);
    expect(questDestination(p, q("story-wards"))?.name).toBe("Warden Elara");
  });
  it("offers the assisted catch once and preserves progress across serialization", () => {
    const p = profile();
    p.claimed.push("story-satchel");
    expect(tutorialCapture(p)).toBe(false);
    acceptQuest(p, "story-catch", place("ranger"));
    expect(tutorialCapture(p)).toBe(true);
    recordQuestEvent(p, "captures");
    const resumed = JSON.parse(JSON.stringify(p)) as Profile;
    expect(questProgress(resumed, q("story-catch"))).toBe(1);
    expect(tutorialCapture(resumed)).toBe(false);
    expect(resumed.inventory.capsule).toBe(8);
  });
  it("retains legacy progression without letting old lifetime kills skip the new story", () => {
    const p = profile();
    p.claimed.push("first-battle", "world-heart");
    p.quests.defeats = 999;
    expect(currentQuest(p)?.id).toBe("story-ranger");
    expect(questProgress(p, q("story-orchard"))).toBe(0);
  });
  it("connects every objective and supply to real walkable content", () => {
    for (const quest of QUESTS) {
      if (quest.giver) expect(place(quest.giver)).toBeDefined();
      if (quest.turnIn) expect(place(quest.turnIn)).toBeDefined();
      if (quest.destination)
        expect(walkable(quest.destination.x, quest.destination.z)).toBe(true);
      for (const item of Object.keys(quest.supplies ?? {}))
        expect(ITEMS[item]).toBeDefined();
      if (quest.key.startsWith("camp:"))
        expect(
          SPAWNS.filter((s) => s.habitat === quest.key.slice(5)).length,
        ).toBeGreaterThanOrEqual(quest.goal);
    }
  });
});
describe("authored habitats", () => {
  it("keeps encounters sparse, within named habitats and outside safe camps", () => {
    expect(SPAWNS.length).toBeLessThanOrEqual(100);
    for (const spawn of SPAWNS) {
      const habitat = HABITATS.find((h) => h.id === spawn.habitat)!;
      expect(habitat).toBeDefined();
      expect(distance(spawn, habitat)).toBeLessThan(10);
      if (!SPECIES[spawn.species].companion)
        expect(isSafeArea(spawn.x, spawn.z), spawn.id).toBe(false);
      expect(SPECIES[spawn.species]).toBeDefined();
    }
  });
  it("places all three catchable species near the first ranger and off monster camps", () => {
    for (const species of ["bulbasaur", "charmander", "squirtle"]) {
      const homes = SPAWNS.filter((s) => s.species === species);
      expect(homes.length).toBeGreaterThanOrEqual(2);
      for (const home of homes) {
        expect(distance(home, place("ranger"))).toBeLessThan(70);
        expect(HABITATS.find((h) => h.id === home.habitat)?.kind).toBe(
          "pokemon",
        );
      }
    }
  });
  it("keeps hostile spawn homes off the road surface", () => {
    for (const spawn of SPAWNS.filter(
      (s) => !SPECIES[s.species].companion && !s.boss,
    )) {
      const distances = ROADS.flatMap((road) =>
        road.slice(1).map((b, i) => {
          const a = road[i],
            dx = b[0] - a[0],
            dz = b[1] - a[1];
          const t = Math.max(
            0,
            Math.min(
              1,
              ((spawn.x - a[0]) * dx + (spawn.z - a[1]) * dz) /
                (dx * dx + dz * dz),
            ),
          );
          return Math.hypot(spawn.x - a[0] - dx * t, spawn.z - a[1] - dz * t);
        }),
      );
      expect(Math.min(...distances), spawn.id).toBeGreaterThan(5);
    }
  });
  it("delays respawns around online players and leaves at least two minutes between camp encounters", () => {
    expect(canRespawn({ x: 0, z: 0 }, [{ x: 2, z: 0, online: true }])).toBe(
      false,
    );
    expect(canRespawn({ x: 0, z: 0 }, [{ x: 2, z: 0, online: false }])).toBe(
      true,
    );
    expect(canRespawn({ x: 0, z: 0 }, [{ x: 20, z: 0, online: true }])).toBe(
      true,
    );
    expect(encounterRespawnMs(false, false)).toBe(120000);
    expect(encounterRespawnMs(true, false)).toBe(180000);
  });
});
