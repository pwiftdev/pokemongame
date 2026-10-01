import { describe, expect, it } from "vitest";
import { FIELD_RESEARCH } from "../packages/shared/field-research";
import {
  QUESTS,
  questProgress,
  recordQuestEvent,
} from "../packages/shared/story";
import {
  acceptQuest,
  claimQuest,
  makeCreature,
} from "../apps/server/src/gameplay";
import { PLACES } from "../packages/shared/data";
import type { Profile, PlayerView, WildView } from "../packages/shared/types";
import type { Transaction } from "../apps/server/src/db";
import {
  companionMood,
  personalityPhase,
} from "../packages/shared/companion-personality";
import {
  captureGuidance,
  castWarning,
} from "../apps/client/src/ui/combat-guidance";
import {
  directionLabel,
  adventureHint,
} from "../apps/client/src/ui/adventure-guide";
import { trainingGoals } from "../apps/client/src/ui/training-goals";
import {
  invitedIsland,
  islandInvite,
  explorerRows,
} from "../apps/client/src/ui/explorers";
import { frameSummary } from "../apps/client/src/ui/performance";

const profile = (): Profile => ({
  id: "research-test",
  nickname: "Field",
  balance: 0,
  creatures: [makeCreature("bulbasaur")],
  team: [],
  active: null,
  inventory: {},
  quests: { starter: 1 },
  claimed: [],
  discoveries: [],
  wins: 0,
  losses: 0,
});
const board = PLACES.find((p) => p.id === "quest")!;
const tx = {
  credit: async (p: Profile, value: number) => {
    p.balance += value;
  },
} as unknown as Transaction;
describe("regional field studies", () => {
  it("requires the story unlock and acceptance, counts different species once, and rewards only at the board", async () => {
    const p = profile(),
      q = FIELD_RESEARCH.find((q) => q.id === "research-meadow")!;
    expect(() => acceptQuest(p, q.id, board)).toThrow();
    p.claimed.push("story-catch");
    recordQuestEvent(p, q.key, "bulbasaur");
    expect(questProgress(p, q)).toBe(0);
    acceptQuest(p, q.id, board);
    recordQuestEvent(p, "research-forest", "pikachu");
    expect(questProgress(p, q)).toBe(0);
    recordQuestEvent(p, q.key, "bulbasaur");
    recordQuestEvent(p, q.key, "bulbasaur");
    expect(questProgress(p, q)).toBe(1);
    await expect(claimQuest(p, tx, q.id, board)).rejects.toThrow();
    recordQuestEvent(p, q.key, "oddish");
    await expect(
      claimQuest(p, tx, q.id, PLACES.find((p) => p.id === "ranger")!),
    ).rejects.toThrow();
    await claimQuest(p, tx, q.id, board);
    expect(p.balance).toBe(q.reward);
    await expect(claimQuest(p, tx, q.id, board)).rejects.toThrow();
    recordQuestEvent(p, q.key, "pidgey");
    expect(questProgress(p, q)).toBe(2);
    expect(p.balance).toBe(q.reward);
  });
  it("covers every biome without changing the main story chain", () => {
    expect(FIELD_RESEARCH).toHaveLength(8);
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
    expect(QUESTS.filter((q) => !q.side)).toHaveLength(10);
    expect(new Set(FIELD_RESEARCH.map((q) => q.key)).size).toBe(8);
  });
});
describe("companion personality", () => {
  const resting = {
    temperament: "sleepy" as const,
    phase: 0,
    time: 25,
    restingFor: 25,
    moving: false,
    inCombat: false,
    fainted: false,
    greeting: false,
  };
  it("reserves sleepy/playful reactions for rest and never overrides fainting or combat", () => {
    expect(companionMood(resting)).toBe("sleep");
    expect(companionMood({ ...resting, greeting: true })).toBe("celebrate");
    expect(companionMood({ ...resting, greeting: true, inCombat: true })).toBe(
      "idle",
    );
    expect(companionMood({ ...resting, greeting: true, moving: true })).toBe(
      "idle",
    );
    expect(companionMood({ ...resting, greeting: true, fainted: true })).toBe(
      "defeat",
    );
    expect(
      companionMood({ ...resting, temperament: "playful", time: 24 }),
    ).toBe("celebrate");
    expect(companionMood({ ...resting, restingFor: 2 })).toBe("idle");
  });
  it("keeps idle timing stable per explorer but staggers different explorers", () => {
    expect(personalityPhase("alice")).toBe(personalityPhase("alice"));
    expect(personalityPhase("alice")).not.toBe(personalityPhase("bob"));
  });
});
describe("first-session and combat guidance", () => {
  const self = {
    id: "me",
    hp: 90,
    maxHp: 100,
    x: -60,
    z: 30,
    moving: false,
  } as PlayerView;
  const wild = {
    species: "bulbasaur",
    hp: 75,
    maxHp: 100,
    x: -62,
    z: 30,
  } as WildView;
  it("explains capture preparation, resources, distance, fainting and sleep", () => {
    expect(captureGuidance(self, wild, 2)).toContain("Ready to catch");
    expect(captureGuidance(self, { ...wild, hp: 76 }, 2)).toContain("Use bait");
    expect(captureGuidance(self, wild, 0)).toContain("No capsules");
    expect(captureGuidance({ ...self, hp: 0 }, wild, 2)).toContain("heal");
    expect(captureGuidance(self, { ...wild, x: -100 }, 2)).toContain("closer");
    expect(
      captureGuidance(self, { ...wild, hp: 100, activity: "sleep" }, 2),
    ).toContain("quiet catch");
    expect(
      captureGuidance(
        { ...self, moving: true },
        { ...wild, hp: 100, activity: "sleep" },
        2,
      ),
    ).toContain("Use bait");
    expect(
      captureGuidance(self, { ...wild, species: "not-pokemon" }, 2),
    ).toContain("monsters");
  });
  it("only warns for unresolved hostile casts", () => {
    const target = {
      ...wild,
      cast: { name: "Root burst", resolvesAt: 2000, interruptible: true },
    } as WildView;
    expect(castWarning(target, 1000)).toContain("Interrupt");
    expect(castWarning(target, 2000)).toBe("");
    expect(
      castWarning(
        { ...target, cast: { ...target.cast!, interruptible: false } },
        1000,
      ),
    ).not.toContain("Interrupt");
  });
  it("gives useful initial guidance, compass directions and next training goals", () => {
    expect(adventureHint(profile())).toContain("allowance");
    expect(directionLabel({ x: 0, z: 0 }, { x: -30, z: 30 })).toContain(
      "north-west",
    );
    expect(directionLabel({ x: 0, z: 0 }, { x: 2, z: 2 })).toContain("Nearby");
    expect(
      trainingGoals({ species: "bulbasaur", level: 1 }).some((goal) =>
        goal.includes("Ivysaur"),
      ),
    ).toBe(true);
    expect(trainingGoals({ species: "missing", level: 1 })).toEqual([]);
  });
});
describe("friend invitations and diagnostics", () => {
  it("shares only a valid island code and never carries identity parameters", () => {
    const link = islandInvite(
      "https://example.test/?token=secret#fragment",
      "room_12",
    );
    expect(link).toBe("https://example.test/?island=room_12");
    expect(invitedIsland(new URL(link).search)).toBe("room_12");
    for (const invalid of [
      "?island=%3Cscript%3E",
      "?island=" + "a".repeat(25),
      "?island=../private",
    ])
      expect(invitedIsland(invalid)).toBe("");
  });
  it("escapes names in the explorer list", () => {
    const html = explorerRows(
      [
        {
          id: "a",
          nickname: "<script>alert(1)</script>",
          x: 0,
          z: -25,
          hp: 50,
          maxHp: 100,
          companionLevel: 1,
          companion: "bulbasaur",
        } as PlayerView,
      ],
      "a",
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("reports frame percentiles without mutating samples", () => {
    const input = [30, 10, 20, NaN, -1];
    expect(frameSummary(input)).toEqual({ count: 3, p50: 20, p95: 30 });
    expect(input[0]).toBe(30);
    expect(frameSummary([])).toEqual({ count: 0, p50: 0, p95: 0 });
  });
});
