import type { TransformNode } from "@babylonjs/core";
import { terrainHeight } from "../../../../packages/shared/rules";
import { POKEMON } from "../../../../packages/shared/pokemon";

export function alignPokemon(root: TransformNode, species: string, dt: number) {
  const p = POKEMON[species];
  if (!p || ["flying", "floating"].includes(p.locomotion)) return;
  const { x, z } = root.position,
    forwardX = Math.sin(root.rotation.y),
    forwardZ = Math.cos(root.rotation.y);
  const pitch = Math.max(
    -0.22,
    Math.min(
      0.22,
      terrainHeight(x - forwardX * 0.5, z - forwardZ * 0.5) -
        terrainHeight(x + forwardX * 0.5, z + forwardZ * 0.5),
    ),
  );
  const roll = Math.max(
    -0.18,
    Math.min(
      0.18,
      terrainHeight(x + forwardZ * 0.5, z - forwardX * 0.5) -
        terrainHeight(x - forwardZ * 0.5, z + forwardX * 0.5),
    ),
  );
  root.rotation.x += (pitch - root.rotation.x) * Math.min(1, dt * 8);
  root.rotation.z += (roll - root.rotation.z) * Math.min(1, dt * 8);
}
