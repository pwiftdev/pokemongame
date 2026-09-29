import { VertexData } from "@babylonjs/core";

export function splitTerrain(
  source: VertexData,
  resolution: number,
  tileSize = 30,
) {
  const tiles = new Map<
    string,
    { data: VertexData; vertices: Map<number, number> }
  >();
  const attributes = [
    ["positions", 3],
    ["normals", 3],
    ["colors", 4],
    ["uvs", 2],
  ] as const;
  const indices = source.indices!;
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = [indices[i], indices[i + 1], indices[i + 2]];
    const first = Math.min(...triangle);
    const x = Math.min(...triangle.map((index) => index % (resolution + 1)));
    const z = Math.floor(first / (resolution + 1));
    const key = `${Math.floor(x / tileSize)}:${Math.floor(z / tileSize)}`;
    let tile = tiles.get(key);
    if (!tile) {
      const data = new VertexData();
      data.indices = [];
      for (const [attribute] of attributes)
        if (source[attribute]) data[attribute] = [];
      tile = { data, vertices: new Map() };
      tiles.set(key, tile);
    }
    for (let corner = 0; corner < 3; corner++) {
      const index = indices[i + corner];
      let local = tile.vertices.get(index);
      if (local === undefined) {
        local = tile.vertices.size;
        tile.vertices.set(index, local);
        for (const [attribute, stride] of attributes) {
          const values = source[attribute];
          if (!values) continue;
          for (let component = 0; component < stride; component++)
            (tile.data[attribute] as number[]).push(
              values[index * stride + component],
            );
        }
      }
      (tile.data.indices as number[]).push(local);
    }
  }
  return [...tiles.values()].map((tile) => tile.data);
}
