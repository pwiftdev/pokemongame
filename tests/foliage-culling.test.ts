import { afterEach, describe, expect, it } from "vitest";
import { Matrix, MeshBuilder, NullEngine, Scene } from "@babylonjs/core";
import { createFoliageCulling } from "../apps/client/src/render/foliage-culling";

const engines: NullEngine[] = [];
afterEach(() => engines.splice(0).forEach((engine) => engine.dispose()));

function setup() {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  const mesh = MeshBuilder.CreateBox("grass", { size: 1 }, scene);
  const matrices = new Float32Array(100 * 16);
  for (let i = 0; i < 100; i++)
    Matrix.Translation(i % 10, 0, Math.floor(i / 10)).copyToArray(
      matrices,
      i * 16,
    );
  mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
  mesh.thinInstanceRefreshBoundingInfo();
  mesh.freezeWorldMatrix();
  const culling = createFoliageCulling();
  culling.add(mesh);
  return { mesh, culling };
}

describe("foliage visibility", () => {
  it("thins distant cells, disables far cells, and restores all instances after a teleport", () => {
    const { mesh, culling } = setup();
    const bounds = mesh.getBoundingInfo().boundingBox.maximumWorld.clone();
    culling.update({ x: 5, z: 5 }, false);
    expect(mesh.thinInstanceCount).toBe(100);
    culling.update({ x: 70, z: 5 }, false);
    const mediumCount = mesh.thinInstanceCount;
    expect(mediumCount).toBeGreaterThan(0);
    expect(mediumCount).toBeLessThan(100);
    culling.update({ x: 90, z: 5 }, false);
    expect(mesh.thinInstanceCount).toBeLessThan(mediumCount);
    culling.update({ x: -200, z: -200 }, false);
    expect(mesh.isEnabled()).toBe(false);
    expect(mesh.thinInstanceCount).toBe(0);
    culling.update({ x: 5, z: 5 }, false);
    expect(mesh.isEnabled()).toBe(true);
    expect(mesh.thinInstanceCount).toBe(100);
    expect(mesh.getBoundingInfo().boundingBox.maximumWorld).toEqual(bounds);
  });

  it("restores the correct density when quality changes and disposes its meshes", () => {
    const { mesh, culling } = setup();
    culling.update({ x: 70, z: 5 }, false);
    const count = mesh.thinInstanceCount;
    culling.update({ x: 70, z: 5 }, true);
    expect(mesh.isEnabled()).toBe(false);
    culling.update({ x: 70, z: 5 }, false);
    expect(mesh.thinInstanceCount).toBe(count);
    expect(mesh.isEnabled()).toBe(true);
    culling.dispose();
    expect(mesh.isDisposed()).toBe(true);
    expect(() => culling.dispose()).not.toThrow();
  });
});
