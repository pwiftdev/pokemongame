import { castTiming } from "./combat-timing";
export { castTiming } from "./combat-timing";
import { distance, lineOfSight, moveAmongCreatures } from "./rules";
import type { WildView } from "./types";

export interface HeroCast {
  ability: string;
  target: string;
  startedAt: number;
  releasesAt: number;
  resolvesAt: number;
  x: number;
  z: number;
  aimX: number;
  aimZ: number;
  released?: boolean;
  /** Resource paid, refunded if the cast is interrupted. */
  cost?: number;
  /** Combo points consumed by a finisher. */
  combo?: number;
}
export interface AttackShape {
  ability: string;
  name?: string;
  shape?: "circle" | "cone" | "line";
  startedAt?: number;
  resolvesAt: number;
  x: number;
  z: number;
  radius: number;
  yaw?: number;
  width?: number;
  arc?: number;
  charge?: boolean;
  releasesAt?: number;
  /** A targeted spell with a cast bar instead of a ground telegraph. */
  spell?: "bolt" | "mend" | "storm";
  interruptible?: boolean;
  target?: string;
}
export const DASH = {
  duration: 240,
  invulnerable: 190,
  cooldown: 4200,
  speed: 24,
};
export interface DashState {
  x: number;
  z: number;
  startedAt: number;
  until: number;
}
export function castInterrupted(
  cast: HeroCast,
  position: { x: number; z: number },
  stunned: boolean,
  _now: number,
) {
  return (
    !cast.released &&
    (stunned ||
      (castTiming(cast.ability, 0).stationary &&
        distance(cast, position) > 0.18))
  );
}
export function shapeContains(
  cast: AttackShape,
  position: { x: number; z: number },
) {
  const dx = position.x - cast.x,
    dz = position.z - cast.z;
  const forward = dx * Math.sin(cast.yaw ?? 0) + dz * Math.cos(cast.yaw ?? 0);
  const side = dx * Math.cos(cast.yaw ?? 0) - dz * Math.sin(cast.yaw ?? 0);
  if (cast.shape === "line")
    return (
      forward >= -0.4 &&
      forward <= cast.radius &&
      Math.abs(side) <= (cast.width ?? 1.2) / 2
    );
  if (distance(cast, position) > cast.radius) return false;
  return (
    cast.shape !== "cone" ||
    Math.abs(Math.atan2(side, forward)) <= (cast.arc ?? Math.PI / 2) / 2
  );
}
export function attackHits(
  cast: AttackShape,
  position: { x: number; z: number },
  now: number,
) {
  if (cast.releasesAt !== undefined) {
    if (now < cast.releasesAt || now > cast.resolvesAt + 50) return false;
    const duration = cast.resolvesAt - cast.releasesAt;
    const forward =
      (position.x - cast.x) * Math.sin(cast.yaw ?? 0) +
      (position.z - cast.z) * Math.cos(cast.yaw ?? 0);
    const front = Math.min(
      cast.radius,
      (cast.radius * (now - cast.releasesAt)) / duration,
    );
    const back = Math.max(
      0,
      (cast.radius * (now - cast.releasesAt - 50)) / duration,
    );
    return (
      forward >= back - 0.7 &&
      forward <= front + 0.7 &&
      shapeContains(cast, position) &&
      lineOfSight(cast, position)
    );
  }
  return (
    now >= cast.resolvesAt &&
    shapeContains(cast, position) &&
    lineOfSight(cast, position)
  );
}
export function dashStep(
  position: { x: number; z: number },
  direction: { x: number; z: number },
  seconds: number,
  creatures: Iterable<Pick<WildView, "x" | "z" | "hp" | "boss" | "elite">>,
) {
  const bodies = [...creatures];
  const steps = Math.max(1, Math.ceil((DASH.speed * seconds) / 0.2));
  let next = position;
  for (let i = 0; i < steps; i++)
    next = moveAmongCreatures(
      next.x,
      next.z,
      (direction.x * DASH.speed * seconds) / steps,
      (direction.z * DASH.speed * seconds) / steps,
      bodies,
    );
  return next;
}
