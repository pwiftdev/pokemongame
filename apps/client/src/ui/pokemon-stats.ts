import { trainingGoals } from "./training-goals";
import { escape as esc } from "./icons";
import { POKEMON, STAT_KEYS } from "../../../../packages/shared/pokemon";
import {
  availableMoves,
  pokemonStats,
} from "../../../../packages/shared/pokemon-rules";
import { POKEMON_MOVES } from "../../../../packages/shared/pokemon-moves";
import type { Creature } from "../../../../packages/shared/types";

export function pokemonStatsMarkup(creature: Creature) {
  if (!POKEMON[creature.species]) return "";
  const stats = pokemonStats(
    creature.species,
    creature.level,
    creature.ivs,
    creature.nature,
  );
  const labels = ["HP", "Attack", "Defense", "Sp. Atk", "Sp. Def", "Speed"];
  return `<div class="pokemon-stats"><div class="training-goals">${trainingGoals(
    creature,
  )
    .map((goal) => `<p>${esc(goal)}</p>`)
    .join(
      "",
    )}</div><strong>${creature.nature ?? "Hardy"} nature${creature.shiny ? " · Shiny" : ""}</strong><div class="stat-grid">${STAT_KEYS.map((key, i) => `<span>${labels[i]} <b>${stats[key]}</b><small>IV ${creature.ivs?.[key] ?? 0}/31</small></span>`).join("")}</div><details data-detail="moves:${creature.id}"><summary>Equip learned moves</summary>${creature.moves
    .map(
      (current, slot) =>
        `<label>Slot ${slot + 1}<select data-focus="move:${creature.id}:${slot}" data-learn-creature="${creature.id}" data-learn-slot="${slot}">${availableMoves(
          creature.species,
          creature.level,
        )
          .map(
            (id) =>
              `<option value="${id}" ${id === current ? "selected" : creature.moves.includes(id) ? "disabled" : ""}>${POKEMON_MOVES[id].name}</option>`,
          )
          .join("")}</select></label>`,
    )
    .join("")}<small>${POKEMON[creature.species].learnset
    .filter((entry) => entry.level > creature.level)
    .map((entry) => `Lv ${entry.level}: ${POKEMON_MOVES[entry.move].name}`)
    .join(" · ")}</small></details></div>`;
}
