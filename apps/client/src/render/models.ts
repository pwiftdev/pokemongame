import {
  InstancedMesh,
  LoadAssetContainerAsync,
  TransformNode,
  type AssetContainer,
  type Scene,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export async function loadModelLibrary(
  scene: Scene,
  urls: Record<string, string>,
) {
  const templates = new Map<string, AssetContainer>();
  const results = await Promise.allSettled(
    Object.entries(urls).map(async ([name, url]) => {
      templates.set(name, await LoadAssetContainerAsync(url, scene));
    }),
  );
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") {
    for (const template of templates.values()) template.dispose();
    throw failure.reason;
  }
  return {
    create(name: string, id: string, height?: number, animated = false) {
      const template = templates.get(name);
      if (!template) throw new Error(`Unknown model: ${name}`);
      const instance = template.instantiateModelsToScene(
        (node) => `${id}:${node}`,
        false,
        { doNotInstantiate: animated },
      );
      if (animated)
        for (const group of instance.animationGroups) {
          group.enableBlending = true;
          group.blendingSpeed = 0.16;
        }
      const root = new TransformNode(id, scene);
      const pivot = new TransformNode(`${id}:pivot`, scene);
      pivot.parent = root;
      for (const node of instance.rootNodes) node.parent = pivot;
      if (height !== undefined) {
        root.computeWorldMatrix(true);
        const bounds = root.getHierarchyBoundingVectors();
        const scale = height / Math.max(0.01, bounds.max.y - bounds.min.y);
        root.scaling.setAll(scale);
        pivot.position.set(
          -(bounds.min.x + bounds.max.x) / 2,
          -bounds.min.y,
          -(bounds.min.z + bounds.max.z) / 2,
        );
      }
      const meshes = root.getChildMeshes();
      for (const mesh of meshes) {
        if (mesh instanceof InstancedMesh)
          mesh.sourceMesh.receiveShadows = true;
        else mesh.receiveShadows = true;
        mesh.isPickable = animated;
        mesh.metadata = animated ? { target: id } : { cameraObstacle: true };
      }
      return {
        root,
        meshes,
        animations: instance.animationGroups,
        dispose() {
          instance.dispose();
          root.dispose();
        },
      };
    },
    dispose() {
      for (const template of templates.values()) template.dispose();
    },
  };
}

export function modelUrls(folder: string, names: readonly string[]) {
  return Object.fromEntries(
    names.map((name) => [name, `/assets/${folder}/${name}.glb`]),
  );
}
