import { POKEMON_MODELS } from "../roster";
export { POKEMON_MODELS } from "../roster";
import { createAnimationMixer } from "./animation-mixer";
import { pokemonMotion } from "./pokemon-motion";
import { createPokemonPlaceholders } from "./pokemon-placeholder";
import { POKEMON } from "../../../../packages/shared/pokemon";
import { TransformNode, type AbstractMesh, type Scene } from "@babylonjs/core";
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
export type Motion =
  | "idle-variant"
  | "run"
  | "attack-alt"
  | "special"
  | "sleep"
  | "idle"
  | "move"
  | "attack"
  | "hit"
  | "defeat"
  | "celebrate";
const CLIPS: Record<Motion, string[]> = {
  "idle-variant": ["Idle_Variant", "Idle"],
  run: ["Run", "Fast_Flying", "Walk", "model_skeleton|001run"],
  "attack-alt": ["Attack_Alt", "Headbutt", "Bite_InPlace"],
  special: ["Special", "Punch", "Bite_InPlace"],
  sleep: ["Sleep", "Idle"],
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
export async function loadCreatures(
  scene: Scene,
  onReady?: (meshes: AbstractMesh[]) => void,
  preloadPokemon = false,
) {
  const placeholders = createPokemonPlaceholders(scene);
  const library = await loadModelLibrary(scene, {
    ...modelUrls("monsters", [...CREATURE_MODELS, ...EVOLVED_MODELS]),
    ...(preloadPokemon ? modelUrls("pokemon", POKEMON_MODELS) : {}),
  });
  return {
    create(name: string, id: string, height = 1.5) {
      const pokemon = POKEMON[name.toLowerCase()];
      if (pokemon) name = pokemon.name;
      const deferred = !!pokemon && !library.has(name);
      let placeholder = deferred;
      let actor = deferred
        ? placeholders.create(name.toLowerCase(), id, height)
        : library.create(name, id, height, true);
      const holder = new TransformNode(`${id}:holder`, scene);
      actor.root.parent = holder;
      const meshes = [...actor.meshes];
      let disposed = false;
      let animated = true;
      if (pokemon)
        actor.animations.push(
          ...pokemonMotion(actor.root, scene, pokemon?.locomotion),
        );
      let mixer = createAnimationMixer(scene, actor.animations);
      let current: Motion = "idle";
      const clips = new Map<Motion, string>();
      function indexClips() {
        clips.clear();
        for (const motion of Object.keys(CLIPS) as Motion[]) {
          const group = actor.animations.find((a) =>
            CLIPS[motion].some((clip) => a.name.endsWith(`:${clip}`)),
          );
          if (group) clips.set(motion, group.name.split(":").at(-1)!);
        }
      }
      indexClips();
      const animate = (next: Motion, duration?: number) => {
        current = next;
        if (!animated) return;
        const clip = clips.get(next);
        if (!clip) return;
        mixer.play(
          clip,
          [
            "idle",
            "idle-variant",
            "move",
            "run",
            "celebrate",
            "sleep",
          ].includes(next),
          duration,
        );
      };
      animate("idle");
      const ready = deferred
        ? library
            .load(name, `/assets/pokemon/${name}.glb`)
            .then(() => {
              if (disposed || scene.isDisposed) return false;
              mixer.dispose();
              for (const group of actor.animations) group.dispose();
              actor.dispose();
              actor = library.create(name, id, height, true);
              placeholder = false;
              actor.root.parent = holder;
              actor.animations.push(
                ...pokemonMotion(actor.root, scene, pokemon?.locomotion),
              );
              mixer = createAnimationMixer(scene, actor.animations);
              indexClips();
              meshes.splice(0, meshes.length, ...actor.meshes);
              onReady?.(meshes);
              animate(current);
              return true;
            })
            .catch((error) => {
              console.warn(
                `Pokémon model ${name} unavailable; using temporary fallback`,
                error,
              );
              return false;
            })
        : Promise.resolve(true);
      return {
        root: holder,
        ready,
        get modelReady() {
          return !placeholder;
        },
        meshes,
        setDetail(distance: number) {
          const near = distance < 48;
          if (animated && !near) mixer.stop();
          animated = near;
          if (placeholder)
            for (const mesh of meshes) {
              if (mesh.name.endsWith(":mesh"))
                mesh.setEnabled(
                  distance < 38 || /:(Torso|Head):mesh$/.test(mesh.name),
                );
            }
        },
        animate,
        dispose() {
          disposed = true;
          mixer.dispose();
          for (const group of actor.animations) group.dispose();
          actor.dispose();
          holder.dispose();
        },
      };
    },
    dispose: () => {
      library.dispose();
      placeholders.dispose();
    },
  };
}
export type CreatureActor = ReturnType<
  Awaited<ReturnType<typeof loadCreatures>>["create"]
>;
