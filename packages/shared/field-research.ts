import { POKEMON_HABITATS } from "./pokemon-habitats";
import { REGIONS } from "./regions";
import type { Quest } from "./story";
import type { Biome } from "./types";

const notes: Record<Biome, string> = {
  town: "Visit Moonlit Gardens after dark. Bring bait for a peaceful encounter inside the safe haven.",
  meadow:
    "Search the flower beds and orchard edges. Curious Pokémon linger near feeding grounds.",
  forest:
    "Look beneath the canopy and around berry clearings. Give territorial residents room before approaching.",
  ruins:
    "Explore the broken courts in daylight and after dark; their residents change with the light.",
  desert:
    "Follow the road to Warmstone Hollow. Watch the sunlit rocks for basking Pokémon.",
  marsh:
    "Follow the reed banks to Ripple Pools. Watch the water before approaching its residents.",
  tundra:
    "Find Snowroot Herd below the snowy ridges. Prepare healing supplies before leaving the road.",
  highlands:
    "Head toward Cloudspring Ridge. Look around the open slopes and sheltered spring.",
};
export const FIELD_RESEARCH: Quest[] = POKEMON_HABITATS.map((habitat) => ({
  id: `research-${habitat.biome}`,
  name: `${REGIONS.find((region) => region.id === habitat.biome)!.name} field study`,
  prerequisite: "story-catch",
  giver: "quest",
  key: `research:${habitat.biome}`,
  goal: 2,
  reward: 70,
  xp: 140,
  side: true,
  description: `Catch two different Pokémon species in this region after accepting the study. ${notes[habitat.biome]}`,
  dialogue:
    "Bring back two different species for the regional field record. Repeated catches of the same species count once.",
  completion:
    "Two new field records. Your companions have earned experience, and the expedition has a better picture of this region.",
  destination: { x: habitat.x, z: habitat.z, name: habitat.name },
}));
export function regionFieldNote(biome: Biome) {
  return notes[biome];
}
