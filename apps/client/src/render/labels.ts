import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  type Scene,
} from "@babylonjs/core";
import { labelPresentation, viewDepth } from "./camera-presentation";
export function createWorldLabel(
  scene: Scene,
  text: string,
  width = 2.8,
  options: { distance?: number; color?: string } = {},
) {
  const texture = new DynamicTexture(
    `label:${text}`,
    { width: 512, height: 128 },
    scene,
    false,
  );
  texture.hasAlpha = true;
  const material = new StandardMaterial("world label", scene);
  material.diffuseTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.emissiveColor = Color3.White();
  material.disableLighting = true;
  material.backFaceCulling = false;
  const mesh = MeshBuilder.CreatePlane(
    "world label",
    { width, height: width / 5 },
    scene,
  );
  mesh.material = material;
  mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
  mesh.isPickable = false;
  let current = "";
  const range = options.distance ?? 28;
  const update = (value: string, subtitle = "") => {
    const key = `${value}\n${subtitle}`;
    if (key === current) return;
    current = key;
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = "#060b26";
    ctx.fillRect(4, 16, 504, 108);
    ctx.fillStyle = "#121c52";
    ctx.fillRect(8, 20, 496, 96);
    ctx.fillStyle = "#2b3c99";
    ctx.fillRect(8, 20, 496, 4);
    ctx.font = '700 46px "Pixelify Sans"';
    ctx.textAlign = "center";
    ctx.strokeStyle = "#060b26";
    ctx.lineWidth = 7;
    ctx.strokeText(value, 256, subtitle ? 59 : 81, 480);
    ctx.fillStyle = options.color ?? "#ffffff";
    ctx.fillText(value, 256, subtitle ? 59 : 81, 480);
    if (subtitle) {
      ctx.font = '500 27px "Chakra Petch"';
      ctx.lineWidth = 5;
      ctx.strokeText(subtitle, 256, 99, 480);
      ctx.fillStyle = "#c9d3f5";
      ctx.fillText(subtitle, 256, 99, 480);
    }
    texture.update();
  };
  const observer = scene.onBeforeCameraRenderObservable.add((camera) => {
    const engine = scene.getEngine();
    const viewportWidth =
      engine.getRenderingCanvas()?.clientWidth || engine.getRenderWidth();
    const depth = viewDepth(
      mesh.getAbsolutePosition(),
      camera.globalPosition,
      camera.getForwardRay().direction,
    );
    const presentation = labelPresentation(
      depth,
      width,
      camera.fov,
      engine.getAspectRatio(camera),
      Math.min(0.24, 240 / Math.max(1, viewportWidth)),
      options.distance ? Math.min(2.5, Math.max(1, depth / 14)) : 1,
    );
    mesh.isVisible = presentation.visible && depth < range;
    mesh.visibility = Math.min(1, Math.max(0, (range - depth) / 10));
    mesh.scaling.setAll(presentation.scale);
  });
  update(text);
  return {
    mesh,
    update,
    dispose() {
      scene.onBeforeCameraRenderObservable.remove(observer);
      mesh.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
