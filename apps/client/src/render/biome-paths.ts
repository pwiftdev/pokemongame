import {
  Color3,
  Mesh,
  StandardMaterial,
  VertexData,
  type Scene,
} from "@babylonjs/core";
import { ROADS, regionBiome } from "../../../../packages/shared/regions";
import { terrainHeight } from "../../../../packages/shared/rules";
const surfaces: Record<"town" | "ruins", [string, number]> = {
  town: ["#b4a083", 2],
  ruins: ["#a4b4a8", 1.8],
};
export function buildBiomePaths(scene: Scene, paving: StandardMaterial) {
  const batches = new Map<
    "town" | "ruins",
    { p: number[]; ix: number[]; uv: number[]; colors: number[] }
  >();
  for (const road of ROADS)
    for (let segment = 1; segment < road.length; segment++) {
      const [ax, az] = road[segment - 1],
        [bx, bz] = road[segment],
        dx = bx - ax,
        dz = bz - az,
        length = Math.hypot(dx, dz),
        steps = Math.ceil(length / 1.3);
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps,
          biome = regionBiome(ax + dx * t, az + dz * t);
        if (biome !== "town" && biome !== "ruins") continue;
        if (!batches.has(biome))
          batches.set(biome, { p: [], ix: [], uv: [], colors: [] });
        const b = batches.get(biome)!,
          start = b.p.length / 3,
          width = surfaces[biome][1];
        for (const along of [i / steps, (i + 1) / steps])
          for (const side of [-1.45, -1, 1, 1.45]) {
            const x = ax + dx * along + (dz / length) * width * side,
              z = az + dz * along - (dx / length) * width * side;
            b.p.push(x, terrainHeight(x, z) + 0.09, z);
            b.uv.push(x / 3, z / 3);
            const shade = 0.92 + Math.sin(x * 0.65 + z * 0.4) * 0.06;
            b.colors.push(shade, shade, shade, Math.abs(side) > 1 ? 0 : 1);
          }
        for (let j = 0; j < 3; j++)
          b.ix.push(
            start + j,
            start + j + 1,
            start + j + 4,
            start + j + 1,
            start + j + 5,
            start + j + 4,
          );
      }
    }
  for (const [biome, b] of batches) {
    const material = paving.clone(`${biome} worn paving`);
    material.diffuseColor = Color3.FromHexString(surfaces[biome][0]);
    material.backFaceCulling = false;
    material.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
    material.zOffset = -1;
    const data = new VertexData(),
      normals: number[] = [];
    VertexData.ComputeNormals(b.p, b.ix, normals);
    data.positions = b.p;
    data.indices = b.ix;
    data.normals = normals;
    data.uvs = b.uv;
    data.colors = b.colors;
    const mesh = new Mesh(`${biome} trail`, scene);
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.hasVertexAlpha = true;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
  }
}
