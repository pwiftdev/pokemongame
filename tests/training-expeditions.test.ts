import { expect, it, vi } from "vitest";
import {
  practiceHit,
  practiceDps,
  TRAINING_TARGETS,
} from "../packages/shared/training";
import { EXPEDITIONS } from "../packages/shared/expeditions";
import {
  recordQuestEvent,
  questProgress,
  questAccepted,
} from "../packages/shared/story";
import {
  acceptQuest,
  claimQuest,
  makeCreature,
} from "../apps/server/src/gameplay";
import { walkable } from "../packages/shared/rules";
import { isSafeArea } from "../packages/shared/regions";
import type { Profile } from "../packages/shared/types";
import type { Transaction } from "../apps/server/src/db";
it("measures personal practice and starts a new session after inactivity or switching dummies", () => {
  let session = practiceHit(undefined, "one", 40, "swing", 1000);
  session = practiceHit(session, "one", 60, "strike", 3000);
  expect(session).toMatchObject({
    damage: 100,
    hits: 2,
    bestHit: 60,
    abilities: ["swing", "strike"],
  });
  expect(practiceDps(session, 3000)).toBe(50);
  expect(practiceDps(session, 14000)).toBe(50);
  expect(practiceHit(session, "one", 25, "swing", 14000).damage).toBe(25);
  expect(practiceHit(session, "two", 12, "swing", 4000).hits).toBe(1);
});
it("places training targets on walkable sanctuary ground", () => {
  for (const target of TRAINING_TARGETS) {
    expect(walkable(target.x, target.z)).toBe(true);
    expect(isSafeArea(target.x, target.z)).toBe(true);
  }
});
it("requires fresh expedition objectives and uses a distinct durable reward reference per run", async () => {
  const quest = EXPEDITIONS.find((q) => q.id === "expedition-meadow")!;
  const p: Profile = {
    id: "p",
    nickname: "P",
    balance: 0,
    creatures: [makeCreature("bulbasaur")],
    team: [],
    active: null,
    inventory: {},
    quests: {},
    claimed: [quest.prerequisite!],
    discoveries: [],
    wins: 0,
    losses: 0,
  };
  const credit = vi.fn(async (profile: Profile, amount: number) => {
    profile.balance += amount;
  });
  const tx = { credit } as unknown as Transaction;
  const board = { x: 0, z: -22 };
  for (let run = 0; run < 2; run++) {
    recordQuestEvent(p, quest.key, "bulbasaur");
    expect(questProgress(p, quest)).toBe(0);
    acceptQuest(p, quest.id, board);
    recordQuestEvent(p, quest.key, "bulbasaur");
    recordQuestEvent(p, quest.key, "bulbasaur");
    expect(questProgress(p, quest)).toBe(1);
    await expect(claimQuest(p, tx, quest.id, board)).rejects.toThrow(
      "not complete",
    );
    for (const species of ["pikachu", "eevee"])
      recordQuestEvent(p, quest.key, species);
    recordQuestEvent(p, quest.key, "extra");
    expect(
      Object.keys(p.quests).filter((k) =>
        k.startsWith(`objective:${quest.id}`),
      ),
    ).toHaveLength(3);
    await expect(claimQuest(p, tx, quest.id, { x: 90, z: 0 })).rejects.toThrow(
      "Visit",
    );
    await claimQuest(p, tx, quest.id, board);
    expect(questAccepted(p, quest)).toBe(false);
    expect(questProgress(p, quest)).toBe(0);
    expect(p.claimed).not.toContain(quest.id);
    await expect(claimQuest(p, tx, quest.id, board)).rejects.toThrow("Accept");
  }
  expect(credit.mock.calls.map((c) => (c as unknown[])[3])).toEqual([
    `quest:${quest.id}:0`,
    `quest:${quest.id}:1`,
  ]);
  expect(p.balance).toBe(quest.reward * 2);
  expect(p.quests[`claimed:${quest.id}`]).toBe(2);
});
it("does not clear a completed expedition when reward persistence fails", async () => {
  const quest = EXPEDITIONS.find((q) => q.id === "patrol-orchard")!;
  const p = {
    creatures: [makeCreature("bulbasaur")],
    quests: {
      [`accepted:${quest.id}`]: 1,
      [`progress:${quest.id}`]: quest.goal,
    },
    claimed: [quest.prerequisite!],
  } as unknown as Profile;
  const tx = {
    credit: vi.fn().mockRejectedValue(new Error("database unavailable")),
  } as unknown as Transaction;
  await expect(claimQuest(p, tx, quest.id, { x: 0, z: -22 })).rejects.toThrow(
    "unavailable",
  );
  expect(questAccepted(p, quest)).toBe(true);
  expect(questProgress(p, quest)).toBe(quest.goal);
});

it("keeps the arena and target approaches clear of decorative vegetation", async () => {
  const { arenaClearing } = await import(
    "../apps/client/src/render/arena-clearance"
  );
  expect(arenaClearing(29, -13)).toBe(true);
  for (const target of TRAINING_TARGETS)
    expect(arenaClearing(target.x, target.z)).toBe(true);
  expect(arenaClearing(90, 30)).toBe(false);
});
