import { walkable } from "../packages/shared/rules.js";
import type { NetworkPlayer } from "./network-client.js";
const clear = (a: { x: number; z: number }, b: { x: number; z: number }) => {
  const count = Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) * 3);
  for (let i = 0; i <= count; i++) {
    const f = i / Math.max(1, count);
    if (!walkable(a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f, 1))
      return false;
  }
  return true;
};
export async function travel(
  p: InstanceType<typeof NetworkPlayer>,
  x: number,
  z: number,
) {
  const start = p.self!;
  let goal = { x: Math.round(x / 3) * 3, z: Math.round(z / 3) * 3 };
  if (!walkable(goal.x, goal.z, 1)) {
    const candidates = [];
    for (let dx = -6; dx <= 6; dx += 3)
      for (let dz = -6; dz <= 6; dz += 3) {
        const point = { x: goal.x + dx, z: goal.z + dz };
        if (walkable(point.x, point.z, 1)) candidates.push(point);
      }
    candidates.sort(
      (a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z),
    );
    goal = candidates[0];
  }
  const origin = {
    x: Math.round(start.x / 3) * 3,
    z: Math.round(start.z / 3) * 3,
  };
  if (clear(start, goal)) {
    await p.go(
      goal.x,
      goal.z,
      Math.max(
        30000,
        (Math.hypot(goal.x - start.x, goal.z - start.z) / 6) * 1000,
      ),
    );
    return;
  }
  const key = (point: { x: number; z: number }) => `${point.x},${point.z}`;
  const open = [origin],
    seen = new Set([key(origin)]),
    parents = new Map<string, { x: number; z: number }>();
  let found = false;
  while (open.length) {
    open.sort(
      (a, b) =>
        Math.hypot(a.x - goal.x, a.z - goal.z) -
        Math.hypot(b.x - goal.x, b.z - goal.z),
    );
    const node = open.shift()!;
    if (key(node) === key(goal)) {
      found = true;
      break;
    }
    for (const [dx, dz] of [
      [3, 0],
      [-3, 0],
      [0, 3],
      [0, -3],
      [3, 3],
      [-3, 3],
      [3, -3],
      [-3, -3],
    ]) {
      const next = { x: node.x + dx, z: node.z + dz };
      if (
        !seen.has(key(next)) &&
        walkable(next.x, next.z, 1) &&
        clear(node, next)
      ) {
        seen.add(key(next));
        parents.set(key(next), node);
        open.push(next);
      }
    }
  }
  if (!found) throw new Error(`No test navigation path to ${x},${z}`);
  const path = [goal];
  while (key(path[0]) !== key(origin)) {
    const before = parents.get(key(path[0]));
    if (!before) break;
    path.unshift(before);
  }
  for (let i = 0; i < path.length; ) {
    let end = i;
    while (end + 1 < path.length && clear(p.self!, path[end + 1])) end++;
    await p.go(
      path[end].x,
      path[end].z,
      Math.max(
        30000,
        (Math.hypot(path[end].x - p.self!.x, path[end].z - p.self!.z) / 6) *
          1000,
      ),
    );
    i = end + 1;
  }
}
