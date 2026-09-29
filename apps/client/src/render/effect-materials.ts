import {
  Color3,
  DynamicTexture,
  Engine,
  StandardMaterial,
  type Scene,
} from "@babylonjs/core";

export function createEffectMaterials(scene: Scene) {
  const materials = new Map<string, StandardMaterial>();
  const textures = new Map<string, DynamicTexture>();
  function texture(shape: "glow" | "ring") {
    let value = textures.get(shape);
    if (value) return value;
    value = new DynamicTexture(`effect ${shape}`, 128, scene, false);
    value.hasAlpha = true;
    const context = value.getContext() as CanvasRenderingContext2D;
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [stop, alpha] of shape === "ring"
      ? [
          [0, 0],
          [0.7, 0],
          [0.8, 0.3],
          [0.87, 1],
          [0.94, 0.3],
          [1, 0],
        ]
      : [
          [0, 1],
          [0.15, 0.9],
          [0.4, 0.28],
          [1, 0],
        ])
      gradient.addColorStop(stop, `rgba(255,255,255,${alpha})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    value.update();
    textures.set(shape, value);
    return value;
  }
  return {
    get(color: string, shape?: "glow" | "ring") {
      const key = `${color}:${shape ?? "solid"}`;
      let material = materials.get(key);
      if (!material) {
        material = new StandardMaterial(`effect:${key}`, scene);
        material.diffuseColor = Color3.FromHexString(color);
        material.emissiveColor = material.diffuseColor.scale(shape ? 1.5 : 1);
        material.specularColor = Color3.Black();
        material.disableLighting = true;
        material.backFaceCulling = false;
        if (shape) {
          material.diffuseTexture = texture(shape);
          material.useAlphaFromDiffuseTexture = true;
          material.alphaMode = Engine.ALPHA_ADD;
          material.disableDepthWrite = true;
        }
        materials.set(key, material);
      }
      return material;
    },
    dispose() {
      for (const material of materials.values()) material.dispose();
      for (const texture of textures.values()) texture.dispose();
    },
  };
}
