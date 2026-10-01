import { startup, modelGroup } from "../loading/progress";
import {
  InstancedMesh,
  Mesh,
  LoadAssetContainerAsync,
  TransformNode,
  type AssetContainer,
  type Scene,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { retryAsset } from "./asset-retry";

export async function loadModelLibrary(
  scene: Scene,
  urls: Record<string, string>,
  optional: (name: string) => boolean = () => false,
) {
  const strictStartup = startup.active;
  const templates = new Map<string, AssetContainer>();
  const pending = new Map<string, Promise<void>>();
  let disposed = false;
  const cancellation = new AbortController();
  const stop = () => {
    disposed = true;
    cancellation.abort();
  };
  scene.onDisposeObservable.addOnce(stop);
  async function load(name: string, url: string, retry = true) {
    if (templates.has(name)) return;
    if (pending.has(name)) return pending.get(name)!;
    const request = startup
      .track(url, modelGroup(url), name.replaceAll("_", " "), () =>
        retryAsset(
          () =>
            LoadAssetContainerAsync(url, scene, {
              pluginOptions: { gltf: { animationStartMode: 0 } },
            }),
          cancellation.signal,
          retry ? undefined : [],
        ),
      )
      .then((template) => {
        if (disposed) template.dispose();
        else templates.set(name, template);
      })
      .finally(() => pending.delete(name));
    pending.set(name, request);
    return request;
  }
  const results = await Promise.allSettled(
    Object.entries(urls).map(async ([name, url]) => {
      try {
        await load(name, url, strictStartup);
      } catch (error) {
        if (strictStartup || !optional(name)) throw error;
      }
    }),
  );
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") {
    stop();
    for (const template of templates.values()) template.dispose();
    throw failure.reason;
  }
  const whenReady = (name: string, ready: () => void) => {
    if (disposed) return;
    if (templates.has(name)) {
      ready();
      return;
    }
    void load(name, urls[name])
      .then(() => {
        if (!disposed) ready();
      })
      .catch((error) => {
        if (!disposed)
          console.warn(`Optional model ${name} unavailable`, error);
      });
  };
  for (const name of Object.keys(urls))
    if (!templates.has(name)) whenReady(name, () => {});
  return {
    load,
    whenReady,
    has: (name: string) => templates.has(name),
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
        for (const node of root.getChildTransformNodes())
          node.computeWorldMatrix(true);
        for (const mesh of root.getChildMeshes()) {
          if (mesh instanceof Mesh && mesh.skeleton) {
            mesh.skeleton.prepare(true);
            mesh.refreshBoundingInfo(true);
          }
        }
        const bounds = modelBounds(root);
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
        mesh.metadata = {
          ...mesh.metadata,
          ...(animated ? { target: id } : { cameraObstacle: true }),
        };
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
      stop();
      for (const template of templates.values()) template.dispose();
      templates.clear();
    },
  };
}

export function modelUrls(folder: string, names: readonly string[]) {
  return Object.fromEntries(
    names.map((name) => [name, `/assets/${folder}/${name}.glb`]),
  );
}

export function modelBounds(root: TransformNode) {
  return root.getHierarchyBoundingVectors(
    true,
    (mesh) =>
      (mesh instanceof Mesh || mesh instanceof InstancedMesh) &&
      mesh.isEnabled() &&
      mesh.getTotalVertices() > 0 &&
      !mesh.metadata?.gltf?.extras?.excludeFromBounds,
  );
}
