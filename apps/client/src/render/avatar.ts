import { attachEquipment, holdEquipment } from "./equipment";
import {
  Color3,
  MaterialPluginBase,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Vector3,
  VertexBuffer,
  type BaseTexture,
  type Scene,
  type UniformBuffer,
} from "@babylonjs/core";
import {
  DEFAULT_APPEARANCE,
  EYE_COLORS,
  HAIR_COLORS,
  OUTFIT_COLORS,
  RACES,
  normalizeAppearance,
  type Appearance,
} from "../../../../packages/shared/appearance";
import { type ClassId } from "../../../../packages/shared/classes";
import { loadModelLibrary, modelUrls } from "./models";
const hairModels = {
  bald: "",
  cropped: "Hair_Buzzed",
  swept: "Hair_BuzzedFemale",
  parted: "Hair_SimpleParted",
  long: "Hair_Long",
  buns: "Hair_Buns",
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
class IrisTint extends MaterialPluginBase {
  constructor(
    material: PBRMaterial,
    private color: Color3,
  ) {
    super(material, "Avatar iris", 200, {}, true, true);
  }
  getClassName() {
    return "IrisTint";
  }
  getUniforms() {
    return {
      ubo: [{ name: "avatarIris", size: 3, type: "vec3" }],
      fragment: "uniform vec3 avatarIris;",
    };
  }
  bindForSubMesh(buffer: UniformBuffer) {
    buffer.updateColor3("avatarIris", this.color);
  }
  getCustomCode(shaderType: string) {
    return shaderType === "fragment"
      ? {
          CUSTOM_FRAGMENT_UPDATE_ALBEDO: `float irisChroma = max(surfaceAlbedo.r,max(surfaceAlbedo.g,surfaceAlbedo.b))-min(surfaceAlbedo.r,min(surfaceAlbedo.g,surfaceAlbedo.b));
float irisMask = smoothstep(0.035,0.13,irisChroma);
surfaceAlbedo = mix(surfaceAlbedo, avatarIris * (0.55 + surfaceAlbedo.r * 0.45), irisMask);`,
        }
      : null;
  }
}
function shapeHead(mesh: Mesh, appearance: Appearance) {
  const original = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!original) return;
  mesh.makeGeometryUnique();
  const positions = Float32Array.from(original);
  let top = -Infinity;
  for (let i = 1; i < positions.length; i += 3)
    top = Math.max(top, positions[i]);
  const face = appearance.face;
  const jaw =
    appearance.jaw * 0.12 +
    (face === "strong"
      ? 0.16
      : face === "soft"
        ? -0.08
        : face === "angular"
          ? 0.06
          : 0) +
    (appearance.race === "orc" ? 0.13 : 0);
  const ear =
    appearance.race === "elf" ? 0.055 : appearance.race === "orc" ? 0.024 : 0;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i],
      y = positions[i + 1],
      z = positions[i + 2];
    const lower =
      clamp(1 - Math.abs(y - (top - 0.18)) / 0.09) * clamp((z + 0.04) / 0.08);
    positions[i] = x * (1 + jaw * lower);
    const nose =
      clamp(1 - Math.abs(x) / 0.027) *
      clamp(1 - Math.abs(y - (top - 0.14)) / 0.05) *
      clamp((z - 0.06) / 0.055);
    positions[i + 2] += appearance.nose * 0.018 * nose;
    const earWeight =
      clamp((Math.abs(x) - 0.067) / 0.027) *
      clamp(1 - Math.abs(y - (top - 0.135)) / 0.075) *
      clamp((0.065 - z) / 0.03);
    positions[i] +=
      Math.sign(x) * ear * earWeight * (0.7 + appearance.ears * 0.6);
    positions[i + 1] += ear * 0.55 * earWeight;
  }
  mesh.setVerticesData(VertexBuffer.PositionKind, positions, true);
  mesh.refreshBoundingInfo(true);
}
function dress(mesh: Mesh, appearance: Appearance) {
  const name = mesh.name;
  const style = appearance.outfit === "ranger" ? "Ranger:" : "Peasant:";
  if (name.includes("Ranger:") || name.includes("Peasant:"))
    mesh.setEnabled(
      name.includes(style) &&
        !name.includes("Head_Hood") &&
        (appearance.shoulders || !name.includes("Pauldron")),
    );
  if (name.includes("Hair:")) {
    const part = name.split(":").at(-1);
    mesh.setEnabled(
      part === hairModels[appearance.hairStyle] ||
        (part === "Hair_Beard" && appearance.facialHair !== "none"),
    );
    if (part === "Hair_Beard" && appearance.facialHair === "short") {
      mesh.makeGeometryUnique();
      const points = Float32Array.from(
        mesh.getVerticesData(VertexBuffer.PositionKind) ?? [],
      );
      let top = -Infinity;
      for (let i = 1; i < points.length; i += 3) top = Math.max(top, points[i]);
      for (let i = 1; i < points.length; i += 3)
        points[i] = top + (points[i] - top) * 0.55;
      mesh.setVerticesData(VertexBuffer.PositionKind, points, true);
    }
  }
  if (name.includes("Avatar:Head")) shapeHead(mesh, appearance);
  if (name.includes("Avatar:Brows") && appearance.brow !== "natural") {
    mesh.makeGeometryUnique();
    const points = Float32Array.from(
      mesh.getVerticesData(VertexBuffer.PositionKind) ?? [],
    );
    let y = 0;
    for (let i = 1; i < points.length; i += 3) y += points[i];
    y /= points.length / 3;
    for (let i = 1; i < points.length; i += 3)
      points[i] =
        y + (points[i] - y) * (appearance.brow === "bold" ? 1.6 : 0.6);
    mesh.setVerticesData(VertexBuffer.PositionKind, points, true);
  }
}
export async function loadAvatarLibrary(scene: Scene) {
  const library = await loadModelLibrary(
    scene,
    modelUrls("characters", ["Male", "Female", "Equipment"]),
  );
  return {
    create(
      id: string,
      classId: ClassId,
      settings: Appearance = DEFAULT_APPEARANCE,
      armed = true,
    ) {
      const appearance = normalizeAppearance(settings),
        race = RACES[appearance.race];
      const actor = library.create(
        appearance.body === "feminine" ? "Female" : "Male",
        id,
        undefined,
        true,
      );
      const ownedTextures = new Set<BaseTexture>();
      const owned = new Set<PBRMaterial>(),
        materials = new Map<PBRMaterial, PBRMaterial>();
      const skin = Color3.FromHexString(
        race.skin[appearance.skin],
      ).toLinearSpace();
      for (const mesh of actor.meshes) {
        if (!(mesh instanceof Mesh)) continue;
        dress(mesh, appearance);
        const original = mesh.material;
        if (!(original instanceof PBRMaterial)) continue;
        let material = materials.get(original);
        if (!material) {
          material = original.clone(`${id}:${original.name}`)!;
          const shared = new Set(original.getActiveTextures());
          for (const texture of material.getActiveTextures())
            if (!shared.has(texture)) ownedTextures.add(texture);
          material.environmentIntensity = 0.5;
          material.metallic = 0;
          material.roughness = 0.8;
          if (original.name === "Skin" || original.name === "Hands") {
            material.albedoColor = skin;
            if (original.name === "Hands") material.albedoTexture = null;
          } else if (original.name === "Hair") {
            material.albedoTexture = null;
            material.albedoColor = Color3.FromHexString(
              HAIR_COLORS[appearance.hairColor],
            ).toLinearSpace();
          } else if (original.name === "Eyes") {
            new IrisTint(
              material,
              Color3.FromHexString(EYE_COLORS[appearance.eyeColor]),
            );
            material.roughness = 0.35;
          } else
            material.albedoColor = Color3.FromHexString(
              OUTFIT_COLORS[appearance.outfitColor],
            );
          materials.set(original, material);
          owned.add(material);
        }
        mesh.material = material;
      }
      actor.root.computeWorldMatrix(true);
      const scale = (race.height * appearance.height) / 1.84;
      actor.root.scaling.set(scale * race.width, scale, scale * race.width);
      const nodes = actor.root.getChildTransformNodes();
      const joint = (name: string) =>
        nodes.find((n) => n.name === `${id}:${name}`)!;
      const equipment = library.create(
        "Equipment",
        `${id}:gear`,
        undefined,
        true,
      );
      attachEquipment(id, classId, nodes, equipment.meshes, armed);
      const releaseGrip = holdEquipment(
        scene,
        actor.animations,
        equipment.meshes,
      );
      actor.meshes.push(...equipment.meshes);
      if (appearance.race === "orc") {
        const head = actor.meshes.find((m) => m.name.includes("Avatar:Head"));
        const bone = joint("Head");
        if (head && bone) {
          actor.root.computeWorldMatrix(true);
          head.computeWorldMatrix(true);
          bone.computeWorldMatrix(true);
          const inverse = bone.getWorldMatrix().clone().invert();
          const tooth = new PBRMaterial(`${id}:ivory`, scene);
          tooth.albedoColor = Color3.FromHexString("#efe1bd");
          tooth.roughness = 0.65;
          tooth.metallic = 0;
          owned.add(tooth);
          for (const side of [-1, 1]) {
            const mesh = MeshBuilder.CreateCylinder(
              `${id}:tusk`,
              {
                height: 0.04,
                diameterTop: 0.001,
                diameterBottom: 0.014,
                tessellation: 8,
              },
              scene,
            );
            mesh.parent = bone;
            const point = Vector3.TransformCoordinates(
              new Vector3(side * 0.033, 1.635, 0.12),
              head.getWorldMatrix(),
            );
            mesh.position.copyFrom(
              Vector3.TransformCoordinates(point, inverse),
            );
            mesh.rotation.z = side * -0.22;
            mesh.material = tooth;
            mesh.metadata = { target: id };
            actor.meshes.push(mesh);
          }
        }
      }
      return {
        ...actor,
        appearance,
        height: race.height * appearance.height,
        dispose() {
          releaseGrip();
          equipment.dispose();
          actor.dispose();
          for (const material of owned) material.dispose(false, false);
          for (const texture of ownedTextures) texture.dispose();
        },
      };
    },
    dispose: () => library.dispose(),
  };
}
