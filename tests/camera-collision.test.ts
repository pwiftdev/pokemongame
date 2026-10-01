import { afterEach, describe, expect, it } from "vitest";
import {
  ArcRotateCamera,
  MeshBuilder,
  NullEngine,
  Scene,
  Vector3,
} from "@babylonjs/core";
import { createCameraCollision } from "../apps/client/src/render/camera-collision";

const engines: NullEngine[] = [];
afterEach(() => engines.splice(0).forEach((engine) => engine.dispose()));
function setup() {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    1.3,
    15,
    new Vector3(0, 1.7, 0),
    scene,
  );
  const canopy = MeshBuilder.CreateSphere(
    "environment:forest canopy",
    { diameter: 6 },
    scene,
  );
  canopy.position.set(0, 4, -9);
  canopy.isPickable = false;
  canopy.computeWorldMatrix(true);
  return { camera, canopy, collision: createCameraCollision(scene, camera) };
}
describe("camera geometry obstruction", () => {
  it("includes scenery that finishes loading after the camera was created", () => {
    const { camera, canopy, collision } = setup();
    canopy.setEnabled(false);
    const late = MeshBuilder.CreateSphere(
      "late rock",
      { diameter: 6 },
      camera.getScene(),
    );
    late.metadata = { cameraObstacle: true };
    late.position.set(0, 4, -9);
    late.computeWorldMatrix(true);
    collision.include([late]);
    collision.update(0, 0.016);
    expect(camera.radius).toBeLessThan(8);
  });
  it("stays in front of actual canopy geometry even when normal picking is disabled", () => {
    const { camera, collision } = setup();
    collision.reset(15);
    collision.update(0, 0.016);
    expect(camera.radius).toBeGreaterThan(0.85);
    expect(camera.radius).toBeLessThan(8);
    expect(collision.metrics().preferredRadius).toBe(15);
  });
  it("restores the chosen zoom after obstruction clears and retains wheel adjustments", () => {
    const { camera, canopy, collision } = setup();
    collision.reset(15);
    collision.update(0, 0.016);
    camera.radius += 2;
    collision.update(0.1, 0.016);
    expect(collision.metrics().preferredRadius).toBe(17);
    canopy.position.x = 30;
    canopy.computeWorldMatrix(true);
    for (let i = 1; i < 5; i++) collision.update(i, 1);
    expect(camera.radius).toBe(17);
  });
  it("allows camera clearance below the normal five-metre zoom limit", () => {
    const { camera, canopy, collision } = setup();
    canopy.position.set(0, 3, -5);
    canopy.computeWorldMatrix(true);
    collision.update(0, 0.016);
    expect(camera.radius).toBeLessThan(5);
    expect(camera.radius).toBeGreaterThanOrEqual(0.85);
  });
  it("throttles triangle raycasts between checks", () => {
    const { collision } = setup();
    collision.update(0, 0.016);
    collision.update(0.016, 0.016);
    collision.update(0.032, 0.016);
    expect(collision.metrics().checks).toBe(1);
    collision.update(0.08, 0.016);
    expect(collision.metrics().checks).toBe(2);
  });
});
