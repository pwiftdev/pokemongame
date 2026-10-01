import {
  RACE_IDS,
  BODY_IDS,
  HAIR_IDS,
  BEARD_IDS,
  FACE_IDS,
  BROW_IDS,
  OUTFIT_IDS,
  HAIR_COLORS,
  EYE_COLORS,
  OUTFIT_COLORS,
  cleanDisplayName,
  validDisplayName,
} from "../../../packages/shared/appearance.js";
import { CLASS_IDS } from "../../../packages/shared/classes.js";
import { z } from "zod";
const requestId = z.string().uuid();
const id = z.string().min(1).max(100);
const kind = <T extends string>(value: T) => ({
  kind: z.literal(value),
  requestId,
});
export const appearanceSchema = z
  .object({
    race: z.enum(RACE_IDS),
    body: z.enum(BODY_IDS),
    skin: z.number().int().min(0).max(7),
    hairStyle: z.enum(HAIR_IDS),
    hairColor: z
      .number()
      .int()
      .min(0)
      .max(HAIR_COLORS.length - 1),
    eyeColor: z
      .number()
      .int()
      .min(0)
      .max(EYE_COLORS.length - 1),
    facialHair: z.enum(BEARD_IDS),
    face: z.enum(FACE_IDS),
    brow: z.enum(BROW_IDS),
    height: z.number().min(0.9).max(1.1),
    jaw: z.number().min(-1).max(1),
    nose: z.number().min(-1).max(1),
    ears: z.number().min(0).max(1),
    outfit: z.enum(OUTFIT_IDS),
    outfitColor: z
      .number()
      .int()
      .min(0)
      .max(OUTFIT_COLORS.length - 1),
    shoulders: z.boolean(),
  })
  .strict();
const displayName = z
  .string()
  .max(80)
  .transform(cleanDisplayName)
  .refine(
    (value) => validDisplayName(value),
    "Use 2–18 letters, numbers, spaces, apostrophes or hyphens.",
  );
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
      appearance: appearanceSchema.optional(),
    })
    .strict(),
  z
    .object({
      ...kind("class"),
      classId: z.enum(CLASS_IDS),
      appearance: appearanceSchema.optional(),
    })
    .strict(),
  z
    .object({
      ...kind("appearance"),
      appearance: appearanceSchema,
      nickname: displayName.optional(),
    })
    .strict(),
  z
    .object({
      ...kind("renamePet"),
      creature: z.string().uuid(),
      nickname: z
        .string()
        .max(80)
        .transform(cleanDisplayName)
        .refine(
          (value) => value === "" || validDisplayName(value, 1),
          "Use up to 18 letters, numbers, spaces, apostrophes or hyphens.",
        ),
    })
    .strict(),
  z
    .object({
      ...kind("petMove"),
      slot: z.number().int().min(0).max(3),
      target: id.optional(),
    })
    .strict(),
  z.object({ ...kind("swap"), slot: z.number().int().min(0).max(2) }).strict(),
  z
    .object({
      ...kind("learn"),
      creature: z.string().uuid(),
      slot: z.number().int().min(0).max(3),
      move: id,
    })
    .strict(),
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
  z
    .object({
      ...kind("evolve"),
      id: z.string().uuid(),
      species: id.optional(),
    })
    .strict(),
  z
    .object({ ...kind("dexReward"), count: z.number().int().min(1).max(1000) })
    .strict(),
  z.object({ ...kind("claim"), quest: id }).strict(),
  z.object({ ...kind("acceptQuest"), quest: id }).strict(),
  z.object({ ...kind("interact"), place: id }).strict(),
  z.object({ ...kind("practiceReset") }).strict(),
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
  private nextSweep = 0;
  constructor(
    private max: number,
    private windowMs: number,
    private maxKeys = 10000,
  ) {}
  allow(key: string, now = Date.now()) {
    if (now >= this.nextSweep) {
      this.nextSweep = now + Math.min(this.windowMs, 1000);
      for (const [id, value] of this.entries)
        if (now - value.time >= this.windowMs) this.entries.delete(id);
    }
    let entry = this.entries.get(key);
    if (!entry || now - entry.time >= this.windowMs) {
      if (!entry && this.entries.size >= this.maxKeys) return false;
      entry = { time: now, count: 0 };
      this.entries.set(key, entry);
    }
    return ++entry.count <= this.max;
  }
  remove(key: string) {
    this.entries.delete(key);
  }
}
