import { randomUUID } from "node:crypto";
import { PLACES } from "../../../packages/shared/data.js";
import type { GameEvent } from "../../../packages/shared/types.js";
import { recordMatch, mutate } from "./db.js";
import { activeCreature, requirePlace, requirePeace } from "./gameplay.js";
import type { ValidCommand } from "./commands.js";
import type { Player, Duel } from "./room.js";
import { safeSend } from "./messaging.js";
import { clearAuras } from "./auras.js";
import { heroClass } from "../../../packages/shared/classes.js";
import { resourceStart } from "../../../packages/shared/combat-rules.js";
import { distance } from "../../../packages/shared/rules.js";
import { duelReach } from "../../../packages/shared/duel-rules.js";
import { heroHp, heroLevel } from "../../../packages/shared/hero.js";
import { DUEL_LEVEL } from "../../../packages/shared/hero.js";
export class DuelSystem {
  duels = new Map<string, Duel>();
  queue: string[] = [];
  constructor(
    private players: Map<string, Player>,
    private event: (event: GameEvent, p?: Player) => void,
    private update: (
      p: Player,
      request: string,
      action: Parameters<typeof mutate>[2],
    ) => Promise<boolean>,
  ) {}
  async invite(p: Player, targetId: string, request: string) {
    requirePeace(p);

    activeCreature(p.profile);
    const target = this.players.get(targetId);
    if (!target || !target.online || target === p)
      throw new Error("Choose another online trainer.");
    requirePeace(target);

    activeCreature(target.profile);
    this.requireReady(p, target);
    if (!(await this.update(p, request, () => {}))) return;
    this.requireReady(p, target);
    const duel: Duel = {
      id: randomUUID(),
      a: p.profile.id,
      b: targetId,
      state: "invite",
      expires: Date.now() + 30000,
      finishing: false,
    };
    this.duels.set(duel.id, duel);
    p.duelId = duel.id;
    target.duelId = duel.id;
    this.queue = this.queue.filter(
      (id) => id !== p.profile.id && id !== targetId,
    );
    this.event({
      type: "duel",
      message: `${p.profile.nickname} invited ${target.profile.nickname} to a friendly duel.`,
      target: targetId,
      source: p.profile.id,
    });
  }
  async respondDuel(
    p: Player,
    c: Extract<
      ValidCommand,
      { kind: "duelAccept" | "duelReject" | "duelCancel" }
    >,
  ) {
    if (this.players.get(p.profile.id) !== p || !p.online)
      throw new Error("Your session is no longer active.");
    const duel = this.duels.get(c.id);
    if (!duel || duel.state !== "invite" || duel.expires < Date.now())
      throw new Error("This invitation has expired.");
    if ((c.kind === "duelCancel" ? duel.a : duel.b) !== p.profile.id)
      throw new Error("This invitation does not belong to you.");
    if (c.kind === "duelAccept") {
      const a = this.players.get(duel.a),
        b = this.players.get(duel.b);
      if (!a?.online || !b?.online)
        throw new Error("Both trainers must be online.");
      this.requireReady(a, b, duel.id);
      await this.startDuel(duel);
    } else this.cancelDuel(duel);
  }
  cancelDuel(duel: Duel) {
    for (const id of [duel.a, duel.b]) {
      const p = this.players.get(id);
      if (p?.duelId === duel.id) p.duelId = undefined;
    }
    this.duels.delete(duel.id);
  }
  private requireReady(a: Player, b: Player, duelId?: string, nearby = true) {
    for (const p of [a, b]) {
      if (this.players.get(p.profile.id) !== p || !p.online)
        throw new Error("Both trainers must be online.");
      if (heroHp(p.profile) <= 0)
        throw new Error("Both trainers must be healed before dueling.");
      if ((p.duelId && p.duelId !== duelId) || p.combatUntil > Date.now())
        throw new Error("Both trainers must finish their encounter first.");
      activeCreature(p.profile);
    }
    const blocked = duelReach(a, b);
    if (nearby && blocked) throw new Error(blocked);
  }
  async startDuel(duel: Duel) {
    const a = this.players.get(duel.a),
      b = this.players.get(duel.b);
    if (!a || !b) return;
    for (const p of [a, b]) activeCreature(p.profile);
    for (const p of [a, b]) {
      p.duelId = duel.id;
      p.duelMax = 180;
      p.duelHp = 180;
      p.cast = undefined;
      p.dash = undefined;
      p.mobility = undefined;
      p.dx = p.dz = 0;
      p.petTarget = undefined;
      if (p.pet) {
        p.pet.cast = undefined;
        p.pet.command = undefined;
      }
      p.cooldowns.clear();
      clearAuras(p);
      p.combatUntil = 0;
      p.auto = undefined;
      p.combo = 0;
      p.gcdUntil = 0;
      p.resource = resourceStart(
        heroClass(p.profile.classId).resource,
        DUEL_LEVEL,
      );
    }
    if (duel.arena) {
      const arena = PLACES.find((place) => place.id === "arena")!;
      a.x = arena.x - 5;
      a.z = arena.z;
      b.x = arena.x + 5;
      b.z = arena.z;
    }
    a.yaw = Math.atan2(b.x - a.x, b.z - a.z);
    b.yaw = a.yaw + Math.PI;
    duel.state = "active";
    duel.expires = Date.now() + 180000;
    this.event({
      type: "duel",
      message:
        "Duel begins! Level 10 · 180 health · supplies locked. Select your opponent and use your class abilities. Companions rest during duels.",
      target: duel.id,
    });
  }
  async finishDuel(duel: Duel, winner: string | null, reason: string) {
    if (duel.state !== "active" || duel.finishing) return;
    duel.finishing = true;
    try {
      const recorded = await recordMatch(
        duel.id,
        duel.a,
        duel.b,
        winner,
        reason,
      );
      winner = recorded.winner;
      reason = recorded.reason;
      duel.state = "finished";
      duel.winner = winner ?? undefined;
      duel.reason = reason;
      duel.expires = Date.now() + 12000;
      const participants: Player[] = [];
      for (const id of [duel.a, duel.b]) {
        const p = this.players.get(id);
        if (!p || p.duelId !== duel.id) continue;
        p.cast = undefined;
        p.dash = undefined;
        p.mobility = undefined;
        p.duelId = undefined;
        p.combatUntil = 0;
        p.auto = undefined;
        clearAuras(p);
        const profile = recorded.profiles.find((profile) => profile.id === id);
        if (profile) p.profile = profile;
        p.cooldowns.clear();
        p.gcdUntil = 0;
        p.combo = 0;
        p.resource = resourceStart(
          heroClass(p.profile.classId).resource,
          heroLevel(p.profile),
        );
        participants.push(p);
      }
      for (const p of participants) {
        if (p.online) safeSend(p.client, "profile", p.profile);
        try {
          this.event(
            {
              type: "duel-result",
              message: winner
                ? winner === p.profile.id
                  ? "Victory!"
                  : "A worthy effort. Your companion is safe."
                : "Duel drawn. Time has expired.",
              target: p.profile.id,
            },
            p,
          );
        } catch (error) {
          console.error("Duel result delivery failed", error);
        }
      }
    } finally {
      duel.finishing = false;
    }
  }
  pruneQueue() {
    const arena = PLACES.find((place) => place.id === "arena")!;
    this.queue = this.queue.filter((id) => {
      const p = this.players.get(id);
      return (
        p?.online &&
        !p.duelId &&
        heroHp(p.profile) > 0 &&
        p.combatUntil <= Date.now() &&
        distance(p, arena) <= 18
      );
    });
  }
  async matchQueue() {
    this.pruneQueue();
    while (this.queue.length >= 2) {
      const a = this.players.get(this.queue.shift()!),
        b = this.players.get(this.queue.shift()!);
      if (!a?.online || !b?.online || a.duelId || b.duelId) continue;
      try {
        for (const p of [a, b]) {
          requirePeace(p);
          requirePlace(p, "arena", 18);
        }
        this.requireReady(a, b, undefined, false);
      } catch {
        continue;
      }
      const duel: Duel = {
        arena: true,
        id: randomUUID(),
        a: a.profile.id,
        b: b.profile.id,
        state: "invite",
        expires: Date.now() + 30000,
        finishing: false,
      };
      this.duels.set(duel.id, duel);
      await this.startDuel(duel);
    }
  }
}
