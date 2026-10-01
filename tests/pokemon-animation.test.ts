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
  it("provides fourteen nonempty motions and shared primitive geometry for every species", () => {
    const engine = new NullEngine(),
      scene = new Scene(engine),
      library = createPokemonPlaceholders(scene);
    for (const p of Object.values(POKEMON)) {
      const actor = library.create(p.id, p.id, p.modelScale),
        clips = pokemonMotion(actor.root, scene, p.locomotion);
      expect(clips).toHaveLength(14);
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

it("animates static models at world scale and avoids duplicate authored clips", () => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  const model = new TransformNode("static model", scene),
    body = new TransformNode("body", scene);
  model.scaling.setAll(1000);
  model.parent = body;
  const clips = pokemonMotion(model, scene, "floating", body, 2, ["Idle"]);
  expect(clips.some((c) => c.name.endsWith(":Idle"))).toBe(false);
  expect(clips.every((c) => c.targetedAnimations.length === 3)).toBe(true);
  const position = clips
    .find((c) => c.name.endsWith(":Walk"))!
    .targetedAnimations.find((t) => t.animation.targetProperty === "position")!;
  const values = position.animation.getKeys().map((k) => k.value.y);
  expect(Math.max(...values)).toBeLessThan(0.5);
  expect(Math.min(...values)).toBeGreaterThan(0);
  for (const clip of clips) clip.dispose();
  scene.dispose();
  engine.dispose();
});
