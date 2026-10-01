import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  type Scene,
} from "@babylonjs/core";
import type { CreatureActor, Motion } from "./creatures";
export function createTrainingDummy(scene: Scene, id: string): CreatureActor {
  const root = new TransformNode(id, scene);
  const colors = ["#735039", "#c4a56a", "#152659", "#eac65a"];
  const materials = colors.map((color, i) => {
    const m = new StandardMaterial(`${id}:material:${i}`, scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularColor = Color3.Black();
    return m;
  });
  const pole = MeshBuilder.CreateCylinder(
    `${id}:post`,
    { height: 2.2, diameter: 0.18, tessellation: 8 },
    scene,
  );
  pole.position.y = 1.1;
  const arms = MeshBuilder.CreateBox(
    `${id}:crossbar`,
    { width: 1.65, height: 0.15, depth: 0.16 },
    scene,
  );
  arms.position.y = 1.55;
  const body = MeshBuilder.CreateCylinder(
    `${id}:straw`,
    { height: 0.9, diameterTop: 0.65, diameterBottom: 0.5, tessellation: 10 },
    scene,
  );
  body.position.y = 1.3;
  body.material = materials[1];
  const head = MeshBuilder.CreateSphere(
    `${id}:head`,
    { diameter: 0.4, segments: 6 },
    scene,
  );
  head.position.y = 2;
  head.material = materials[1];
  const meshes = [pole, arms, body, head];
  for (const [i, diameter] of [0.66, 0.46, 0.22].entries()) {
    const ring = MeshBuilder.CreateCylinder(
      `${id}:bullseye:${i}`,
      { height: 0.035, diameter, tessellation: 24 },
      scene,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 1.4, -0.35 - i * 0.025);
    ring.material = materials[i === 1 ? 3 : 2];
    meshes.push(ring);
  }
  for (const mesh of meshes) {
    mesh.parent = root;
    mesh.material ??= materials[0];
    mesh.metadata = { target: id, castShadow: true };
    mesh.isPickable = true;
    mesh.receiveShadows = true;
  }
  let hitUntil = 0;
  const observer = scene.onBeforeRenderObservable.add(() => {
    const remaining = hitUntil - performance.now();
    root.rotation.x =
      remaining > 0 ? (Math.sin(remaining * 0.04) * 0.08 * remaining) / 400 : 0;
  });
  return {
    root,
    meshes,
    ready: Promise.resolve(true),
    modelReady: true,
    setDetail: () => {},
    animate: (motion: Motion) => {
      if (motion === "hit") hitUntil = performance.now() + 400;
    },
    dispose: () => {
      scene.onBeforeRenderObservable.remove(observer);
      root.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
