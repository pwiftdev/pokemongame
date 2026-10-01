import { ABILITIES } from "../../../../packages/shared/data";
import { POKEMON_MOVES } from "../../../../packages/shared/pokemon-moves";
import type { GameEvent } from "../../../../packages/shared/types";
import type { CueId } from "./catalog";
export function abilitySound(id?: string, impact = false): CueId {
  const move = POKEMON_MOVES[id ?? ""],
    ability = move ?? ABILITIES[id ?? ""];
  if (ability?.effect === "heal") return "heal";
  if (["guard", "evasion"].includes(ability?.effect ?? "")) return "guard";
  if (move?.type === "ice" || /frost|ice|blizzard/.test(id ?? ""))
    return impact ? "ice" : "ice-cast";
  const physical = move
    ? move.category === "physical" &&
      ["normal", "fighting", "flying", "steel"].includes(move.type)
    : (ability?.range ?? 0) <= 5;
  if (physical) return impact ? "hit" : "swing";
  const element = ability?.element;
  return element === "flame"
    ? impact
      ? "fire-hit"
      : "fire"
    : element === "tide"
      ? "water"
      : element === "leaf"
        ? "leaf"
        : element === "stone"
          ? "earth"
          : element === "spark"
            ? "spark"
            : element === "spirit"
              ? "spirit"
              : impact
                ? "hit"
                : "magic";
}
export function impactSound(event: GameEvent): CueId {
  if (event.heal) return "heal";
  if (["block", "parry"].includes(event.outcome ?? "")) return "metal";
  if (["miss", "dodge", "evade", "immune"].includes(event.outcome ?? ""))
    return "swing";
  return event.outcome === "crit" && abilitySound(event.ability, true) === "hit"
    ? "heavy"
    : abilitySound(event.ability, true);
}
