export const TRAINING_SPECIES = "training-dummy";
export const TRAINING_TARGETS = [
  { id: "training-strikes", name: "Striking dummy", x: 35, z: -25, health: 1 },
  {
    id: "training-execute",
    name: "Finisher dummy",
    x: 40,
    z: -25,
    health: 0.2,
  },
  { id: "training-combos", name: "Combo dummy", x: 45, z: -25, health: 1 },
] as const;
export const PRACTICE_IDLE_MS = 10000;
export interface PracticeView {
  target: string;
  startedAt: number;
  lastHitAt: number;
  damage: number;
  hits: number;
  bestHit: number;
  abilities: string[];
}
export function isTraining(target?: object) {
  return !!target && "species" in target && target.species === TRAINING_SPECIES;
}
export function practiceHit(
  previous: PracticeView | undefined,
  target: string,
  damage: number,
  ability: string,
  now: number,
): PracticeView {
  const session =
    previous &&
    previous.target === target &&
    now - previous.lastHitAt < PRACTICE_IDLE_MS
      ? previous
      : {
          target,
          startedAt: now,
          lastHitAt: now,
          damage: 0,
          hits: 0,
          bestHit: 0,
          abilities: [],
        };
  session.lastHitAt = now;
  session.damage += damage;
  session.hits++;
  session.bestHit = Math.max(session.bestHit, damage);
  if (!session.abilities.includes(ability) && session.abilities.length < 32)
    session.abilities.push(ability);
  return session;
}
export function practiceDps(session: PracticeView, now: number) {
  const end =
    now - session.lastHitAt >= PRACTICE_IDLE_MS ? session.lastHitAt : now;
  return session.damage / Math.max(1, (end - session.startedAt) / 1000);
}
