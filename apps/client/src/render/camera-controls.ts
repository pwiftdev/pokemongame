import { type ArcRotateCamera } from "@babylonjs/core";

export function createCameraControls(
  canvas: HTMLCanvasElement,
  camera: ArcRotateCamera,
  enabled: () => boolean,
  select: (x: number, y: number, attack: boolean) => void,
) {
  let pointer:
    | { id: number; x: number; y: number; distance: number; button: number }
    | undefined;
  let sensitivity = 1;
  const release = () => {
    if (pointer && canvas.hasPointerCapture(pointer.id))
      canvas.releasePointerCapture(pointer.id);
    pointer = undefined;
    canvas.classList.remove("orbiting");
  };
  const down = (event: PointerEvent) => {
    if (!enabled() || ![0, 1, 2].includes(event.button)) return;
    release();
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      distance: 0,
      button: event.button,
    };
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({ preventScroll: true });
    event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!enabled()) {
      release();
      return;
    }
    const dx = event.clientX - pointer.x,
      dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.distance += Math.hypot(dx, dy);
    if (pointer.distance < 4) return;
    canvas.classList.add("orbiting");
    camera.alpha -= dx * 0.005 * sensitivity;
    camera.beta = Math.max(
      0.38,
      Math.min(1.48, camera.beta - dy * 0.004 * sensitivity),
    );
    event.preventDefault();
  };
  const up = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const click =
      pointer.button !== 1 && pointer.distance < 4 && enabled()
        ? pointer.button
        : -1;
    release();
    if (click >= 0) select(event.clientX, event.clientY, click === 2);
  };
  const wheel = (event: WheelEvent) => {
    if (!enabled()) return;
    event.preventDefault();
    camera.radius = Math.max(
      5,
      Math.min(24, camera.radius + Math.sign(event.deltaY) * 0.8),
    );
  };
  const context = (event: Event) => event.preventDefault();
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("lostpointercapture", release);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("contextmenu", context);
  window.addEventListener("blur", release);
  return {
    update(dt: number, left: boolean, right: boolean) {
      if (!enabled()) {
        release();
        return;
      }
      camera.alpha += (Number(left) - Number(right)) * dt * 1.6;
    },
    setSensitivity(value: number) {
      sensitivity = Math.max(0.2, Math.min(3, value));
    },
    dispose() {
      release();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", release);
      canvas.removeEventListener("lostpointercapture", release);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("contextmenu", context);
      window.removeEventListener("blur", release);
    },
  };
}
