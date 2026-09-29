import {
  ROADS,
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
  const resolution = 300;
  const biomeColors = new Map(
    REGIONS.map((region) => [region.id, Color3.FromHexString(region.color)]),
  );
  const biomeColor = (x: number, z: number) =>
    biomeColors.get(regionBiome(x, z))!;
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
  for (const [index, tile] of splitTerrain(vd, resolution).entries()) {
    const ground = new Mesh(`island terrain:${index}`, scene);
    tile.applyToMesh(ground);
    ground.material = groundMat;
    ground.receiveShadows = true;
    ground.isPickable = false;
    ground.freezeWorldMatrix();
  }
  const water = createWater(scene);
  palette.path.backFaceCulling = false;
  const paths = ROADS;
  paths.forEach((points, pathIndex) => {
    const samples: Array<[number, number]> = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.4);
      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        samples.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    samples.push(points[points.length - 1]);
    const p: number[] = [],
      ix: number[] = [],
      n: number[] = [];
    samples.forEach(([x, z], i) => {
      const previous = samples[Math.max(0, i - 1)],
        next = samples[Math.min(samples.length - 1, i + 1)];
      const dx = next[0] - previous[0],
        dz = next[1] - previous[1],
        length = Math.hypot(dx, dz) || 1;
      for (const side of [-1, 1]) {
        const px = x + (dz / length) * 1.9 * side,
          pz = z - (dx / length) * 1.9 * side;
        p.push(px, terrainHeight(px, pz) + 0.14 + pathIndex * 0.008, pz);
      }
      if (i < samples.length - 1) {
        const a = i * 2;
        ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    VertexData.ComputeNormals(p, ix, n);
    const data = new VertexData();
    data.positions = p;
    data.indices = ix;
    data.normals = n;
    data.uvs = p.flatMap((value, i) =>
      i % 3 === 0 ? [value / 3, p[i + 2] / 3] : [],
    );
    const trail = new Mesh("continuous stone trail", scene);
    data.applyToMesh(trail);
    trail.material = palette.path;
    trail.receiveShadows = true;
    trail.isPickable = false;
  });

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
    paths.some((points) =>
      points.some((p, i) => {
        if (!i) return false;
        const a = points[i - 1],
          dx = p[0] - a[0],
          dz = p[1] - a[1];
        const t = Math.max(
          0,
          Math.min(
            1,
            ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz),
          ),
        );
        return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < margin;
      }),
    );
  return { water, nearPath };
}
