import { distance, lineOfSight } from "./rules";
export const DUEL_INVITE_RANGE = 20;
export function duelReach(
  a: { x: number; z: number },
  b: { x: number; z: number },
) {
  if (distance(a, b) > DUEL_INVITE_RANGE)
    return "Move within 20m of your opponent.";
  if (!lineOfSight(a, b)) return "Find a clear space between both trainers.";
  return "";
}
