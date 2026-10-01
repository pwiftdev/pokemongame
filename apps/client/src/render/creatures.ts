import { POKEMON_MODELS } from "../roster";
export { POKEMON_MODELS } from "../roster";
import { createAnimationMixer } from "./animation-mixer";
import { addBodyMotion } from "./creature-body-motion";
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
import {
  CREATURE_CLIPS,
  creatureClip,
  loopMotion,
  motionDuration,
  type Motion,
} from "./creature-clips";
import { creatureSeed } from "../../../../packages/shared/creature-motion";
export type { Motion } from "./creature-clips";
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
      const motionRoot = new TransformNode(`${id}:motion`, scene);
      motionRoot.parent = holder;
      actor.root.parent = motionRoot;
      const meshes = [...actor.meshes];
      let disposed = false;
      let animated = true;
      const phase = creatureSeed(id);
      function prepareAnimations() {
        motionRoot.position.setAll(0);
        motionRoot.rotation.setAll(0);
        motionRoot.scaling.setAll(1);
        if (!pokemon) return;
        const authored = actor.animations.map((a) => a.name.split(":").at(-1)!);
        for (const group of actor.animations)
          addBodyMotion(group, motionRoot, "Authored", "biped", height);
        actor.animations.push(
          ...pokemonMotion(
            actor.root,
            scene,
            pokemon.locomotion,
            motionRoot,
            height,
            authored,
          ),
        );
      }
      prepareAnimations();
      let mixer = createAnimationMixer(scene, actor.animations);
      let current: Motion = "idle";
      const clips = new Map<Motion, string>();
      function indexClips() {
        clips.clear();
        const names = actor.animations.map((a) => a.name.split(":").at(-1)!);
        for (const motion of Object.keys(CREATURE_CLIPS) as Motion[]) {
          const clip = creatureClip(names, motion);
          if (clip) clips.set(motion, clip);
        }
      }
      indexClips();
      const animate = (next: Motion, duration?: number, restart = false) => {
        current = next;
        if (!animated) return;
        const clip = clips.get(next);
        if (!clip) return;
        mixer.play(
          clip,
          loopMotion(next),
          duration ?? motionDuration(next, phase),
          restart,
          phase,
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
              actor.root.parent = motionRoot;
              prepareAnimations();
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
          const resume = !animated && near;
          animated = near;
          if (resume) animate(current);
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
