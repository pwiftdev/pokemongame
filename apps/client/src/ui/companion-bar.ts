import { POKEMON_MOVES } from "../../../../packages/shared/pokemon-moves";
import { TYPE_COLORS } from "../../../../packages/shared/pokemon-types";
import type { Profile, PlayerView } from "../../../../packages/shared/types";
import { slot, updateSlot } from "./action-bar";
import { escape as esc } from "./icons";

export function companionBarMarkup(profile: Profile) {
  const creature = profile.creatures.find((c) => c.id === profile.active);
  return `<div class="pet-bar-label">COMPANION <button class="text-button" data-action="greet-companion" title="Greet your Pokémon while resting">Greet</button><span>Ctrl + 1–4</span></div><div class="action-slots">${(
    creature?.moves ?? []
  )
    .map((id, i) => {
      const move = POKEMON_MOVES[id];
      return move
        ? slot(`petmove:${i}`, id, `ability:${id}`, `⌃${i + 1}`, move.name, {
            attributes: `data-pet-ability="${id}" style="--element:${TYPE_COLORS[move.type]}"`,
          })
        : "";
    })
    .join("")}</div><div class="pet-team">${profile.team
    .map((id, i) => {
      const c = profile.creatures.find((c) => c.id === id)!;
      return `<button data-action="swap:${i}" title="${esc(c.nickname || c.species)} · Quick swap · Shift + ${i + 1}" class="${id === profile.active ? "active" : ""}"><span>${esc(c.nickname || c.species)}</span><kbd>⇧${i + 1}</kbd></button>`;
    })
    .join("")}</div>`;
}
export function updateCompanionBar(
  root: Element,
  self: PlayerView | undefined,
  now: number,
) {
  root
    .querySelectorAll<HTMLButtonElement>("[data-pet-ability]")
    .forEach((button) => {
      const move = POKEMON_MOVES[button.dataset.petAbility!];
      updateSlot(button, {
        remaining: Math.max(
          0,
          ((self?.pet?.cooldowns[move.id] ?? 0) - now) / 1000,
        ),
        duration: move.cooldown,
        gcd: false,
        reason: self?.pet?.hp === 0 ? "Companion fainted" : "",
        highlight: false,
      });
    });
}
