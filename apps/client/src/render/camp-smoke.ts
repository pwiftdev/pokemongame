import {
  Color4,
  DynamicTexture,
  ParticleSystem,
  Vector3,
  type Scene,
} from "@babylonjs/core";
import { terrainHeight } from "../../../../packages/shared/rules";
export function createCampSmoke(scene: Scene) {
  const texture = new DynamicTexture("soft smoke", 64, scene, false),
    ctx = texture.getContext() as CanvasRenderingContext2D;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.35, "#ffffff99");
  gradient.addColorStop(1, "#ffffff00");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  texture.update();
  const smoke = new ParticleSystem("chimneys and camp smoke", 80, scene);
  smoke.particleTexture = texture;
  smoke.emitter = Vector3.Zero();
  const sources = [
    [-8.9, -35.7, 4.7],
    [8.9, -34.3, 4.7],
    [-183, -14, 0.6],
    [-19, 234, 0.6],
    [185, -2, 0.6],
  ].map(([x, z, y]) => new Vector3(x, terrainHeight(x, z) + y, z));
  smoke.startPositionFunction = (_matrix, out) =>
    out.copyFrom(sources[Math.floor(Math.random() * sources.length)]);
  smoke.startDirectionFunction = (_matrix, out) =>
    out.set(0.1 + Math.random() * 0.1, 0.65 + Math.random() * 0.35, 0.05);
  smoke.minLifeTime = 3;
  smoke.maxLifeTime = 5;
  smoke.minSize = 0.45;
  smoke.maxSize = 0.8;
  smoke.emitRate = 9;
  smoke.updateSpeed = 0.02;
  smoke.color1 = new Color4(0.33, 0.36, 0.35, 0.18);
  smoke.color2 = new Color4(0.44, 0.46, 0.43, 0.14);
  smoke.colorDead = new Color4(0.5, 0.52, 0.51, 0);
  smoke.addSizeGradient(0, 0.6);
  smoke.addSizeGradient(1, 3.5);
  smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  let enabled = true;
  smoke.start();
  return {
    update(reduced: boolean) {
      if (enabled === !reduced) return;
      enabled = !reduced;
      if (enabled) smoke.start();
      else {
        smoke.stop();
        smoke.reset();
      }
    },
    setQuality(low: boolean) {
      smoke.emitRate = low ? 4 : 9;
    },
    dispose() {
      smoke.dispose();
      texture.dispose();
    },
  };
}
