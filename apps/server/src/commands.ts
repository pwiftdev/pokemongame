import { CLASS_IDS } from "../../../packages/shared/classes.js";
import { z } from "zod";
const requestId = z.string().uuid();
const id = z.string().min(1).max(100);
const kind = <T extends string>(value: T) => ({
  kind: z.literal(value),
  requestId,
});
export const commandSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("move"),
      dx: z.number().finite().min(-1).max(1),
      dz: z.number().finite().min(-1).max(1),
      sprint: z.boolean(),
      yaw: z.number().finite().min(-100).max(100),
    })
    .strict(),
  z
    .object({
      ...kind("starter"),
      species: id,
      classId: z.enum(CLASS_IDS).optional(),
    })
    .strict(),
  z.object({ ...kind("class"), classId: z.enum(CLASS_IDS) }).strict(),
  z
    .object({
      ...kind("pet"),
      mode: z.enum(["assist", "passive", "attack"]),
      target: id.optional(),
    })
    .strict(),
  z
    .object({
      ...kind("dash"),
      dx: z.number().finite().min(-1).max(1),
      dz: z.number().finite().min(-1).max(1),
    })
    .strict(),
  z.object({ ...kind("travel"), destination: id }).strict(),
  z
    .object({
      ...kind("attack"),
      target: id,
      slot: z.number().int().min(0).max(5),
    })
    .strict(),
  z.object({ ...kind("autoattack"), target: id.nullable() }).strict(),
  z
    .object({ ...kind("tame"), target: id, item: z.enum(["capsule", "prism"]) })
    .strict(),
  z
    .object({
      ...kind("buy"),
      item: id,
      quantity: z.number().int().min(1).max(20),
    })
    .strict(),
  z.object({ ...kind("use"), item: id }).strict(),
  z.object(kind("heal")).strict(),
  z
    .object({ ...kind("team"), ids: z.array(z.string().uuid()).max(3) })
    .strict(),
  z.object({ ...kind("deploy"), id: z.string().uuid().nullable() }).strict(),
  z.object({ ...kind("evolve"), id: z.string().uuid() }).strict(),
  z.object({ ...kind("claim"), quest: id }).strict(),
  z.object({ ...kind("acceptQuest"), quest: id }).strict(),
  z.object({ ...kind("interact"), place: id }).strict(),
  z.object({ ...kind("duel"), target: z.string().uuid() }).strict(),
  z.object({ ...kind("duelAccept"), id: z.string().uuid() }).strict(),
  z.object({ ...kind("duelReject"), id: z.string().uuid() }).strict(),
  z.object({ ...kind("duelCancel"), id: z.string().uuid() }).strict(),
  z.object(kind("surrender")).strict(),
  z.object({ ...kind("queue"), join: z.boolean() }).strict(),
  z
    .object({
      ...kind("emote"),
      value: z.enum(["hello", "cheer", "thanks", "ready"]),
    })
    .strict(),
]);
export type ValidCommand = z.infer<typeof commandSchema>;
export class RateLimit {
  private entries = new Map<string, { time: number; count: number }>();
  constructor(
    private max: number,
    private windowMs: number,
  ) {}
  allow(key: string, now = Date.now()) {
    let entry = this.entries.get(key);
    if (!entry || now - entry.time >= this.windowMs) {
      entry = { time: now, count: 0 };
      this.entries.set(key, entry);
    }
    if (this.entries.size > 10000)
      for (const [id, value] of this.entries)
        if (now - value.time > this.windowMs) this.entries.delete(id);
    return ++entry.count <= this.max;
  }
  remove(key: string) {
    this.entries.delete(key);
  }
}
