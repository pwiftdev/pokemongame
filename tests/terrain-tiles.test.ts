import { describe, expect, it } from "vitest";
import { VertexData } from "@babylonjs/core";
import { splitTerrain } from "../apps/client/src/render/terrain-tiles";

function terrain() {
  const data = VertexData.CreateGround({
    width: 8,
    height: 8,
    subdivisions: 4,
  });
  data.colors = [];
  for (let i = 0; i < data.positions!.length; i += 3) {
    data.positions![i + 1] = Math.sin(data.positions![i]);
    (data.colors as number[]).push(i / 100, 0.5, 0.7, 1);
  }
  VertexData.ComputeNormals(data.positions!, data.indices!, data.normals!);
  return data;
}

function triangles(data: VertexData) {
  const vertices = Array.from(data.indices!, (index) =>
    JSON.stringify([
      ...Array.from(data.positions!).slice(index * 3, index * 3 + 3),
      ...Array.from(data.normals!).slice(index * 3, index * 3 + 3),
      ...Array.from(data.uvs!).slice(index * 2, index * 2 + 2),
      ...Array.from(data.colors!).slice(index * 4, index * 4 + 4),
    ]),
  );
  return Array.from({ length: vertices.length / 3 }, (_, i) =>
    vertices.slice(i * 3, i * 3 + 3).join("|"),
  );
}

describe("terrain tiles", () => {
  it("preserves every triangle, winding, UV, color and shared edge normal", () => {
    const source = terrain();
    const tiles = splitTerrain(source, 4, 2);
    expect(tiles).toHaveLength(4);
    expect(tiles.flatMap(triangles).sort()).toEqual(triangles(source).sort());
    for (const tile of tiles) {
      expect(tile.indices).toHaveLength(24);
      const xs = Array.from(tile.positions!).filter((_, i) => i % 3 === 0);
      const zs = Array.from(tile.positions!).filter((_, i) => i % 3 === 2);
      expect(Math.max(...xs) - Math.min(...xs)).toBe(4);
      expect(Math.max(...zs) - Math.min(...zs)).toBe(4);
    }
  });

  it("keeps incomplete edge tiles and omits empty ocean tiles", () => {
    const source = terrain();
    source.indices = Array.from(source.indices!).slice(0, 18);
    const tiles = splitTerrain(source, 4, 3);
    expect(tiles).toHaveLength(1);
    expect(tiles.flatMap(triangles)).toEqual(triangles(source));
    source.indices = [];
    expect(splitTerrain(source, 4, 3)).toEqual([]);
  });
});
