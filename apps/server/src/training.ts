import {
  TRAINING_TARGETS,
  TRAINING_SPECIES,
  PRACTICE_IDLE_MS,
  practiceHit,
} from "../../../packages/shared/training.js";
import { distance } from "../../../packages/shared/rules.js";
import type { GameEvent } from "../../../packages/shared/types.js";
import type { Player, Wild } from "./room.js";
import { clearAuras, dueTicks, removeAura } from "./auras.js";
export const TRAINING_SPAWNS = TRAINING_TARGETS.map((target) => ({
  ...target,
  species: TRAINING_SPECIES,
  level: 5,
  habitat: "training",
  elite: false,
  boss: false,
}));
export function trainingHealth(id: string, maxHp: number) {
  return Math.round(
    maxHp * (TRAINING_TARGETS.find((t) => t.id === id)?.health ?? 1),
  );
}
export function hitTrainingTarget(
  p: Player,
  target: Wild,
  damage: number,
  ability: string,
  now: number,
) {
  target.hp = Math.max(1, target.hp - damage);
  target.lastAttack = now;
  p.practice = practiceHit(p.practice, target.id, damage, ability, now);
}
export function tickTrainingTarget(
  target: Wild,
  players: Map<string, Player>,
  now: number,
  event: (event: GameEvent) => void,
) {
  for (const aura of dueTicks(target, now)) {
    const source = players.get(aura.source ?? "");
    if (
      source?.online &&
      !source.duelId &&
      aura.tick &&
      distance(source, target) < 30
    ) {
      hitTrainingTarget(
        source,
        target,
        aura.tick,
        aura.ability ?? aura.id,
        now,
      );
      event({
        type: "dot",
        source: source.profile.id,
        target: target.id,
        amount: aura.tick,
        ability: aura.ability,
        message: "Practice damage",
      });
    }
  }
  if (now - target.lastAttack > PRACTICE_IDLE_MS) {
    target.hp = trainingHealth(target.id, target.maxHp);
    clearAuras(target);
  }
  target.threat.clear();
  target.target = undefined;
  target.state = "idle";
}
export function resetPractice(p: Player, wilds: Map<string, Wild>) {
  const trainingIds = new Set(TRAINING_TARGETS.map((t) => t.id as string));
  p.practice = undefined;
  if (trainingIds.has(p.auto?.target ?? "")) p.auto = undefined;
  if (trainingIds.has(p.cast?.target ?? "")) p.cast = undefined;
  if (trainingIds.has(p.petTarget ?? "")) {
    p.petTarget = undefined;
    if (p.pet) {
      p.pet.cast = undefined;
      p.pet.command = undefined;
    }
  }
  for (const id of trainingIds) {
    const target = wilds.get(id);
    if (target)
      for (const [key, aura] of target.auras)
        if (aura.source === p.profile.id) removeAura(target, key);
  }
}
