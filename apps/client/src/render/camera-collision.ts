import {
  Matrix,
  Ray,
  Vector3,
  type ArcRotateCamera,
  type Scene,
} from "@babylonjs/core";
import { terrainHeight } from "../../../../packages/shared/rules";

export function createCameraCollision(scene: Scene, camera: ArcRotateCamera) {
  const geometry = new Set(
    scene.meshes.filter(
      (mesh) =>
        mesh.metadata?.cameraObstacle === true ||
        (mesh.metadata?.cameraObstacle === undefined &&
          mesh.name.startsWith("environment:") &&
          !/cloud|petals|glow|water/.test(mesh.name)),
    ),
  );
  const samples: number[] = [];
  let preferredRadius = 15,
    lastAppliedRadius = 15,
    clearance = 15,
    lastCheck = -Infinity,
    checks = 0;
  const direction = new Vector3(),
    right = new Vector3(),
    endpoint = new Vector3();
  function reset(radius: number) {
    preferredRadius = radius;
    lastAppliedRadius = radius;
    clearance = radius;
    lastCheck = -Infinity;
  }
  function update(now: number, dt: number) {
    const inputDelta = camera.radius - lastAppliedRadius;
    if (Math.abs(inputDelta) > 0.001)
      preferredRadius = Math.max(5, Math.min(24, preferredRadius + inputDelta));
    direction.set(
      Math.cos(camera.alpha) * Math.sin(camera.beta),
      Math.cos(camera.beta),
      Math.sin(camera.alpha) * Math.sin(camera.beta),
    );
    right.set(-direction.z, 0, direction.x).normalize();
    if (now - lastCheck >= 0.07) {
      const started = performance.now();
      clearance = preferredRadius;
      const candidates = [...geometry].filter(
        (mesh) =>
          mesh.isEnabled() &&
          !mesh.isDisposed() &&
          Vector3.DistanceSquared(
            mesh.getBoundingInfo().boundingSphere.centerWorld,
            camera.target,
          ) <
            Math.pow(
              preferredRadius +
                mesh.getBoundingInfo().boundingSphere.radiusWorld,
              2,
            ),
      );
      for (const offset of [0, -0.32, 0.32]) {
        endpoint
          .copyFrom(camera.target)
          .addInPlace(direction.scale(preferredRadius))
          .addInPlace(right.scale(offset));
        const rayDirection = endpoint.subtract(camera.target);
        const length = rayDirection.length();
        rayDirection.scaleInPlace(1 / length);
        const ray = new Ray(camera.target, rayDirection, length + 0.4);
        for (const mesh of candidates) {
          const local = Ray.Transform(
            ray,
            Matrix.Invert(mesh.getWorldMatrix()),
          );
          const hit = mesh.intersects(
            local,
            false,
            undefined,
            false,
            mesh.getWorldMatrix(),
          );
          if (hit.hit)
            clearance = Math.min(
              clearance,
              Math.max(0.85, hit.distance - 0.55),
            );
        }
      }
      for (let distance = 0.85; distance < clearance; distance += 0.25) {
        const p = camera.target.add(direction.scale(distance));
        if (p.y < terrainHeight(p.x, p.z) + 0.35) {
          clearance = Math.max(0.85, distance - 0.35);
          break;
        }
      }
      lastCheck = now;
      checks++;
      samples.push(performance.now() - started);
      if (samples.length > 120) samples.shift();
    }
    const targetRadius = Math.min(preferredRadius, clearance);
    camera.radius =
      targetRadius < camera.radius
        ? targetRadius
        : Math.min(targetRadius, camera.radius + dt * 5);
    lastAppliedRadius = camera.radius;
  }
  return {
    reset,
    update,
    metrics: () => ({
      checks,
      preferredRadius,
      clearance,
      appliedRadius: camera.radius,
      raycastMs: [...samples],
    }),
  };
}
