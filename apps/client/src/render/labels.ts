import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  type Scene,
} from "@babylonjs/core";
import { labelPresentation, viewDepth } from "./camera-presentation";
export function createWorldLabel(scene: Scene, text: string, width = 2.8) {
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
  const update = (value: string) => {
    if (value === current) return;
    current = value;
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 512, 128);
    ctx.font = "600 46px system-ui";
    ctx.textAlign = "center";
    ctx.strokeStyle = "#203b35";
    ctx.lineWidth = 4;
    ctx.strokeText(value, 256, 81, 480);
    ctx.fillStyle = "#fff4d6";
    ctx.fillText(value, 256, 81, 480);
    texture.update();
  };
  const observer = scene.onBeforeCameraRenderObservable.add((camera) => {
    const depth = viewDepth(
      mesh.getAbsolutePosition(),
      camera.globalPosition,
      camera.getForwardRay().direction,
    );
    const presentation = labelPresentation(
      depth,
      width,
      camera.fov,
      scene.getEngine().getAspectRatio(camera),
    );
    mesh.isVisible = presentation.visible && depth < 28;
    mesh.visibility = Math.min(1, Math.max(0, (28 - depth) / 8));
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
