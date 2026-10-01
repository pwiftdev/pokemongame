import { POKEMON } from "../../../../packages/shared/pokemon";
import { POKEMON_MOVES } from "../../../../packages/shared/pokemon-moves";
import { BIOMES, ITEMS } from "../../../../packages/shared/data";
import type { Creature } from "../../../../packages/shared/types";

export function trainingGoals(creature: Pick<Creature, "species" | "level">) {
  const species = POKEMON[creature.species];
  if (!species) return [];
  const next = species.learnset
    .filter((entry) => entry.level > creature.level)
    .sort((a, b) => a.level - b.level)[0];
  const goals: string[] = [];
  if (next)
    goals.push(
      `Next move: ${POKEMON_MOVES[next.move].name} at level ${next.level}`,
    );
  for (const evolution of species.evolutions) {
    const requirements = [
      creature.level < evolution.level
        ? `level ${evolution.level}`
        : "level reached",
    ];
    if (evolution.item)
      requirements.push(ITEMS[evolution.item]?.name ?? evolution.item);
    if (evolution.location) requirements.push(BIOMES[evolution.location].name);
    goals.push(
      `${POKEMON[evolution.species].name}: ${requirements.join(" · ")}`,
    );
  }
  if (!goals.length)
    goals.push(
      "All level-up moves learned. Try a new move combination or regional field study.",
    );
  return goals;
}
