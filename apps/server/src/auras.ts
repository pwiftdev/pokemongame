import type {
  AuraId,
  AuraView,
} from "../../../packages/shared/combat-rules.js";

export interface ServerAura {
  id: AuraId;
  until: number;
  duration: number;
  ability?: string;
  source?: string;
  /** Damage per periodic tick, applied every second. */
  tick?: number;
  nextTick?: number;
}
export interface AuraHolder {
  auras: Map<AuraId, ServerAura>;
  guardUntil: number;
  stunUntil: number;
  slowUntil: number;
}
/** Statuses that other rules read through dedicated fields. */
const MIRRORED = {
  guard: "guardUntil",
  stun: "stunUntil",
  slow: "slowUntil",
} as const;

export function applyAura(
  holder: AuraHolder,
  id: AuraId,
  now: number,
  duration: number,
  extra: Partial<Omit<ServerAura, "id" | "until" | "duration">> = {},
) {
  const aura: ServerAura = { id, until: now + duration, duration, ...extra };
  if (aura.tick) aura.nextTick = now + 1000;
  holder.auras.set(id, aura);
  if (id in MIRRORED)
    holder[MIRRORED[id as keyof typeof MIRRORED]] = aura.until;
  return aura;
}
export function hasAura(holder: AuraHolder, id: AuraId, now: number) {
  const mirrored = MIRRORED[id as keyof typeof MIRRORED];
  if (mirrored) return holder[mirrored] > now;
  return (holder.auras.get(id)?.until ?? 0) > now;
}
export function removeAura(holder: AuraHolder, id: AuraId) {
  holder.auras.delete(id);
  const field = MIRRORED[id as keyof typeof MIRRORED];
  if (field) holder[field] = 0;
}
export function clearAuras(holder: AuraHolder) {
  holder.auras.clear();
  holder.guardUntil = 0;
  holder.stunUntil = 0;
  holder.slowUntil = 0;
}
/** Periodic damage auras whose tick is due, advancing their timers. */
export function dueTicks(holder: AuraHolder, now: number) {
  const due: ServerAura[] = [];
  for (const aura of holder.auras.values())
    if (aura.tick && aura.nextTick !== undefined && now >= aura.nextTick) {
      if (aura.nextTick <= aura.until) due.push(aura);
      aura.nextTick += 1000;
    }
  return due;
}
export function auraViews(holder: AuraHolder, now: number): AuraView[] {
  const views: AuraView[] = [];
  for (const id of Object.keys(MIRRORED) as (keyof typeof MIRRORED)[]) {
    const until = holder[MIRRORED[id]];
    if (until <= now) continue;
    const aura = holder.auras.get(id);
    views.push({
      id,
      until,
      duration: aura?.until === until ? aura.duration : until - now,
      ability: aura?.until === until ? aura.ability : undefined,
    });
  }
  for (const aura of holder.auras.values()) {
    if (aura.id in MIRRORED) continue;
    if (aura.until <= now) {
      holder.auras.delete(aura.id);
      continue;
    }
    views.push({
      id: aura.id,
      until: aura.until,
      duration: aura.duration,
      ability: aura.ability,
      source: aura.source,
    });
  }
  return views;
}
