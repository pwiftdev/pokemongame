import { createAnimationMixer } from "./animation-mixer";
import { pokemonMotion } from "./pokemon-motion";
import { type Scene } from "@babylonjs/core";
import { loadModelLibrary, modelUrls } from "./models";

export const CREATURE_MODELS = [
  "Mushnub",
  "Dragon",
  "Glub",
  "Goleling",
  "GreenSpikyBlob",
  "Armabee",
  "Cactoro",
  "Hywirl",
  "Orc_Skull",
  "Squidle",
  "Birb",
  "Yeti",
] as const;
export const EVOLVED_MODELS = [
  "Mushnub_Evolved",
  "Dragon_Evolved",
  "Glub_Evolved",
] as const;
export const POKEMON_MODELS = [
  "Bulbasaur",
  "Charmander",
  "Squirtle",
  "Ivysaur",
  "Charmeleon",
  "Wartortle",
];
export type Motion =
  | "idle"
  | "move"
  | "attack"
  | "hit"
  | "defeat"
  | "celebrate";
const CLIPS: Record<Motion, string[]> = {
  idle: ["Idle", "Flying_Idle", "model_skeleton|001aidle"],
  move: ["Walk", "Fast_Flying", "Run", "model_skeleton|001run"],
  attack: [
    "Bite_InPlace",
    "Bite_Front",
    "Headbutt",
    "Punch",
    "model_skeleton|001fight_b",
  ],
  hit: ["HitRecieve", "HitReact", "model_skeleton|001fight_d"],
  defeat: ["Death", "No", "model_skeleton|001ko"],
  celebrate: ["Dance", "Yes", "Flying_Idle", "model_skeleton|001jump_s"],
};
export async function loadCreatures(scene: Scene) {
  const library = await loadModelLibrary(scene, {
    ...modelUrls("monsters", [...CREATURE_MODELS, ...EVOLVED_MODELS]),
    ...modelUrls("pokemon", POKEMON_MODELS),
  });
  return {
    create(name: string, id: string, height = 1.5) {
      const actor = library.create(name, id, height, true);
      if (POKEMON_MODELS.includes(name) && !actor.animations.length)
        actor.animations.push(...pokemonMotion(actor.root, scene));
      const mixer = createAnimationMixer(scene, actor.animations);
      let motion: Motion = "idle";
      const animate = (next: Motion, duration?: number) => {
        if (mixer.clip && next === motion) return;
        const group = CLIPS[next]
          .map((clip) =>
            actor.animations.find((a) => a.name.endsWith(`:${clip}`)),
          )
          .find(Boolean);
        if (!group) return;
        motion = next;
        mixer.play(
          group.name.split(":").at(-1)!,
          next === "idle" || next === "move" || next === "celebrate",
          duration,
        );
      };
      animate("idle");
      return {
        ...actor,
        animate,
        dispose() {
          mixer.dispose();
          actor.dispose();
        },
      };
    },
    dispose: () => library.dispose(),
  };
}
export type CreatureActor = ReturnType<
  Awaited<ReturnType<typeof loadCreatures>>["create"]
>;
