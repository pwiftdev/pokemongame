import { Vector3, type ArcRotateCamera } from "@babylonjs/core";

export function labelPresentation(
  depth: number,
  width: number,
  fov: number,
  aspect: number,
  maxFraction = 0.24,
  desiredScale = 1,
) {
  const visible = Number.isFinite(depth) && depth >= 3.5;
  const maximumWidth =
    Math.max(0, depth) * 2 * Math.tan(fov / 2) * aspect * maxFraction;
  return { visible, scale: Math.min(desiredScale, maximumWidth / width) };
}
export function bodyVisibility(
  distance: number,
  hideDistance: number,
  fadeDistance: number,
) {
  return Math.max(
    0,
    Math.min(1, (distance - hideDistance) / (fadeDistance - hideDistance)),
  );
}
export function viewDepth(
  point: Vector3,
  cameraPosition: Vector3,
  forward: Vector3,
) {
  return Vector3.Dot(point.subtract(cameraPosition), forward);
}

export function followCameraTarget(
  camera: ArcRotateCamera,
  target: Vector3,
  dt: number,
) {
  camera.target.copyFrom(
    Vector3.Lerp(camera.target, target, 1 - Math.exp(-dt * 14)),
  );
}

export function turnTowards(current: number, target: number, dt: number) {
  const delta = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + delta * (1 - Math.exp(-dt * 14));
}
