import { buildingParts } from "./village-buildings";
import villageModels from "./village-models.json";
import {
  InstancedMesh,
  PBRMaterial,
  Matrix,
  Mesh,
  Quaternion,
  TransformNode,
  Vector3,
  type Scene,
  type Material,
} from "@babylonjs/core";
import { terrainHeight } from "../../../../packages/shared/rules";
import { loadModelLibrary, modelUrls } from "./models";
import { createFoliageCulling } from "./foliage-culling";
import { FoliageWind } from "./foliage-wind";
import { StoneWeathering } from "./stone-weathering";
import worldModels from "./world-models.json";

const NATURE = [
  "SnowPine",
  "AutumnTree",
  "MoonTree",
  "Sandstone",
  "CommonTree_1",
  "CommonTree_3",
  "CommonTree_5",
  "Pine_1",
  "Pine_3",
  "TwistedTree_1",
  "Bush_Common",
  "Bush_Common_Flowers",
  "Fern_1",
  "Flower_3_Group",
  "Flower_4_Group",
  "Grass_Common_Short",
  "Grass_Wispy_Tall",
  "Mushroom_Common",
  "Rock_Medium_1",
  "Rock_Medium_2",
  "Rock_Medium_3",
];
const VILLAGE = [
  ...villageModels,
  "Wall_Plaster_Window_Wide_Flat",
  "Wall_Plaster_Door_Round",
  "Door_1_Round",
  "DoorFrame_Round_WoodDark",
  "Window_Wide_Flat1",
  "WindowShutters_Wide_Flat_Open",
  "Roof_Front_Brick6",
  "Prop_Chimney",
  "Prop_WoodenFence_Single",
  "Prop_Vine1",
  "Prop_Crate",
  "Prop_Wagon",
  "DoorFrame_Round_Brick",
  "Corner_ExteriorWide_Brick",
  "Wall_UnevenBrick_Straight",
  "Prop_Brick1",
];
const PROPS = [
  "Bench",
  "Barrel",
  "Crate_Wooden",
  "Lantern_Wall",
  "Stall_Empty",
  "FarmCrate_Apple",
  "BookStand",
  "Banner_1",
  "Chest_Wood",
  "Cauldron",
  "Torch_Metal",
];

export async function loadScenery(
  scene: Scene,
  onReady?: (
    meshes: ReturnType<
      Awaited<ReturnType<typeof loadModelLibrary>>["create"]
    >["meshes"],
  ) => void,
) {
  const library = await loadModelLibrary(
    scene,
    {
      Mill: "/assets/landmarks/Mill.glb",
      ...modelUrls("nature", NATURE),
      ...modelUrls("world", worldModels),
      ...modelUrls("village", VILLAGE),
      ...modelUrls("props", PROPS),
    },
    (name) => !VILLAGE.includes(name),
  );
  const weathered = new Set<Material>();
  let serial = 0;
  let lowQuality = false,
    lastFocus = -Infinity;
  const focusPosition = { x: Infinity, z: Infinity };
  const instances: ReturnType<typeof library.create>[] = [];

  const details: ReturnType<typeof library.create>[] = [];
  function invalidateFocus() {
    lastFocus = -Infinity;
    focusPosition.x = Infinity;
  }
  function register(actor: ReturnType<typeof library.create>) {
    actor.root.freezeWorldMatrix();
    for (const node of actor.root.getDescendants())
      if (node instanceof TransformNode) node.freezeWorldMatrix();
    instances.push(actor);
    invalidateFocus();
    onReady?.(actor.meshes.filter((mesh) => mesh.metadata?.castShadow));
  }
  function place(
    name: string,
    x: number,
    z: number,
    height: number,
    rotation = 0,
    y = terrainHeight(x, z),
    detail = false,
  ) {
    if (!library.has(name)) {
      library.whenReady(name, () =>
        place(name, x, z, height, rotation, y, detail),
      );
      return;
    }
    const actor = library.create(
      name,
      `environment:${name}:${serial++}`,
      height,
    );
    const rock = /Rock_|Cliff|StandingStone|Sandstone/.test(name);
    if (rock && height > 6) y -= height * 0.28;
    actor.root.position.set(x, y, z);
    if (rock || /Watchtower|CastleWall|StoneGate/.test(name))
      for (const mesh of actor.meshes) {
        const material = mesh.material;
        if (material instanceof PBRMaterial && !weathered.has(material)) {
          new StoneWeathering(material);
          weathered.add(material);
        }
      }
    actor.root.rotation.y = rotation;
    for (const mesh of actor.meshes)
      mesh.metadata = {
        ...mesh.metadata,
        cameraObstacle: !detail,
        castShadow: !detail,
      };
    register(actor);
    if (detail) details.push(actor);
    return actor;
  }
  const foliageCulling = createFoliageCulling();
  const wind = { time: 0, strength: 0.055 };
  const foliageMaterials = new Map<Material, Material>();
  function scatter(
    name: string,
    points: Array<{ x: number; z: number; height: number; rotation: number }>,
  ) {
    if (!points.length) return;
    if (!library.has(name)) {
      library.whenReady(name, () => scatter(name, points));
      return;
    }
    const cells = new Map<string, typeof points>();
    for (const p of points) {
      const key = `${Math.floor(p.x / 48)}:${Math.floor(p.z / 48)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(p);
    }
    for (const cell of cells.values()) scatterCell(name, cell);
  }
  function scatterCell(
    name: string,
    points: Array<{ x: number; z: number; height: number; rotation: number }>,
  ) {
    const prototype = library.create(name, `grass prototype:${name}`, 1);
    prototype.root.computeWorldMatrix(true);
    for (const child of prototype.meshes) {
      const source =
        child instanceof InstancedMesh ? child.sourceMesh : (child as Mesh);
      if (!source.getTotalVertices()) continue;
      child.computeWorldMatrix(true);
      const base = child.getWorldMatrix().clone();
      const mesh = source.clone(`meadow grass:${name}`, null, true)!;
      if (source.material) {
        let foliage = foliageMaterials.get(source.material);
        if (!foliage) {
          foliage = source.material.clone(`foliage:${source.material.name}`)!;
          foliage.backFaceCulling = false;
          new FoliageWind(foliage, wind);
          foliageMaterials.set(source.material, foliage);
        }
        mesh.material = foliage;
      }
      mesh.makeGeometryUnique();
      mesh.parent = null;
      mesh.position.setAll(0);
      mesh.scaling.setAll(1);
      mesh.rotation.setAll(0);
      mesh.rotationQuaternion = Quaternion.Identity();
      mesh.isPickable = false;
      mesh.isVisible = true;
      mesh.setEnabled(true);
      mesh.metadata = { cameraObstacle: false };
      mesh.receiveShadows = true;
      const matrices = new Float32Array(points.length * 16);
      points.forEach((point, i) =>
        base
          .multiply(
            Matrix.Compose(
              new Vector3(point.height, point.height, point.height),
              Quaternion.RotationAxis(Vector3.Up(), point.rotation),
              new Vector3(
                point.x,
                terrainHeight(point.x, point.z) - 0.025,
                point.z,
              ),
            ),
          )
          .copyToArray(matrices, i * 16),
      );
      mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
      mesh.thinInstanceRefreshBoundingInfo();
      const bounds = mesh.getBoundingInfo();
      bounds.reConstruct(
        bounds.minimum.subtract(new Vector3(0.12, 0, 0.12)),
        bounds.maximum.add(new Vector3(0.12, 0, 0.12)),
      );
      mesh.freezeWorldMatrix();
      foliageCulling.add(mesh);
    }
    prototype.dispose();
    invalidateFocus();
  }
  function cottage(x: number, z: number, index: number, scale = 0.86) {
    const y = terrainHeight(x, z);
    const { definition, parts } = buildingParts(index);
    const rotation = definition.angle;
    const part = (
      name: string,
      px: number,
      py: number,
      pz: number,
      angle = 0,
    ) => {
      const actor = library.create(name, `environment:${name}:${serial++}`);
      actor.root.scaling.setAll(scale);
      actor.root.rotation.y = rotation + angle;
      actor.root.position.set(
        x + (px * Math.cos(rotation) + pz * Math.sin(rotation)) * scale,
        y + py * scale,
        z + (-px * Math.sin(rotation) + pz * Math.cos(rotation)) * scale,
      );
      for (const mesh of actor.meshes)
        mesh.metadata = { cameraObstacle: true, castShadow: true };
      register(actor);
    };
    for (const piece of parts)
      part(piece.model, piece.x, piece.y, piece.z, piece.angle);
    place("Barrel", x + 3.2, z + 1.7, 1.1, 0, y);
    place("Crate_Wooden", x + 3.3, z + 0.5, 0.8, 0.2, y);
    place("Bush_Common_Flowers", x - 3.1, z - 1, 1.1, 0, y, true);
  }
  return {
    place,
    scatter,
    cottage,
    update(t: number, focus: { x: number; z: number }, reduced = false) {
      wind.time = t;
      wind.strength = reduced ? 0 : 0.055;
      if (t - lastFocus < 0.5) return;
      lastFocus = t;
      if (
        Math.hypot(focus.x - focusPosition.x, focus.z - focusPosition.z) < 0.5
      )
        return;
      focusPosition.x = focus.x;
      focusPosition.z = focus.z;
      for (const actor of instances) {
        const p = actor.root.position;
        actor.root.setEnabled(
          Math.hypot(p.x - focus.x, p.z - focus.z) < (lowQuality ? 75 : 115),
        );
      }
      if (lowQuality)
        details.forEach((actor, i) => {
          if (i % 3) actor.root.setEnabled(false);
        });
      foliageCulling.update(focus, lowQuality);
    },
    setQuality(low: boolean) {
      lowQuality = low;
      invalidateFocus();
    },
    dispose() {
      foliageCulling.dispose();
      for (const actor of instances) actor.dispose();
      for (const material of foliageMaterials.values()) material.dispose();
      library.dispose();
    },
  };
}
