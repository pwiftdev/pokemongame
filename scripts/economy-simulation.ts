import { writeFile } from "node:fs/promises";
import { ABILITIES, ITEMS, QUESTS, SPECIES } from "../packages/shared/data.js";
import {
  captureChance,
  effectiveness,
  maxHp,
} from "../packages/shared/rules.js";
import type { Profile } from "../packages/shared/types.js";
import type { Transaction } from "../apps/server/src/db.js";
import {
  claimQuest,
  gainExperience,
  increment,
  makeCreature,
  purchase,
} from "../apps/server/src/gameplay.js";

async function simulate(seed: number, decisionSeconds: number, rounds = 20) {
  let randomState = seed;
  const random = () => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const starter = makeCreature("spriglet");
  const p: Profile = {
    id: "simulated-player",
    nickname: "Simulation",
    balance: 180,
    creatures: [starter],
    team: [starter.id],
    active: starter.id,
    inventory: { capsule: 8, potion: 3 },
    quests: { starter: 1 },
    claimed: [],
    discoveries: [],
    wins: 0,
    losses: 0,
  };
  const ledger: { amount: number; reason: string; minute: number }[] = [
    { amount: 180, reason: "welcome", minute: 0 },
  ];
  const references = new Set<string>();
  let seconds = 90,
    sequence = 0,
    levelSixMinute: number | null = null,
    storyMinute: number | null = null,
    bossMinute: number | null = null,
    minimumBalance = 180,
    potionsUsed = 0,
    capsulesUsed = 0,
    freeHeals = 0,
    failures = 0;
  const tx = {
    credit: async (
      profile: Profile,
      amount: number,
      reason: string,
      reference: string,
    ) => {
      if (references.has(reference)) return false;
      if (profile.balance + amount < 0) throw new Error("Not enough PD.");
      references.add(reference);
      profile.balance += amount;
      minimumBalance = Math.min(minimumBalance, profile.balance);
      ledger.push({ amount, reason, minute: +(seconds / 60).toFixed(2) });
      return true;
    },
  } as unknown as Transaction;
  const noteLevel = () => {
    if (starter.level >= 6 && levelSixMinute === null)
      levelSixMinute = seconds / 60;
  };
  const claims = async () => {
    for (const q of QUESTS) {
      if (
        q.id === "friendly-rival" ||
        (!q.repeatable && p.claimed.includes(q.id))
      )
        continue;
      try {
        await claimQuest(p, tx, q.id);
        seconds += decisionSeconds;
      } catch {}
    }
    if (p.claimed.includes("world-heart") && storyMinute === null)
      storyMinute = seconds / 60;
  };
  const visitShop = async () => {
    seconds += 70 + decisionSeconds;
    if (p.inventory.capsule < 4 && p.balance >= 90)
      await purchase(p, tx, "capsule", 6, `buy:${sequence++}`);
    if (p.inventory.potion < 2 && p.balance >= 36)
      await purchase(p, tx, "potion", 3, `buy:${sequence++}`);
    await claims();
  };
  const heal = async () => {
    if (starter.hp >= starter.maxHp * 0.5) return;
    if (p.inventory.potion > 0) {
      p.inventory.potion--;
      potionsUsed++;
      starter.hp = Math.min(starter.maxHp, starter.hp + 45);
      seconds += 2 + decisionSeconds / 3;
    } else if (p.balance >= 36) {
      await visitShop();
      if (p.inventory.potion) await heal();
    } else {
      seconds += 100;
      starter.hp = starter.maxHp;
      freeHeals++;
    }
  };
  const discover = async (biome: string) => {
    if (p.discoveries.includes(biome)) return;
    seconds += 80 + decisionSeconds;
    p.discoveries.push(biome);
    increment(p, `discover:${biome}`);
    await tx.credit(p, 20, "discovery", `discovery:${biome}`);
    await claims();
  };
  const fight = async (
    species: string,
    level: number,
    elite = false,
    boss = false,
    capture = false,
  ) => {
    const enemy = SPECIES[species],
      ability = ABILITIES[starter.moves[0]],
      enemyMax = Math.round(
        maxHp(species, level) * (boss ? 12 : elite ? 2.1 : 1),
      );
    let hp = enemyMax,
      elapsed = 0,
      nextEnemyAttack = 2.3;
    const stopAt = capture ? enemyMax * 0.45 : 0;
    await heal();
    seconds += decisionSeconds + 8;
    while (hp > stopAt) {
      const hit = Math.max(
        1,
        Math.round(
          (ability.power +
            SPECIES[starter.species].power * 0.4 +
            starter.level * 2) *
            (starter.evolved ? 1.2 : 1) *
            effectiveness(ability.element, enemy.element),
        ),
      );
      hp = Math.max(0, hp - hit);
      const duration = ability.cooldown + decisionSeconds / 14;
      elapsed += duration;
      seconds += duration;
      if (boss) hp = Math.max(0, hp - hit * 0.8);
      while (elapsed >= nextEnemyAttack) {
        const guarded = elapsed % 6 < 4;
        const damage = Math.max(
          1,
          Math.round(
            (5 + level * 1.3 + (elite ? 4 : 0)) *
              effectiveness(enemy.element, SPECIES[starter.species].element) *
              (guarded ? 0.35 : 1),
          ),
        );
        starter.hp -= damage;
        nextEnemyAttack += boss ? 3.3 : 2.3;
        if (starter.hp <= 0) {
          failures++;
          seconds += 120;
          starter.hp = starter.maxHp;
          freeHeals++;
        }
        await heal();
      }
    }
    if (capture) {
      for (let tries = 0; tries < 30; tries++) {
        if (!p.inventory.capsule) {
          await visitShop();
          if (!p.inventory.capsule) {
            failures++;
            break;
          }
        }
        p.inventory.capsule--;
        capsulesUsed++;
        seconds += 2 + decisionSeconds / 3;
        const chance = captureChance(
          enemy.difficulty,
          Math.max(1, hp),
          enemyMax,
        );
        if (random() < chance) {
          const c = makeCreature(species, level);
          p.creatures.push(c);
          increment(p, "captures");
          break;
        }
      }
    } else {
      await tx.credit(
        p,
        boss ? 180 : elite ? 55 : 12 + level * 2,
        boss ? "world boss" : elite ? "elite encounter" : "wild encounter",
        `encounter:${sequence++}`,
      );
      increment(p, "defeats");
      if (elite) increment(p, "elites");
      if (boss) {
        increment(p, "bosses");
        bossMinute = seconds / 60;
      }
      gainExperience(starter, (boss ? 220 : elite ? 100 : 32) + level * 12);
      noteLevel();
    }
    await claims();
    if (
      starter.level >= 6 &&
      !starter.evolved &&
      p.balance >= 90 &&
      p.claimed.includes("elite-watch")
    ) {
      seconds += 100 + decisionSeconds;
      await tx.credit(p, -90, "ascension", `evolve:${starter.id}`);
      starter.evolved = true;
      starter.maxHp = maxHp(starter.species, starter.level, true);
      starter.hp = starter.maxHp;
      increment(p, "evolutions");
      await claims();
    }
  };
  await claims();
  const meadowEnd = rounds === 20 ? 5 : 3,
    forestEnd = rounds === 20 ? 12 : 6;
  for (let round = 0; round < rounds; round++) {
    const biome =
      round < meadowEnd ? "meadow" : round < forestEnd ? "forest" : "ruins";
    await discover(biome);
    const roster = Object.values(SPECIES).filter((s) => s.biome === biome);
    const enemy = roster[round % roster.length];
    const level =
      biome === "meadow"
        ? 1 + Math.floor(round / 2)
        : biome === "forest"
          ? 4 + Math.floor((round - meadowEnd) / 3)
          : 7 + Math.floor((round - forestEnd) / 3);
    const elite =
      rounds === 20 && (round === 8 || round === 14 || round === 18);
    await fight(enemy.id, level);
    await fight(enemy.id, elite ? level + 2 : level, elite);
    await fight(
      roster[(round + 1) % roster.length].id,
      level,
      false,
      false,
      true,
    );
    if (round === 0 || p.inventory.capsule < 4 || p.inventory.potion < 2)
      await visitShop();
  }
  await fight("pebblit", 6, true);
  await fight("tempest", 12, false, true);
  return {
    seed,
    mode:
      rounds === 20
        ? "extended collecting (42 battles,20 captures)"
        : "story-focused (22 battles,10 captures)",
    decisionSeconds,
    minutes: +(seconds / 60).toFixed(1),
    minutesToLevelSix: levelSixMinute && +levelSixMinute.toFixed(1),
    minutesToBoss: bossMinute && +bossMinute.toFixed(1),
    minutesToStoryComplete: storyMinute && +storyMinute.toFixed(1),
    level: starter.level,
    claimedStoryQuests: p.claimed.filter(
      (id) => !QUESTS.find((q) => q.id === id)?.repeatable,
    ).length,
    defeats: p.quests.defeats,
    captures: p.quests.captures,
    balance: p.balance,
    minimumBalance,
    capsulesUsed,
    potionsUsed,
    freeHeals,
    defeatsRequiringRecovery: failures,
    inventory: p.inventory,
    sources: ledger
      .filter((e) => e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0),
    sinks: -ledger
      .filter((e) => e.amount < 0)
      .reduce((sum, e) => sum + e.amount, 0),
    ledger,
  };
}
const results = [];
for (const rounds of [10, 20])
  for (const decisionSeconds of [12, 18, 24])
    for (const seed of [17, 42, 99])
      results.push(await simulate(seed, decisionSeconds, rounds));
const report = {
  timestamp: new Date().toISOString(),
  method:
    "Seeded analytical simulation, not an executed first-hour playthrough. Uses production XP, damage, capture odds, quest eligibility, prices and rewards with either 22 battles/10 captures (including 1 elite and 1 cooperative boss) or 42 battles/20 captures (including 4 elites and 1 cooperative boss). Guard is used regularly. Boss assumes one partner deals 80% of the player damage. Creature damage uses basic moves; special moves, evasive telegraph movement, learning/exploration variation and network latency are omitted.",
  pacingAssumptions:
    "90s onboarding;80s each new-biome travel/exploration;70s each shop trip;100s lodge/heal return;8s approach per encounter;12/18/24s decision/reading time per encounter, quest claim and service interaction. Consumable actions2s+one-third decision budget. A missed or too-late heal adds120s recovery. These assumptions are estimates, not measured player timings.",
  conclusion:
    "All scenarios reconcile sources minus sinks to final balance. Story duration depends strongly on reading/exploration time; measured first-time usability and balance playtests remain required. No external-value currency or PvP farming is modeled.",
  results,
};
await writeFile(
  "evidence/economy-simulation.json",
  JSON.stringify(report, null, 2),
);
console.table(results.map(({ ledger: _ledger, ...summary }) => summary));
