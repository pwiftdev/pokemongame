import type { AbstractMesh, Observer, Scene } from "@babylonjs/core";

/** Keep disabled scenery out of the renderer's per-frame candidate scan. */
export function cacheEnabledMeshCandidates(scene: Scene) {
  const previous = scene.getActiveMeshCandidates;
  const enabled = new Set<AbstractMesh>();
  const observers = new Map<AbstractMesh, Observer<boolean>>();
  let dirty = true;
  let candidates = { data: [] as AbstractMesh[], length: 0 };
  const sync = (mesh: AbstractMesh) => {
    if (mesh.isEnabled()) enabled.add(mesh);
    else enabled.delete(mesh);
    dirty = true;
  };
  const add = (mesh: AbstractMesh) => {
    if (
      observers.has(mesh) ||
      mesh.isDisposed() ||
      !scene.meshes.includes(mesh)
    )
      return;
    observers.set(
      mesh,
      mesh.onEffectiveEnabledStateChangedObservable.add(() => sync(mesh)),
    );
    sync(mesh);
  };
  const remove = (mesh: AbstractMesh) => {
    mesh.onEffectiveEnabledStateChangedObservable.remove(
      observers.get(mesh) ?? null,
    );
    observers.delete(mesh);
    enabled.delete(mesh);
    dirty = true;
  };
  scene.meshes.forEach(add);
  const added = scene.onNewMeshAddedObservable.add(add);
  const removed = scene.onMeshRemovedObservable.add(remove);
  const provider = () => {
    // Babylon defers mesh-added notifications until after construction.
    if (observers.size !== scene.meshes.length) scene.meshes.forEach(add);
    if (dirty) {
      const data = Array.from(enabled);
      candidates = { data, length: data.length };
      dirty = false;
    }
    return candidates;
  };
  scene.getActiveMeshCandidates = provider;
  const dispose = () => {
    scene.onNewMeshAddedObservable.remove(added);
    scene.onMeshRemovedObservable.remove(removed);
    scene.onDisposeObservable.remove(disposed);
    for (const mesh of observers.keys()) remove(mesh);
    if (scene.getActiveMeshCandidates === provider)
      scene.getActiveMeshCandidates = previous;
  };
  const disposed = scene.onDisposeObservable.add(dispose);
  return dispose;
}
