import { POKEMON_MOVES } from "./pokemon-moves";
import { typeMultiplier, type PokemonType } from "./pokemon-types";
import type { Creature } from "./types";

export function chooseCompanionMove(
  creature: Creature,
  context: {
    now: number;
    distance: number;
    cooldowns: Record<string, number>;
    targetTypes: PokemonType[];
    statuses: string[];
    guarding: boolean;
  },
) {
  let best = -1,
    score = -Infinity;
  for (const [slot, id] of creature.moves.entries()) {
    const move = POKEMON_MOVES[id];
    if (!move || (context.cooldowns[id] ?? 0) > context.now) continue;
    const matchup = typeMultiplier(move.type, context.targetTypes);
    let value = (move.power * matchup) / Math.sqrt(move.cooldown);
    if (move.shape === "self") {
      if (move.effect === "heal")
        value = creature.hp < creature.maxHp * 0.6 ? 120 : -Infinity;
      else
        value = context.guarding
          ? -Infinity
          : creature.hp < creature.maxHp * 0.35
            ? 110
            : 12;
    } else {
      if (!matchup) continue;
      if (move.effect && !context.statuses.includes(move.effect)) value += 12;
      if (context.distance > move.range)
        value -= (context.distance - move.range) * 8;
    }
    if (value > score) {
      best = slot;
      score = value;
    }
  }
  return best;
}
