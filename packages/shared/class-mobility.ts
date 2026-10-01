import { distance, lineOfSight, walkable } from "./rules";
import { PLACES } from "./data";
export interface Point {
  x: number;
  z: number;
}
export interface HeroMobility {
  from: Point;
  to: Point;
  startedAt: number;
  until: number;
  ability: string;
  target?: string;
}
export function mobilityDestination(
  from: Point,
  yaw: number,
  target?: Point,
  arena = false,
) {
  const d = target ? distance(from, target) : 9;
  const range = target ? Math.max(0, d - 2) : 9;
  const angle = target ? Math.atan2(target.x - from.x, target.z - from.z) : yaw;
  let end = { ...from };
  const center = PLACES.find((p) => p.id === "arena")!;
  for (let step = 0.25; step <= range; step += 0.25) {
    const p = {
      x: from.x + Math.sin(angle) * step,
      z: from.z + Math.cos(angle) * step,
    };
    if (
      !walkable(p.x, p.z) ||
      !lineOfSight(end, p) ||
      (arena && distance(p, center) >= 17)
    )
      break;
    end = p;
  }
  return end;
}
