import { PLACES } from "../../../../packages/shared/data";
import { TRAINING_TARGETS } from "../../../../packages/shared/training";
const arena = PLACES.find((place) => place.id === "arena")!;
export function arenaClearing(x: number, z: number, margin = 0) {
  return (
    Math.hypot(x - arena.x, z - arena.z) < 9 + margin ||
    TRAINING_TARGETS.some(
      (t) => Math.abs(x - t.x) < 3 + margin && Math.abs(z - t.z) < 3 + margin,
    )
  );
}
