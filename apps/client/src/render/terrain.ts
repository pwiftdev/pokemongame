import {
  WORLD_RADIUS,
  REGIONS,
  regionBiome,
} from "../../../../packages/shared/regions";
import {
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Texture,
  VertexBuffer,
  VertexData,
  type Scene,
} from "@babylonjs/core";
import {
  roadDistance,
  lakeAt,
  lakeDistance,
} from "../../../../packages/shared/geography";
import { buildBiomePaths } from "./biome-paths";
import { createGroundTextures } from "./ground-texture";
import { splitTerrain } from "./terrain-tiles";
import { createWater } from "./atmosphere";
import { terrainHeight } from "../../../../packages/shared/rules";

export function buildTerrain(scene: Scene) {
  const mat = (name: string, color: string) => {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor = Color3.Black();
    return material;
  };
  const palette = {
    sand: Color3.FromHexString("#decfa2"),
    path: mat("limestone paths", "#cabb93"),
  };
  palette.path.diffuseTexture = new Texture(
    "/assets/village/T_Brick_BaseColor.png",
    scene,
  );
  palette.path.bumpTexture = new Texture(
    "/assets/village/T_Brick_Normal.png",
    scene,
  );
  palette.path.bumpTexture.level = 0.35;
  palette.path.diffuseColor = Color3.FromHexString("#b8ac91");
  const positions: number[] = [],
    indices: number[] = [],
    colors: number[] = [],
    uvs: number[] = [];
  const blend = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };
  const resolution = 360;
  const biomeColors = new Map(
    REGIONS.map((region) => [region.id, Color3.FromHexString(region.color)]),
  );
  const biomeColor = (x: number, z: number) =>
    biomeColors.get(
      regionBiome(x + Math.sin(z * 0.075) * 4, z + Math.sin(x * 0.06) * 4),
    )!;
  const trailColors = Object.fromEntries(
    Object.entries({
      meadow: "#a38b62",
      forest: "#756745",
      desert: "#d6b17d",
      marsh: "#617d65",
      tundra: "#afc5ce",
      highlands: "#9d8662",
    }).map(([name, hex]) => [name, Color3.FromHexString(hex)]),
  );
  const shoreColors = {
    ice: Color3.FromHexString("#b1cdd4"),
    sand: Color3.FromHexString("#b3a774"),
    earth: Color3.FromHexString("#6c8971"),
  };
  const stoneColors = {
    snow: Color3.FromHexString("#a7b8c3"),
    rock: Color3.FromHexString("#8d927c"),
  };
  for (let z = 0; z <= resolution; z++)
    for (let x = 0; x <= resolution; x++) {
      const wx = (x / resolution - 0.5) * (WORLD_RADIUS * 2 + 4),
        wz = (z / resolution - 0.5) * (WORLD_RADIUS * 2 + 4),
        r = Math.hypot(wx, wz);
      const h = terrainHeight(wx, wz);
      positions.push(wx, h, wz);
      uvs.push(x / resolution, z / resolution);
      let inland = biomeColor(wx, wz);
      for (const [dx, dz] of [
        [-7, 0],
        [7, 0],
        [0, -7],
        [0, 7],
      ])
        inland = Color3.Lerp(inland, biomeColor(wx + dx, wz + dz), 0.15);
      const region = regionBiome(wx, wz);
      if (region !== "town" && region !== "ruins") {
        const edge =
          roadDistance(wx, wz) + Math.sin(wx * 1.7 + wz * 0.9) * 0.22;
        inland = Color3.Lerp(
          inland,
          trailColors[region],
          1 - blend((edge - 0.65) / 2.1),
        );
      }
      const lake = lakeAt(wx, wz, 1.35);
      if (lake)
        inland = Color3.Lerp(
          inland,
          lake.frozen
            ? shoreColors.ice
            : lake.biome === "desert"
              ? shoreColors.sand
              : shoreColors.earth,
          1 - blend((lakeDistance(lake, wx, wz) - 1) / 0.35),
        );
      const slope = Math.hypot(
        terrainHeight(wx + 1, wz) - h,
        terrainHeight(wx, wz + 1) - h,
      );
      inland = Color3.Lerp(
        inland,
        region === "tundra" ? stoneColors.snow : stoneColors.rock,
        blend((slope - 0.5) / 1.6) * 0.65,
      );
      const c = Color3.Lerp(
        inland,
        palette.sand,
        blend((r - WORLD_RADIUS + 12) / 10),
      );
      const variation =
        0.89 +
        Math.sin(wx * 0.15 + wz * 0.09) * 0.09 +
        Math.cos(wx * 0.32 - wz * 0.18) * 0.04 +
        Math.sin(wx * 1.8 + Math.cos(wz * 2.1)) * 0.025;
      colors.push(c.r * variation, c.g * variation, c.b * variation, 1);
      if (x < resolution && z < resolution && r < WORLD_RADIUS + 2) {
        const a = z * (resolution + 1) + x;
        indices.push(
          a,
          a + resolution + 1,
          a + 1,
          a + 1,
          a + resolution + 1,
          a + resolution + 2,
        );
      }
    }
  const vd = new VertexData(),
    normals: number[] = [];
  for (let i = 0; i < indices.length; i += 3)
    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  VertexData.ComputeNormals(positions, indices, normals);
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  vd.colors = colors;
  vd.uvs = uvs;
  const groundMat = mat("terrain", "#ffffff");
  const textures = createGroundTextures(scene);
  groundMat.diffuseTexture = textures.diffuse;
  groundMat.bumpTexture = textures.normal;
  textures.normal.level = 0.22;
  for (const [index, tile] of splitTerrain(vd, resolution, 36).entries()) {
    const ground = new Mesh(`island terrain:${index}`, scene);
    tile.applyToMesh(ground);
    ground.material = groundMat;
    ground.receiveShadows = true;
    ground.isPickable = false;
    ground.freezeWorldMatrix();
  }
  const water = createWater(scene);
  palette.path.backFaceCulling = false;
  buildBiomePaths(scene, palette.path);

  for (const [x, z, r] of [
    [0, -27, 7],
    [23, -13, 7],
    [6, 76, 8],
  ]) {
    const square = MeshBuilder.CreateGround(
      "village paving",
      { width: r * 2, height: r * 2, subdivisions: 24 },
      scene,
    );
    const vertices = square.getVerticesData(VertexBuffer.PositionKind)!;
    const uv: number[] = [];
    for (let i = 0; i < vertices.length; i += 3) {
      const radius = Math.max(Math.abs(vertices[i]), Math.abs(vertices[i + 2]));
      const angle = Math.atan2(vertices[i + 2], vertices[i]);
      vertices[i] = Math.cos(angle) * radius;
      vertices[i + 2] = Math.sin(angle) * radius;
      const wx = vertices[i] + x,
        wz = vertices[i + 2] + z;
      vertices[i + 1] = terrainHeight(wx, wz) + 0.13;
      uv.push(wx / 3, wz / 3);
    }
    const indices = square.getIndices()!;
    const normals: number[] = [];
    VertexData.ComputeNormals(vertices, indices, normals);
    square.setVerticesData(VertexBuffer.PositionKind, vertices);
    square.setVerticesData(VertexBuffer.NormalKind, normals);
    square.setVerticesData(VertexBuffer.UVKind, uv);
    square.setIndices(indices);
    square.position.set(x, 0, z);
    square.material = palette.path;
    square.receiveShadows = true;
    square.isPickable = false;
  }
  const nearPath = (x: number, z: number, margin = 4.5) =>
    roadDistance(x, z) < margin;
  return { water, nearPath };
}
