import { Mesh, NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { expect, it } from "vitest";
import { cacheEnabledMeshCandidates } from "../apps/client/src/render/mesh-candidates";

it("tracks enabled meshes through parents, reparenting, spawning, removal and disposal", async () => {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  const parent = new TransformNode("scenery", scene);
  const child = new Mesh("tree", scene);
  child.parent = parent;
  const previous = scene.getActiveMeshCandidates;
  const dispose = cacheEnabledMeshCandidates(scene);
  const candidates = () => scene.getActiveMeshCandidates().data;
  try {
    expect(candidates()).toEqual([child]);
    expect(candidates()).toBe(candidates());
    parent.setEnabled(false);
    expect(candidates()).toEqual([]);
    child.parent = null;
    expect(candidates()).toEqual([child]);
    child.parent = parent;
    expect(candidates()).toEqual([]);
    parent.setEnabled(true);
    expect(candidates()).toEqual([child]);
    child.setEnabled(false);
    parent.setEnabled(false);
    parent.setEnabled(true);
    expect(candidates()).toEqual([]);
    const spawned = new Mesh("effect", scene);
    expect(candidates()).toEqual([spawned]);
    scene.removeMesh(spawned);
    expect(candidates()).toEqual([]);
    scene.addMesh(spawned);
    expect(candidates()).toEqual([spawned]);
    child.setEnabled(true);
    expect(new Set(candidates())).toEqual(new Set([child, spawned]));
    spawned.dispose();
    expect(candidates()).toEqual([child]);
    const transient = new Mesh("short lived", scene);
    transient.dispose();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(candidates()).toEqual([child]);
    dispose();
    expect(scene.getActiveMeshCandidates).toBe(previous);
    parent.setEnabled(false);
  } finally {
    scene.dispose();
    engine.dispose();
  }
});
