import { POKEMON } from "../../../../packages/shared/pokemon";
import { DEX_REWARDS } from "../../../../packages/shared/pokedex";
import { TYPE_COLORS } from "../../../../packages/shared/pokemon-types";
import type { Profile } from "../../../../packages/shared/types";
import { creaturePortrait } from "../roster";
import { escape as esc } from "./icons";

export function pokedexPanel(profile: Profile | null | undefined) {
  const dex = profile?.pokedex,
    caught = dex?.caught.length ?? 0;
  return `<div class="dex-overview"><strong>${caught} / ${Object.keys(POKEMON).length} caught</strong><span>${dex?.seen.length ?? 0} seen · Eight habitats to explore</span><progress value="${caught}" max="${Object.keys(POKEMON).length}"></progress><div>${DEX_REWARDS.map((reward) => `<button class="secondary compact" data-action="dex-reward:${reward.count}" ${caught < reward.count || dex?.rewards.includes(reward.count) ? "disabled" : ""}>${dex?.rewards.includes(reward.count) ? "Collected" : `${reward.count} caught · ${reward.amount} PD`}</button>`).join("")}</div></div><div class="dex-grid">${Object.values(
    POKEMON,
  )
    .sort((a, b) => a.number - b.number)
    .map((p) => {
      const seen = dex?.seen.includes(p.id),
        owned = dex?.caught.includes(p.id);
      return `<article class="dex-card ${seen ? "seen" : "unseen"}" style="--type-color:${TYPE_COLORS[p.types[0]]}"><span class="eyebrow">#${String(p.number).padStart(3, "0")} · ${owned ? "CAUGHT" : seen ? "SEEN" : "UNDISCOVERED"}</span><img src="${creaturePortrait(p.id)}" alt="${seen ? p.name : "Unseen silhouette"}" loading="lazy"/><h3>${seen ? p.name : "???"}</h3><span class="dex-types">${seen ? p.types.join(" / ") : "Unknown types"}</span><p>${seen ? esc(p.entry) : `Search the ${p.habitat} and watch quietly.`}</p><small>${p.habitat} · ${p.time === "any" ? "Any time" : p.time} · ${p.weather === "any" ? "Any weather" : p.weather}${seen ? ` · ${p.temperament}` : ""}</small></article>`;
    })
    .join("")}</div>`;
}
