import { FIELD_RESEARCH } from "./field-research";
import { HABITATS, SPAWNS } from "./encounters";
import type { Quest } from "./story";
export const EXPEDITIONS: Quest[] = [
  ...FIELD_RESEARCH.map(
    (study): Quest => ({
      ...study,
      id: study.id.replace("research-", "expedition-"),
      name: study.name.replace("field study", "collection expedition"),
      prerequisite: study.id,
      repeatable: true,
      goal: 3,
      reward: 90,
      xp: 200,
      description: `Catch three different Pokémon species in this region after accepting. Return to the board for rewards, then take another expedition. ${study.description.split(". ").slice(1).join(". ")}`,
      dialogue:
        "Build a varied team while contributing new field records. Each expedition starts a fresh species checklist.",
      completion:
        "Your field records are complete. Another expedition is available whenever you are ready.",
    }),
  ),
  ...HABITATS.filter((h) => h.kind === "camp").map(
    (habitat): Quest => ({
      id: `patrol-${habitat.id}`,
      name: `${habitat.name} patrol`,
      key: `camp:${habitat.id}`,
      prerequisite: "story-catch",
      repeatable: true,
      side: true,
      giver: "quest",
      goal: Math.min(4, SPAWNS.filter((s) => s.habitat === habitat.id).length),
      reward: 65,
      xp: 160,
      description: `Defeat ${Math.min(4, SPAWNS.filter((s) => s.habitat === habitat.id).length)} hostile monsters at ${habitat.name}. Shared victories count when you contribute. Return to the board to collect your reward and start a fresh patrol.`,
      dialogue:
        "Keep the routes clear for explorers and wild Pokémon. Bring an ally if this camp is too strong for your team.",
      completion:
        "The route is safer. Rest, adjust your team, and choose your next patrol.",
      destination: { x: habitat.x, z: habitat.z, name: habitat.name },
    }),
  ),
];
