import {
  questAccepted,
  questUnlocked,
  questProgress,
  recordQuestEvent,
} from "../../../packages/shared/story.js";
import { heroClass } from "../../../packages/shared/classes.js";
import { heroHp, heroMaxHp } from "../../../packages/shared/hero.js";
import { randomUUID } from "node:crypto";
import {
  ABILITIES,
  ITEMS,
  PLACES,
  QUESTS,
  SPECIES,
} from "../../../packages/shared/data.js";
import { distance, maxHp, xpForLevel } from "../../../packages/shared/rules.js";
import type { Creature, Profile } from "../../../packages/shared/types.js";
import type { Transaction } from "./db.js";

export function makeCreature(species: string, level = 1): Creature {
  const definition = SPECIES[species];
  if (!definition) throw new Error("Unknown creature.");
  return {
    id: randomUUID(),
    species,
    nickname: "",
    level,
    xp: 0,
    hp: maxHp(species, level),
    maxHp: maxHp(species, level),
    evolved: false,
    trait: ["Curious", "Brave", "Gentle", "Lively"][
      Math.floor(Math.random() * 4)
    ],
    moves: learnedMoves(species, level),
  };
}
export function learnedMoves(species: string, level: number) {
  const moves = SPECIES[species].moves;
  return [
    moves[0],
    ...(level >= 3 ? [moves[1]] : []),
    ...(level >= 5 ? [moves[2]] : []),
    moves[3],
  ];
}
export function increment(p: Profile, key: string, amount = 1) {
  p.quests[key] = (p.quests[key] ?? 0) + amount;
  recordQuestEvent(p, key);
}
export function activeCreature(p: Profile) {
  const c = p.creatures.find((c) => c.id === p.active);
  if (!c) throw new Error("Deploy a companion first.");
  return c;
}
export function consume(p: Profile, item: string, quantity = 1) {
  if ((p.inventory[item] ?? 0) < quantity)
    throw new Error("You do not have enough of that item.");
  p.inventory[item] -= quantity;
}
export function requirePlace(
  position: { x: number; z: number },
  id: string,
  radius = 9,
) {
  const place = PLACES.find((p) => p.id === id);
  if (!place || distance(position, place) > radius)
    throw new Error(`Visit ${place?.name ?? "that location"} first.`);
  return place;
}
export function gainExperience(c: Creature, amount: number) {
  c.xp += amount;
  while (c.level < 20 && c.xp >= xpForLevel(c.level)) {
    c.xp -= xpForLevel(c.level);
    c.level++;
    c.moves = learnedMoves(c.species, c.level);
    const before = c.maxHp;
    c.maxHp = maxHp(c.species, c.level, c.evolved);
    c.hp = Math.min(c.maxHp, c.hp + c.maxHp - before);
  }
  if (c.level === 20) c.xp = Math.min(c.xp, xpForLevel(20));
}
export async function purchase(
  p: Profile,
  tx: Transaction,
  itemId: string,
  quantity: number,
  reference: string,
) {
  const item = itemDefinition(itemId);
  await tx.credit(
    p,
    -item.price * quantity,
    `purchase: ${item.name}`,
    reference,
  );
  p.inventory[item.id] = (p.inventory[item.id] ?? 0) + quantity;
  increment(p, "purchases");
}
export function acceptQuest(
  p: Profile,
  id: string,
  position: { x: number; z: number },
) {
  const q = QUESTS.find((q) => q.id === id);
  if (!q?.giver) throw new Error("Quest not found.");
  requirePlace(position, q.giver);
  if (!p.creatures.length) throw new Error("Choose your first Pokémon first.");
  if (!questUnlocked(p, q))
    throw new Error("Complete the preceding expedition quest first.");
  if (questAccepted(p, q) || p.claimed.includes(id))
    throw new Error("You already accepted this quest.");
  p.quests[`accepted:${id}`] = 1;
  for (const [item, count] of Object.entries(q.supplies ?? {}))
    p.inventory[item] = (p.inventory[item] ?? 0) + count;
}
export function inspectStoryPlace(p: Profile, id: string) {
  recordQuestEvent(p, `visit:${id}`, id);
  if (id === "ward-west" || id === "ward-east")
    recordQuestEvent(p, "forest-wards", id);
}
export async function claimQuest(
  p: Profile,
  tx: Transaction,
  id: string,
  position?: { x: number; z: number },
) {
  const q = QUESTS.find((q) => q.id === id);
  if (!q) throw new Error("Quest not found.");
  if (!questUnlocked(p, q))
    throw new Error("Complete the preceding expedition quest first.");
  if (p.claimed.includes(id)) throw new Error("Reward already collected.");
  if (!questAccepted(p, q))
    throw new Error("Accept this quest from its giver first.");
  if (q.giver) {
    if (!position) throw new Error("Return to the quest giver first.");
    requirePlace(position, q.turnIn ?? q.giver);
  }
  if (questProgress(p, q) < q.goal)
    throw new Error("Quest objectives are not complete yet.");
  await tx.credit(p, q.reward, `quest: ${q.name}`, `quest:${id}:0`);
  const previousMax = heroMaxHp(p);
  const companion =
    p.creatures.find((c) => c.id === p.active) ?? p.creatures[0];
  if (companion && q.xp) gainExperience(companion, q.xp);
  p.heroHp = Math.min(heroMaxHp(p), heroHp(p) + heroMaxHp(p) - previousMax);
  p.quests[`claimed:${id}`] = 1;
  p.claimed.push(id);
}
export function useItem(p: Profile, itemId: string, inCombat: boolean) {
  const item = itemDefinition(itemId);
  if (item.effect === "tame")
    throw new Error("Select a wild creature to use a capsule.");
  const c = activeCreature(p);
  if (item.effect === "teamHeal" && inCombat)
    throw new Error("Use trail rations outside combat.");
  if (item.effect === "revive" && c.hp > 0 && heroHp(p) > 0)
    throw new Error("Your companion is already standing.");
  if (item.effect === "heal" && (c.hp <= 0 || heroHp(p) <= 0))
    throw new Error("Use a revival seed or visit the Springhouse.");
  if (
    (item.effect === "heal" || item.effect === "teamHeal") &&
    c.hp === c.maxHp &&
    heroHp(p) === heroMaxHp(p) &&
    item.effect !== "teamHeal"
  )
    throw new Error("Your companion is already healthy.");
  consume(p, itemId);
  if (item.effect === "heal") c.hp = Math.min(c.maxHp, c.hp + item.value);
  if (item.effect === "revive") c.hp = Math.ceil(c.maxHp * item.value);
  if (item.effect === "teamHeal")
    for (const member of p.creatures)
      if (p.team.includes(member.id) && member.hp > 0)
        member.hp = Math.min(member.maxHp, member.hp + item.value);
  if (item.effect === "charm") p.quests.charm = 1;
  if (
    item.effect === "heal" ||
    item.effect === "revive" ||
    item.effect === "teamHeal"
  )
    p.heroHp = Math.min(
      heroMaxHp(p),
      heroHp(p) + (item.effect === "revive" ? heroMaxHp(p) * 0.5 : item.value),
    );
  return item.effect;
}
export function abilityFor(p: Profile, slot: number, companion = false) {
  const ability = companion
    ? ABILITIES[activeCreature(p).moves[slot]]
    : heroClass(p.classId).abilities[slot];
  if (!ability) throw new Error("Ability is unavailable.");
  return ability;
}

export function requirePeace(p: { duelId?: string; combatUntil: number }) {
  if (p.duelId || p.combatUntil > Date.now())
    throw new Error("Finish your encounter first.");
}

function itemDefinition(id: string) {
  if (!Object.hasOwn(ITEMS, id)) throw new Error("Unknown item.");
  return ITEMS[id];
}
