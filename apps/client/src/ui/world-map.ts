import { HABITATS } from "../../../../packages/shared/encounters";
import {
  currentQuest,
  questDestination,
} from "../../../../packages/shared/story";
import { escape as esc } from "./icons";
import {
  REGIONS,
  ROADS,
  WAYSTONES,
  WORLD_RADIUS,
  regionBiome,
} from "../../../../packages/shared/regions";
import type { Profile } from "../../../../packages/shared/types";
export function mapPoint(x: number, z: number) {
  return {
    x: 50 + (x / (WORLD_RADIUS * 2)) * 92,
    y: 50 - (z / (WORLD_RADIUS * 2)) * 92,
  };
}
export function worldMap(profile?: Profile) {
  const point = (x: number, z: number) => {
    const p = mapPoint(x, z);
    return `${p.x * 8},${p.y * 6.5}`;
  };
  let tiles = "";
  for (let x = -300; x < 300; x += 15)
    for (let z = -300; z < 300; z += 15) {
      if (Math.hypot(x + 7.5, z + 7.5) > WORLD_RADIUS) continue;
      const p = mapPoint(x, z + 15),
        r = REGIONS.find((r) => r.id === regionBiome(x, z))!;
      tiles += `<rect x="${p.x * 8}" y="${p.y * 6.5}" width="19" height="15.5" fill="${r.color}"/>`;
    }
  const quest = profile && currentQuest(profile);
  const destination = profile && quest && questDestination(profile, quest);
  const destinationPoint =
    destination && mapPoint(destination.x, destination.z);
  return `${destination ? `<p class="map-objective">Current objective: ${esc(destination.name)}</p>` : ""}<div class="island-map"><svg class="map-art" viewBox="0 0 800 650" aria-hidden="true"><defs><clipPath id="continent"><ellipse cx="400" cy="325" rx="368" ry="299"/></clipPath></defs><rect width="800" height="650" fill="#254d59"/><g clip-path="url(#continent)">${tiles}${ROADS.map((road) => `<polyline points="${road.map(([x, z]) => point(x, z)).join(" ")}" fill="none" stroke="#f3dda6" stroke-width="3" opacity=".7"/>`).join("")}</g></svg>${WAYSTONES.map(
    (r) => {
      const p = mapPoint(r.x, r.z),
        known = profile?.waystones?.includes(r.id);
      return `<button class="map-pin region-pin ${known ? "" : "undiscovered"}" style="left:${p.x}%;top:${p.y}%" data-action="travel:${r.id}" title="${known ? "Travel from a nearby waystone" : "Visit to unlock travel"}"><span>${r.name}<small>${r.level} · ${known ? "WAYSTONE ATTUNED" : "UNDISCOVERED"}</small></span></button>`;
    },
  ).join("")}${HABITATS.map((h) => {
    const p = mapPoint(h.x, h.z);
    return `<span class="habitat-pin ${h.kind}" style="left:${p.x}%;top:${p.y}%" title="${esc(h.name)} · ${esc(h.description)}">${h.kind === "pokemon" ? "○" : h.kind === "boss" ? "◆" : "×"}</span>`;
  }).join(
    "",
  )}${destination && destinationPoint ? `<span class="story-map-pin" style="left:${destinationPoint.x}%;top:${destinationPoint.y}%" title="${esc(destination.name)}">◆</span>` : ""}<div id="map-player" class="map-player" aria-label="Your location"></div><div class="map-north">N<span>↑</span></div></div><div class="map-notes story-map-notes"><p>Gold diamond: story objective · Green circles: Pokémon habitats · Red crosses: monster camps.</p><p>Follow the stone roads to new regions. Approach each waystone to attune it. Travel between attuned waystones while nearby and out of combat.</p><div class="habitat-guide">${HABITATS.filter(
    (h) => h.kind === "pokemon",
  )
    .map(
      (h) =>
        `<span><strong>${esc(h.name)}</strong>${esc(h.description)}</span>`,
    )
    .join("")}</div></div>`;
}
