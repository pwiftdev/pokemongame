import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  VertexBuffer,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import { terrainHeight } from "../../../../packages/shared/rules";
import { TRAINING_TARGETS } from "../../../../packages/shared/training";
import { createWorldLabel } from "./labels";
import type { loadScenery } from "./scenery";
export function dressArena(
  scene: Scene,
  scenery: Awaited<ReturnType<typeof loadScenery>>,
) {
  const materials = ["#d8b76a", "#51cae0", "#ef7361"].map((color, i) => {
    const m = new StandardMaterial(`arena paint:${i}`, scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.emissiveColor = m.diffuseColor.scale(0.15);
    m.specularColor = Color3.Black();
    return m;
  });
  const meshes: Mesh[] = [];
  const ring = (
    name: string,
    x: number,
    z: number,
    diameter: number,
    color = 0,
    thickness = 0.1,
  ) => {
    const mesh = MeshBuilder.CreateTorus(
      name,
      { diameter, thickness, tessellation: 64 },
      scene,
    );
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += x;
      positions[i + 2] += z;
      positions[i + 1] += terrainHeight(positions[i], positions[i + 2]) + 0.18;
    }
    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    mesh.refreshBoundingInfo();
    mesh.material = materials[color];
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    meshes.push(mesh);
  };
  ring("Sunstone fighting circle", 23, -13, 15.2, 0, 0.16);
  ring("Sunstone center crest", 23, -13, 3, 0, 0.12);
  ring("Blue challenger starting mark", 18, -13, 2.2, 1);
  ring("Red challenger starting mark", 28, -13, 2.2, 2);
  for (const x of [17, 23, 29]) {
    scenery.place("Bench", x, -3, 1.05, Math.PI);
    scenery.place("Prop_WoodenFence_Single", x, -1.8, 1.2);
  }
  for (const [x, z] of [
    [13, -7],
    [33, -7],
  ]) {
    scenery.place("Banner_1", x, z, 3);
    scenery.place("Barrel", x, z + 1, 0.8);
  }
  for (const t of TRAINING_TARGETS)
    ring(`${t.name} practice lane`, t.x, t.z, 3.2, t.health < 1 ? 2 : 1, 0.07);
  scenery.place("Bench", 46, -21, 1, 0);
  scenery.place("Prop_Crate", 48, -22, 0.75, 0.2);
  const labels = [
    createWorldLabel(scene, "SUNSTONE ARENA", 3.8),
    createWorldLabel(scene, "TRAINING YARD", 3.8),
  ];
  labels[0].update("SUNSTONE ARENA", "Queue here · Challenge anywhere");
  labels[0].mesh.position.set(23, terrainHeight(23, -5) + 3.2, -5);
  labels[1].update(
    "TRAINING YARD",
    "Select a dummy · 1–6 abilities · T attack",
  );
  labels[1].mesh.position.set(40, terrainHeight(40, -25) + 3.3, -25);
  return {
    dispose() {
      for (const label of labels) label.dispose();
      for (const mesh of meshes) mesh.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
