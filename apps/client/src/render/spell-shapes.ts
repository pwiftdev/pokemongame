import { MeshBuilder, Vector3, type Scene } from "@babylonjs/core";
import type { Element } from "../../../../packages/shared/types";

export function createSpellShape(scene: Scene, element: Element) {
  if (element === "spark")
    return MeshBuilder.CreateTube(
      "spark bolt",
      {
        path: [
          new Vector3(0, -0.45, 0),
          new Vector3(0.2, -0.1, 0),
          new Vector3(-0.14, 0.12, 0),
          new Vector3(0, 0.45, 0),
        ],
        radius: 0.045,
        tessellation: 5,
      },
      scene,
    );
  if (element === "tide")
    return MeshBuilder.CreateTorus(
      "tide pulse",
      { diameter: 0.55, thickness: 0.14, tessellation: 24 },
      scene,
    );
  const mesh = MeshBuilder.CreateIcoSphere(
    `spell:${element}`,
    {
      radius: element === "stone" ? 0.3 : 0.24,
      subdivisions: element === "stone" ? 1 : 2,
    },
    scene,
  );
  if (element === "leaf") mesh.scaling.set(0.8, 0.2, 1.8);
  if (element === "flame") mesh.scaling.set(0.7, 1.5, 0.7);
  return mesh;
}
