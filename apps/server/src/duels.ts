import { randomUUID } from "node:crypto";
import { PLACES } from "../../../packages/shared/data.js";
import type { GameEvent } from "../../../packages/shared/types.js";
import { getProfile, recordMatch, mutate } from "./db.js";
import { activeCreature, requirePlace, requirePeace } from "./gameplay.js";
import type { ValidCommand } from "./commands.js";
import type { Player, Duel } from "./room.js";
import { safeSend } from "./messaging.js";
import { clearAuras } from "./auras.js";
import { heroClass } from "../../../packages/shared/classes.js";
import { resourceStart } from "../../../packages/shared/combat-rules.js";
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
    requirePlace(p, "arena", 18);
    activeCreature(p.profile);
    const target = this.players.get(targetId);
    if (!target || !target.online || target === p)
      throw new Error("Choose another online trainer.");
    requirePeace(target);
    requirePlace(target, "arena", 18);
    activeCreature(target.profile);
    if (!(await this.update(p, request, () => {}))) return;
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
      requirePlace(a, "arena", 18);
      requirePlace(b, "arena", 18);
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
  async startDuel(duel: Duel) {
    const a = this.players.get(duel.a),
      b = this.players.get(duel.b);
    if (!a || !b) return;
    for (const p of [a, b]) {
      activeCreature(p.profile);
      p.duelId = duel.id;
      p.duelMax = 180;
      p.duelHp = 180;
      p.cast = undefined;
      p.dash = undefined;
      p.cooldowns.clear();
      clearAuras(p);
      p.combatUntil = 0;
      p.auto = undefined;
      p.combo = 0;
      p.gcdUntil = 0;
      p.resource = resourceStart(heroClass(p.profile.classId).resource, 10);
    }
    const arena = PLACES.find((place) => place.id === "arena")!;
    a.x = arena.x - 5;
    a.z = arena.z;
    b.x = arena.x + 5;
    b.z = arena.z;
    duel.state = "active";
    duel.expires = Date.now() + 180000;
    this.event({
      type: "duel",
      message:
        "Duel begins! Level 10 · 180 health · supplies locked. Select your opponent and command your companion.",
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
      for (const id of [duel.a, duel.b]) {
        const p = this.players.get(id);
        if (p) {
          p.cast = undefined;
          p.dash = undefined;
          p.duelId = undefined;
          p.combatUntil = 0;
          p.auto = undefined;
          clearAuras(p);
          p.profile = await getProfile(id);
          if (p.online) safeSend(p.client, "profile", p.profile);
          this.event(
            {
              type: "duel-result",
              message: winner
                ? winner === id
                  ? "Victory!"
                  : "A worthy effort. Your companion is safe."
                : "Duel drawn. Time has expired.",
              target: id,
            },
            p,
          );
        }
      }
    } finally {
      duel.finishing = false;
    }
  }
  async matchQueue() {
    while (this.queue.length >= 2) {
      const a = this.players.get(this.queue.shift()!),
        b = this.players.get(this.queue.shift()!);
      if (!a?.online || !b?.online || a.duelId || b.duelId) continue;
      const duel: Duel = {
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
