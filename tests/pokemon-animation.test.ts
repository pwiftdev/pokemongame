import { NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { describe, expect, it } from "vitest";
import { POKEMON } from "../packages/shared/pokemon";
import { createPokemonPlaceholders } from "../apps/client/src/render/pokemon-placeholder";
import { pokemonMotion } from "../apps/client/src/render/pokemon-motion";

describe("procedural Pokémon rigs", () => {
  it("animates numbered and suffixed imported bones", () => {
    const engine = new NullEngine(),
      scene = new Scene(engine);
    const root = new TransformNode("pokemon", scene);
    for (const name of ["040 Head", "019 RThigh", "Head_07", "LArm_22"])
      new TransformNode(`pokemon:${name}`, scene).parent = root;
    const clips = pokemonMotion(root, scene);
    for (const clip of clips) expect(clip.targetedAnimations).toHaveLength(4);
    scene.dispose();
    engine.dispose();
  });
  it("provides eleven nonempty motions and shared primitive geometry for every species", () => {
    const engine = new NullEngine(),
      scene = new Scene(engine),
      library = createPokemonPlaceholders(scene);
    for (const p of Object.values(POKEMON)) {
      const actor = library.create(p.id, p.id, p.modelScale),
        clips = pokemonMotion(actor.root, scene, p.locomotion);
      expect(clips).toHaveLength(11);
      expect(
        clips.every((clip) => clip.targetedAnimations.length >= 4),
        p.id,
      ).toBe(true);
      expect(actor.meshes.every((mesh) => mesh.isAnInstance)).toBe(true);
      const faint = clips.find((clip) => clip.name.endsWith(":Death"))!;
      const body = faint.targetedAnimations.find(
        (animation) =>
          animation.target.name.endsWith(":Body") &&
          animation.animation.targetProperty === "rotationQuaternion",
      )!;
      expect(body.animation.getKeys().at(-1)!.value).not.toEqual(
        body.animation.getKeys()[0].value,
      );
      for (const clip of clips) clip.dispose();
      actor.dispose();
    }
    library.dispose();
    scene.dispose();
    engine.dispose();
  });
});
