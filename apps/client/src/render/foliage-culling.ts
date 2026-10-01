import type { Mesh } from "@babylonjs/core";

export function createFoliageCulling() {
  const batches: Array<{ mesh: Mesh; count: number }> = [];
  return {
    add(mesh: Mesh) {
      batches.push({ mesh, count: mesh.thinInstanceCount });
    },
    update(focus: { x: number; z: number }, lowQuality: boolean) {
      for (const { mesh, count } of batches) {
        const bounds = mesh.getBoundingInfo().boundingBox;
        const dx = Math.max(
          bounds.minimumWorld.x - focus.x,
          0,
          focus.x - bounds.maximumWorld.x,
        );
        const dz = Math.max(
          bounds.minimumWorld.z - focus.z,
          0,
          focus.z - bounds.maximumWorld.z,
        );
        const distance = Math.hypot(dx, dz);
        const density = Math.min(
          1,
          Math.max(
            0,
            ((lowQuality ? 65 : 110) - distance) / (lowQuality ? 36 : 74),
          ),
        );
        const visible = Math.floor(
          count * density * density * (lowQuality ? 0.18 : 1),
        );
        mesh.setEnabled(visible > 0);
        mesh.thinInstanceCount = visible;
      }
    },
    dispose() {
      for (const { mesh } of batches) mesh.dispose();
      batches.length = 0;
    },
  };
}
