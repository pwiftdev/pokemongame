import {
  TRAINING_SPAWNS,
  trainingHealth,
  hitTrainingTarget,
  tickTrainingTarget,
  resetPractice,
} from "./training.js";
import {
  isTraining,
  type PracticeView,
} from "../../../packages/shared/training.js";
import { normalizeAppearance } from "../../../packages/shared/appearance.js";
import { HttpError } from "./errors.js";
import { createCompanionCombat } from "./companion-combat.js";
import {
  DEX_REWARDS,
  recordPokemon,
  capturePresentation,
} from "../../../packages/shared/pokedex.js";
import {
  pokemonAvailable,
  worldConditions,
} from "../../../packages/shared/pokemon-habitats.js";
import { tickPokemonAmbient, type AmbientPokemon } from "./pokemon-wildlife.js";
import { deployCompanion, type CompanionState } from "./companion.js";
import { POKEMON } from "../../../packages/shared/pokemon.js";
import { POKEMON_MOVES } from "../../../packages/shared/pokemon-moves.js";
import {
  LEGACY_TYPES,
  typeMultiplier,
} from "../../../packages/shared/pokemon-types.js";
import {
  availableMoves,
  pokemonDamage,
  pokemonStats,
  weakenedPokemon,
} from "../../../packages/shared/pokemon-rules.js";
import {
  DASH,
  dashStep,
  castTiming,
  castInterrupted,
  type HeroCast,
  type DashState,
} from "../../../packages/shared/combat.js";
import type { Ability } from "../../../packages/shared/data.js";
import {
  interactionRadius,
  hasStoryInteraction,
  recordQuestEvent,
  tutorialCapture,
  QUESTS,
} from "../../../packages/shared/story.js";
import {
  encounterLeash,
  encounterRespawnMs,
  canRespawn,
} from "../../../packages/shared/encounters.js";
import { WAYSTONES, isSafeArea } from "../../../packages/shared/regions.js";
import {
  heroHp,
  heroLevel,
  heroMaxHp,
  heroCombatLevel,
  DUEL_LEVEL,
} from "../../../packages/shared/hero.js";
import {
  COMBO_MAX,
  GCD_MS,
  RESOURCES,
  abilityUnlocked,
  heroClass,
} from "../../../packages/shared/classes.js";
import {
  AURAS,
  DOT_MS,
  ENRAGE_MS,
  EVASION_MS,
  LOCKOUT_MS,
  OUT_OF_COMBAT_REGEN,
  TAUNT_MS,
  creatureAttackChances,
  heroAttackChances,
  isSpell,
  landed,
  outcomeScale,
  regenResource,
  resourceFromDealt,
  resourceFromTaken,
  resourceMax,
  resourceStart,
  rollOutcome,
  swingDamage,
  threatLeader,
  variance,
  type HitChances,
  type Outcome,
} from "../../../packages/shared/combat-rules.js";
import {
  applyAura,
  auraViews,
  clearAuras,
  dueTicks,
  hasAura,
  type ServerAura,
} from "./auras.js";
import { randomUUID } from "node:crypto";
import {
  bossCast,
  creatureCast,
  creatureSpell,
  castHits,
  BOSS_ATTACKS,
  RANGED_ELEMENTS,
  type BossCast,
} from "./boss.js";
import { DuelSystem } from "./duels.js";
import { safeSend } from "./messaging.js";
import { allowedOrigin } from "./config.js";
import {
  Room,
  ServerError,
  type Client,
  type AuthContext,
} from "@colyseus/core";
import {
  ABILITIES,
  BRAND,
  BIOMES,
  ITEMS,
  PLACES,
  SPAWNS,
  SPECIES,
  STARTERS,
  WORLD,
} from "../../../packages/shared/data.js";
import {
  biomeAt,
  captureChance,
  distance,
  effectiveness,
  lineOfSight,
  maxHp,
  moveWithCollision,
  moveAmongCreatures,
} from "../../../packages/shared/rules.js";
import type {
  DuelView,
  GameEvent,
  PlayerView,
  Profile,
  WildView,
  WorldSnapshot,
} from "../../../packages/shared/types.js";
import { captureOwner, authenticate, getProfile, mutate } from "./db.js";
import { commandSchema, RateLimit, type ValidCommand } from "./commands.js";
import {
  abilityFor,
  evolvePokemon,
  activeCreature,
  claimQuest,
  acceptQuest,
  inspectStoryPlace,
  consume,
  gainExperience,
  increment,
  makeCreature,
  purchase,
  requirePlace,
  requirePeace,
  useItem,
} from "./gameplay.js";

export interface Player {
  practice?: PracticeView;
  cast?: HeroCast;
  dash?: DashState;
  petMode?: "assist" | "passive";
  petTarget?: string;
  pet?: CompanionState;
  petCooldowns?: Map<string, Record<string, number>>;
  petSwapUntil?: number;
  client: Client;
  profile: Profile;
  x: number;
  z: number;
  yaw: number;
  dx: number;
  dz: number;
  sprint: boolean;
  inputAt: number;
  online: boolean;
  cooldowns: Map<string, number>;
  guardUntil: number;
  slowUntil: number;
  stunUntil: number;
  combatUntil: number;
  bait: boolean;
  emote: string;
  emoteUntil: number;
  duelId?: string;
  duelHp: number;
  duelMax: number;
  lastUse: number;
  resource: number;
  resourceAt: number;
  combo: number;
  gcdUntil: number;
  lastCast: number;
  /** Automatic weapon swings against a target. */
  auto?: { target: string; next: number };
  auras: Map<ServerAura["id"], ServerAura>;
  /** Hero health changed in memory but not yet saved. */
  hpDirty: boolean;
  hpSavedAt: number;
  regenAt: number;
}
export interface Wild extends Omit<WildView, "auras" | "threat" | "evading"> {
  habitat: string;
  cast?: BossCast;
  castCount: number;
  castVictims?: Set<string>;
  home: { x: number; z: number };
  encounter: string;
  contributors: Map<string, number>;
  lastAttack: number;
  lastThink: number;
  angle: number;
  guardUntil: number;
  slowUntil: number;
  stunUntil: number;
  rewardPending: boolean;
  auras: Map<ServerAura["id"], ServerAura>;
  threat: Map<string, number>;
  tauntBy?: string;
  tauntUntil: number;
  nextSwing: number;
  swungAt: number;
  nextSpecial: number;
  lockoutUntil: number;
  specials: number;
  /** Leashed and running home: immune until it arrives. */
  resetting: boolean;
  retreatSince: number;
  ambientAt?: number;
  warnedAt?: number;
  destination?: AmbientPokemon["destination"];
  ambientSpeed?: number;
}
/** How long combat lingers after the last hostile action. */
const COMBAT_MS = 6000;
const HP_SAVE_MS = 1500;
export interface Duel extends DuelView {
  finishing: boolean;
  reason?: string;
}
const sessions = new Map<string, { room: IslandRoom; sessionId: string }>();
function threatShares(table: Map<string, number>) {
  const top = Math.max(1, ...table.values());
  return Object.fromEntries(
    [...table].map(([id, value]) => [id, Math.round((value / top) * 100)]),
  );
}
const isCurrent = (p: Player, room: IslandRoom) =>
  sessions.get(p.profile.id)?.room === room &&
  sessions.get(p.profile.id)?.sessionId === p.client.sessionId;
export class IslandRoom extends Room {
  maxClients = WORLD.maxPlayers;
  private players = new Map<string, Player>();
  private wilds = new Map<string, Wild>();
  private companionCombat = createCompanionCombat({
    wilds: this.wilds,
    event: (event) => this.event(event),
    attack: (p, target, slot, request) =>
      this.attack(p, target, slot, request, true),
    impact: (p, target, move) => this.impactAttack(p, target, move, true),
  });
  private duelSystem = new DuelSystem(
    this.players,
    (event, p) => this.event(event, p),
    (p, request, action) => this.update(p, request, action),
  );
  private get duels() {
    return this.duelSystem.duels;
  }
  private get queue() {
    return this.duelSystem.queue;
  }
  private set queue(value: string[]) {
    this.duelSystem.queue = value;
  }
  private serial: Promise<unknown> = Promise.resolve();
  private commandLimit = new RateLimit(18, 1000);
  private movementLimit = new RateLimit(45, 1000);
  private pendingTicks = false;
  private lastSnapshot = 0;
  private lastDiscovery = 0;
  private pendingCommands = 0;
  private ticks = 0;
  private tickTotal = 0;
  private tickMax = 0;
  private tickSamples: number[] = [];
  private queueWaitSamples: number[] = [];
  static rooms = new Set<IslandRoom>();
  static metrics() {
    return [...IslandRoom.rooms].map((room) => {
      const samples = [...room.tickSamples].sort((a, b) => a - b);
      const waits = [...room.queueWaitSamples].sort((a, b) => a - b);
      return {
        roomId: room.roomId,
        players: room.players.size,
        ticks: room.ticks,
        meanTickMs: room.tickTotal / Math.max(1, room.ticks),
        p95TickMs: samples[Math.floor(samples.length * 0.95)] ?? 0,
        maxTickMs: room.tickMax,
        p95QueueWaitMs: waits[Math.floor(waits.length * 0.95)] ?? 0,
      };
    });
  }
  onCreate() {
    if (IslandRoom.rooms.size >= 8)
      throw new ServerError(
        503,
        "All islands are busy. Please try again shortly.",
      );
    IslandRoom.rooms.add(this);
    for (const spawn of [...SPAWNS, ...TRAINING_SPAWNS]) {
      const hp =
        maxHp(spawn.species, spawn.level) *
        (spawn.boss ? 12 : spawn.elite ? 2.1 : 1);
      this.wilds.set(spawn.id, {
        ...spawn,
        hp: isTraining(spawn)
          ? trainingHealth(spawn.id, hp)
          : pokemonAvailable(spawn.species, Date.now())
            ? Math.round(hp)
            : 0,
        respawnAt: Date.now() + 1000,
        shiny: !!POKEMON[spawn.species] && Math.random() < 1 / 512,
        maxHp: Math.round(hp),
        elite: !!spawn.elite,
        boss: !!spawn.boss,
        state: "idle",
        phase: 1,
        home: { x: spawn.x, z: spawn.z },
        encounter: randomUUID(),
        contributors: new Map(),
        lastAttack: 0,
        castCount: 0,
        lastThink: 0,
        angle: 0,
        guardUntil: 0,
        slowUntil: 0,
        stunUntil: 0,
        rewardPending: false,
        auras: new Map(),
        threat: new Map(),
        tauntUntil: 0,
        nextSwing: 0,
        swungAt: 0,
        nextSpecial: 0,
        lockoutUntil: 0,
        specials: 0,
        resetting: false,
        retreatSince: 0,
      });
    }
    this.onMessage("command", (client, raw) => {
      const p = [...this.players.values()].find(
        (p) => p.client.sessionId === client.sessionId,
      );
      if (!p || !isCurrent(p, this)) return;
      const parsed = commandSchema.safeParse(raw);
      if (!parsed.success) {
        safeSend(client, "error", { message: "Invalid command." });
        return;
      }
      const command = parsed.data;
      const limiter =
        command.kind === "move" ? this.movementLimit : this.commandLimit;
      if (!limiter.allow(client.sessionId)) {
        safeSend(client, "error", { message: "Slow down for a moment." });
        return;
      }
      if (command.kind === "move") {
        p.dx = command.dx;
        p.dz = command.dz;
        p.sprint = command.sprint;
        p.yaw = command.yaw;
        p.inputAt = Date.now();
        return;
      }
      if (this.pendingCommands > 64) {
        safeSend(client, "error", {
          message: "The world is busy. Please try again.",
        });
        return;
      }
      this.pendingCommands++;
      this.serial = this.serial
        .then(async () => {
          if (isCurrent(p, this) && p.online) await this.command(p, command);
        })
        .catch((error) => this.sendError(client, error))
        .finally(() => this.pendingCommands--);
    });
    this.setSimulationInterval(() => {
      if (this.pendingTicks) return;
      this.pendingTicks = true;
      const queuedAt = performance.now();
      this.serial = this.serial
        .then(async () => {
          const started = performance.now();
          this.queueWaitSamples.push(started - queuedAt);
          if (this.queueWaitSamples.length > 1200)
            this.queueWaitSamples.shift();
          await this.tick();
          const elapsed = performance.now() - started;
          this.ticks++;
          this.tickTotal += elapsed;
          this.tickMax = Math.max(this.tickMax, elapsed);
          this.tickSamples.push(elapsed);
          if (this.tickSamples.length > 1200) this.tickSamples.shift();
        })
        .catch((error) => console.error("Simulation operation failed", error))
        .finally(() => {
          this.pendingTicks = false;
        });
    }, WORLD.tickMs);
    this.clock.setInterval(() => {
      console.log(
        JSON.stringify({
          room: this.roomId,
          players: this.players.size,
          ticks: this.ticks,
          meanTickMs: +(this.tickTotal / Math.max(1, this.ticks)).toFixed(2),
          maxTickMs: +this.tickMax.toFixed(2),
        }),
      );
    }, 60000);
  }
  private static admission = new RateLimit(12, 60000);
  private static creations = new RateLimit(3, 60000);
  static async onAuth(
    _token: string,
    options: { token?: unknown },
    context: AuthContext,
  ) {
    if (!allowedOrigin(context.headers.get("origin")))
      throw new ServerError(403, "Origin is not allowed.");
    const profile = await authenticate(options?.token).catch((error) => {
      if (error instanceof HttpError)
        throw new ServerError(error.status, error.message);
      console.error("Room authentication unavailable", error);
      throw new ServerError(
        503,
        "Connection temporarily unavailable. Please try again.",
      );
    });
    if (!IslandRoom.admission.allow(profile.id))
      throw new ServerError(
        429,
        "Too many connection attempts. Please wait a moment.",
      );
    if (
      new URL(context.req?.url ?? "http://local").pathname.startsWith(
        "/matchmake/create/",
      ) &&
      !IslandRoom.creations.allow(profile.id)
    )
      throw new ServerError(429, "Please wait before creating another island.");
    return profile;
  }
  async onJoin(client: Client, _options: unknown, auth: Profile) {
    const prior = sessions.get(auth.id);
    const previous = prior?.room.players.get(auth.id);
    sessions.set(auth.id, { room: this, sessionId: client.sessionId });
    if (prior) {
      const old = prior.room.players.get(auth.id);
      if (old) old.client.leave(4001);
      await prior.room.serial;
    }
    const profile = await getProfile(auth.id);
    if (sessions.get(auth.id)?.sessionId !== client.sessionId)
      throw new Error("Session replaced by a newer connection.");
    const player: Player = {
      client,
      profile,
      ...WORLD.spawn,
      yaw: 0,
      dx: 0,
      dz: 0,
      sprint: false,
      inputAt: 0,
      online: true,
      cooldowns: new Map(previous?.cooldowns ?? []),
      petCooldowns: new Map(
        [...(previous?.petCooldowns ?? [])].map(([id, cooldowns]) => [
          id,
          { ...cooldowns },
        ]),
      ),
      petSwapUntil: previous?.petSwapUntil,
      guardUntil: 0,
      slowUntil: 0,
      stunUntil: 0,
      combatUntil: 0,
      bait: false,
      emote: "",
      emoteUntil: 0,
      duelHp: 0,
      duelMax: 0,
      lastUse: 0,
      resource: previous?.resource ?? 0,
      resourceAt: Date.now(),
      combo: 0,
      gcdUntil: 0,
      lastCast: 0,
      auras: new Map(),
      hpDirty: false,
      hpSavedAt: 0,
      regenAt: 0,
    };
    if (!previous) player.resource = this.startResource(player);
    this.players.set(profile.id, player);
    safeSend(client, "profile", profile);
    safeSend(client, "world", this.nearbySnapshot(profile.id));
    safeSend(client, "event", {
      type: "welcome",
      message: `Welcome to ${BRAND.island}, ${profile.nickname}. Your expedition is saved automatically.`,
    });
  }
  onDrop(client: Client) {
    const p = [...this.players.values()].find(
      (player) => player.client.sessionId === client.sessionId,
    );
    if (!p) return;
    p.online = false;
    p.dx = 0;
    p.dz = 0;
    this.queue = this.queue.filter((id) => id !== p.profile.id);
    if (isCurrent(p, this))
      void this.allowReconnection(client, 20).catch(() => {});
  }
  onReconnect(client: Client) {
    const p = [...this.players.values()].find(
      (player) => player.client.sessionId === client.sessionId,
    );
    if (!p || !isCurrent(p, this)) {
      client.leave(4001);
      return;
    }
    p.client = client;
    p.online = true;
    p.inputAt = 0;
    safeSend(client, "profile", p.profile);
    safeSend(client, "world", this.nearbySnapshot(p.profile.id));
  }
  async onLeave(client: Client) {
    const p = [...this.players.values()].find(
      (player) => player.client.sessionId === client.sessionId,
    );
    if (!p) return;
    p.online = false;
    p.dx = 0;
    p.dz = 0;
    this.queue = this.queue.filter((id) => id !== p.profile.id);
    this.serial = this.serial
      .then(async () => {
        await this.saveHp(p).catch((error) =>
          console.error("Health save failed", error),
        );
        if (p.duelId) {
          const duel = this.duels.get(p.duelId);
          if (duel?.state === "active")
            await this.finishDuel(
              duel,
              duel.a === p.profile.id ? duel.b : duel.a,
              "disconnect",
            );
          else if (duel) this.cancelDuel(duel);
        }
        if (this.players.get(p.profile.id) === p)
          this.players.delete(p.profile.id);
        if (isCurrent(p, this)) sessions.delete(p.profile.id);
        this.commandLimit.remove(client.sessionId);
        this.movementLimit.remove(client.sessionId);
      })
      .catch((error) => console.error("Departure persistence failed", error));
    await this.serial;
  }
  async onDispose() {
    IslandRoom.rooms.delete(this);
    await this.serial;
    for (const p of this.players.values())
      if (isCurrent(p, this)) sessions.delete(p.profile.id);
  }
  private sendError(client: Client, error: unknown) {
    const message = error instanceof Error ? error.message : "Action failed.";
    if (error && typeof error === "object" && "code" in error) {
      console.error("Database action failed", error);
      safeSend(client, "error", {
        message:
          "Saving is temporarily unavailable. Please retry; your last saved progress is safe.",
      });
    } else safeSend(client, "error", { message });
  }
  private event(event: GameEvent, p?: Player) {
    if (p) safeSend(p.client, "event", event);
    else this.broadcast("event", event);
  }
  private async update(
    p: Player,
    request: string,
    action: Parameters<typeof mutate>[2],
    publish = true,
  ) {
    const healthChanged = p.hpDirty;
    const result = await mutate(p.profile.id, request, (profile, tx) => {
      this.carryHp(p, profile);
      return action(profile, tx);
    });
    if (result.applied) p.hpDirty = false;
    p.profile = result.profile;
    if (p.online && (publish || healthChanged || !result.applied))
      safeSend(p.client, "profile", p.profile);
    return result.applied;
  }
  /** Hero health changes in memory during combat and is saved in batches. */
  private carryHp(p: Player | undefined, profile: Profile) {
    if (!p?.hpDirty) return;
    profile.heroHp = heroHp(p.profile);
    if (p.profile.pokedex)
      for (const species of p.profile.pokedex.seen)
        recordPokemon(profile, species);
    const byId = new Map(p.profile.creatures.map((c) => [c.id, c]));
    for (const creature of profile.creatures) {
      const current = byId.get(creature.id);
      if (current) creature.hp = Math.min(creature.maxHp, current.hp);
    }
  }
  private async saveHp(p: Player) {
    if (!p.hpDirty) return;
    p.hpSavedAt = Date.now();
    await this.update(p, `health:${p.profile.id}:${randomUUID()}`, () => {});
  }
  private setHeroHp(p: Player, value: number) {
    p.profile.heroHp = Math.round(
      Math.max(0, Math.min(heroMaxHp(p.profile), value)),
    );
    p.hpDirty = true;
  }
  private combatLevel(p: Player) {
    return heroCombatLevel(
      p.profile,
      this.duels.get(p.duelId ?? "")?.state === "active",
    );
  }
  private startResource(p: Player) {
    return resourceStart(
      heroClass(p.profile.classId).resource,
      this.combatLevel(p),
    );
  }
  private maxResource(p: Player) {
    return resourceMax(
      heroClass(p.profile.classId).resource,
      this.combatLevel(p),
    );
  }
  private gainResource(p: Player, amount: number) {
    p.resource = Math.max(
      0,
      Math.min(this.maxResource(p), p.resource + amount),
    );
  }
  private nearbySnapshot(id: string) {
    const snapshot = this.snapshot(),
      p = this.players.get(id);
    return p
      ? {
          ...snapshot,
          wilds: snapshot.wilds.filter((w) => distance(p, w) < 100),
        }
      : snapshot;
  }
  private snapshot(): WorldSnapshot {
    return {
      time: Date.now(),
      conditions: worldConditions(Date.now()),
      roomId: this.roomId,
      queue: [...this.queue],
      players: [...this.players.values()].map((p) => {
        const c = p.profile.creatures.find((c) => c.id === p.profile.active);
        return {
          practice: p.practice,
          id: p.profile.id,
          nickname: p.profile.nickname,
          classId: p.profile.classId,
          appearance: normalizeAppearance(p.profile.appearance),
          companionName: c ? c.nickname || SPECIES[c.species].name : undefined,
          petMode: p.petMode ?? "assist",
          petTarget: p.petTarget,
          pet:
            p.pet && c
              ? {
                  x: p.pet.x,
                  z: p.pet.z,
                  yaw: p.pet.yaw,
                  moving: p.pet.moving,
                  hp: c.hp,
                  maxHp: c.maxHp,
                  cooldowns: p.pet.cooldowns,
                  cast: p.pet.cast,
                  shiny: c.shiny,
                }
              : undefined,
          cast: p.cast,
          dash: p.dash,
          x: p.x,
          z: p.z,
          yaw: p.yaw,
          moving:
            p.online &&
            Date.now() - p.inputAt < 300 &&
            Math.hypot(p.dx, p.dz) > 0.1,
          companion: c?.species ?? null,
          companionLevel: c?.level ?? 0,
          companionEvolved: c?.evolved ?? false,
          hp:
            p.duelId && this.duels.get(p.duelId)?.state === "active"
              ? p.duelHp
              : heroHp(p.profile),
          maxHp:
            p.duelId && this.duels.get(p.duelId)?.state === "active"
              ? p.duelMax
              : heroMaxHp(p.profile),
          emote: p.emoteUntil > Date.now() ? p.emote : undefined,
          duelId: p.duelId,
          cooldowns: Object.fromEntries(
            [...p.cooldowns].filter(([, until]) => until > Date.now()),
          ),
          guardUntil: p.guardUntil,
          stunUntil: p.stunUntil,
          slowUntil: p.slowUntil,
          level: this.combatLevel(p),
          resource: Math.floor(p.resource),
          resourceMax: this.maxResource(p),
          combo: p.combo,
          gcdUntil: p.gcdUntil,
          autoTarget: p.auto?.target,
          swingAt: p.auto?.next,
          inCombat: p.combatUntil > Date.now(),
          auras: auraViews(p, Date.now()),
        } satisfies PlayerView;
      }),
      wilds: [...this.wilds.values()].map((w) => ({
        id: w.id,
        species: w.species,
        shiny: w.shiny,
        activity: w.activity,
        x: w.x,
        z: w.z,
        level: w.level,
        hp: w.hp,
        maxHp: w.maxHp,
        state: w.state,
        elite: w.elite,
        boss: w.boss,
        phase: w.phase,
        target: w.target,
        respawnAt: w.respawnAt,
        cast: w.cast,
        auras: w.hp > 0 ? auraViews(w, Date.now()) : undefined,
        threat: w.threat.size ? threatShares(w.threat) : undefined,
        evading: w.resetting || undefined,
      })),
      duels: [...this.duels.values()].map(
        ({ finishing: _finishing, reason: _reason, ...d }) => d,
      ),
    };
  }
  private async command(p: Player, c: Exclude<ValidCommand, { kind: "move" }>) {
    if (c.kind === "dexReward") {
      const reward = DEX_REWARDS.find((reward) => reward.count === c.count);
      await this.update(p, c.requestId, async (profile, tx) => {
        if (
          !reward ||
          !profile.pokedex ||
          profile.pokedex.caught.length < reward.count ||
          profile.pokedex.rewards.includes(reward.count)
        )
          throw new Error("That Pokédex reward is not available.");
        await tx.credit(
          profile,
          reward.amount,
          "Pokédex completion",
          `dex:${reward.count}`,
        );
        profile.pokedex.rewards.push(reward.count);
      });
      return;
    }
    if (c.kind === "petMove") {
      const creature = activeCreature(p.profile),
        move = POKEMON_MOVES[creature.moves[c.slot]];
      if (!move || creature.hp <= 0 || heroHp(p.profile) <= 0 || p.duelId)
        throw new Error("Your companion cannot use that move now.");
      const target = this.wilds.get(c.target ?? p.petTarget ?? "");
      if (
        move.shape !== "self" &&
        (!target ||
          target.hp <= 0 ||
          distance(p, target) > 24 ||
          !lineOfSight(p, target))
      )
        throw new Error("Select a nearby living target.");
      if (isSafeArea(p.x, p.z) && !isTraining(target))
        throw new Error("Leave the sanctuary to battle.");
      p.pet ??= deployCompanion(p, creature.id);
      if ((p.pet.cooldowns[move.id] ?? 0) > Date.now())
        throw new Error("That companion move is cooling down.");
      if (!(await this.update(p, c.requestId, () => {}, false))) return;
      p.pet.command = { slot: c.slot, target: target?.id ?? p.profile.id };
      if (target) p.petTarget = target.id;
      return;
    }
    if (c.kind === "swap") {
      if (
        p.duelId ||
        heroHp(p.profile) <= 0 ||
        (p.petSwapUntil ?? 0) > Date.now()
      )
        throw new Error("Wait before swapping companions.");
      const id = p.profile.team[c.slot],
        creature = p.profile.creatures.find((creature) => creature.id === id);
      if (!creature || creature.hp <= 0)
        throw new Error("Choose a healthy teammate.");
      if (
        !(await this.update(p, c.requestId, (profile) => {
          profile.active = id;
        }))
      )
        return;
      p.pet = deployCompanion(p, id);
      p.pet.nextAction = Date.now() + 1200;
      p.petSwapUntil = Date.now() + 10000;
      this.event({
        type: "pet-swap",
        source: p.profile.id,
        actor: "companion",
        message: `${creature.nickname || SPECIES[creature.species].name}, let's go!`,
      });
      return;
    }
    if (c.kind === "learn") {
      requirePeace(p);
      await this.update(p, c.requestId, (profile) => {
        const creature = profile.creatures.find(
          (creature) => creature.id === c.creature,
        );
        if (
          !creature ||
          c.slot >= creature.moves.length ||
          !availableMoves(creature.species, creature.level).includes(c.move) ||
          creature.moves.includes(c.move)
        )
          throw new Error("Choose a learned, unequipped move.");
        creature.moves[c.slot] = c.move;
      });
      return;
    }
    const now = Date.now();
    if (c.kind === "dash") {
      const duel = this.duels.get(p.duelId ?? "");
      if (
        !p.profile.creatures.length ||
        (duel?.state === "active" ? p.duelHp : heroHp(p.profile)) <= 0 ||
        p.stunUntil > now ||
        (p.cooldowns.get("dash") ?? 0) > now
      )
        throw new Error("Dash is not ready.");
      if (duel && duel.state !== "active")
        throw new Error("Resolve your duel first.");
      const magnitude = Math.hypot(c.dx, c.dz);
      if (!(await this.update(p, c.requestId, () => {}, false))) return;
      this.cancelCast(p);
      p.dash = {
        x: magnitude > 0.1 ? c.dx / magnitude : Math.sin(p.yaw),
        z: magnitude > 0.1 ? c.dz / magnitude : Math.cos(p.yaw),
        startedAt: now,
        until: now + DASH.duration,
      };
      p.cooldowns.set("dash", now + DASH.cooldown);
      this.event({ type: "dash", source: p.profile.id, message: "Dash" });
      return;
    }
    if (c.kind === "pet") {
      if (p.duelId)
        throw new Error("Companion orders are unavailable during duels.");
      if (activeCreature(p.profile).hp <= 0)
        throw new Error("Heal your companion first.");
      if (c.mode === "attack") {
        const target = this.wilds.get(c.target ?? "");
        if (
          !target ||
          target.hp <= 0 ||
          distance(p, target) > 24 ||
          !lineOfSight(p, target) ||
          (isSafeArea(p.x, p.z) && !isTraining(target)) ||
          heroHp(p.profile) <= 0
        )
          throw new Error(
            "Select a living target within 24m outside a sanctuary.",
          );
        p.petTarget = target.id;
      } else {
        p.petMode = c.mode;
        if (c.mode === "passive") {
          p.petTarget = undefined;
          if (p.pet) {
            p.pet.command = undefined;
            if (!p.pet.cast?.released) p.pet.cast = undefined;
          }
        }
      }
      return;
    }
    if (c.kind === "travel") {
      requirePeace(p);
      if (!WAYSTONES.some((w) => distance(p, w) < 10))
        throw new Error("Visit a waystone to travel.");
      const destination = WAYSTONES.find((w) => w.id === c.destination);
      if (!destination || !p.profile.waystones?.includes(destination.id))
        throw new Error("Discover that waystone first.");
      p.x = destination.x;
      p.z = destination.z;
      p.dx = 0;
      p.dz = 0;
      p.petTarget = undefined;
      this.event(
        { type: "travel", message: `Arrived at ${destination.name}.` },
        p,
      );
      return;
    }
    if (c.kind === "attack") {
      await this.attack(p, c.target, c.slot, c.requestId);
      return;
    }
    if (c.kind === "practiceReset") {
      resetPractice(p, this.wilds);
      return;
    }
    if (c.kind === "autoattack") {
      if (!c.target) p.auto = undefined;
      else this.startAuto(p, c.target, true);
      return;
    }
    if (c.kind === "tame") {
      await this.tame(p, c.target, c.item, c.requestId);
      return;
    }
    if (c.kind === "duel") {
      await this.invite(p, c.target, c.requestId);
      return;
    }
    if (
      c.kind === "duelAccept" ||
      c.kind === "duelReject" ||
      c.kind === "duelCancel"
    ) {
      await this.respondDuel(p, c);
      return;
    }
    if (c.kind === "surrender") {
      const duel = this.duels.get(p.duelId ?? "");
      if (!duel || duel.state !== "active")
        throw new Error("You are not in a duel.");
      await this.finishDuel(
        duel,
        duel.a === p.profile.id ? duel.b : duel.a,
        "surrender",
      );
      return;
    }
    if (c.kind === "queue") {
      if (!c.join) {
        this.queue = this.queue.filter((id) => id !== p.profile.id);
        return;
      }
      requirePeace(p);
      requirePlace(p, "arena", 18);
      activeCreature(p.profile);
      this.queue = this.queue.filter((id) => id !== p.profile.id);
      if (c.join) this.queue.push(p.profile.id);
      await this.matchQueue();
      return;
    }
    if (c.kind === "emote") {
      p.emote = c.value;
      p.emoteUntil = now + 3500;
      return;
    }
    if (c.kind === "interact") {
      const place = requirePlace(p, c.place, interactionRadius(c.place));
      if (hasStoryInteraction(p.profile, place.id))
        await this.update(p, c.requestId, (profile) =>
          inspectStoryPlace(profile, place.id),
        );
      this.event(
        { type: "interact", message: place.description, target: place.id },
        p,
      );
      return;
    }
    if (p.duelId) throw new Error("Your loadout is locked during a duel.");
    let itemEffect = "";
    if (c.kind === "starter") {
      if (!STARTERS.includes(c.species))
        throw new Error("Choose one of the three starters.");
    }
    if (c.kind === "class" || c.kind === "appearance") {
      requirePeace(p);
      if (biomeAt(p.x, p.z) !== "town")
        throw new Error("Return to Hearthwick to change your character.");
    }
    if (c.kind === "buy") requirePlace(p, "shop");
    if (c.kind === "heal") {
      requirePlace(p, "heal");
      requirePeace(p);
    }
    if (c.kind === "evolve") {
      const creature = p.profile.creatures.find(
        (creature) => creature.id === c.id,
      );
      if (
        !POKEMON[creature?.species ?? ""]?.evolutions.some(
          (rule) => rule.location,
        )
      )
        requirePlace(p, "stable");
      requirePeace(p);
    }
    if (c.kind === "team") {
      requirePlace(p, "stable");
      requirePeace(p);
    }
    if (c.kind === "deploy") requirePeace(p);
    if (c.kind === "use" && now - p.lastUse < 1000)
      throw new Error("Wait a moment before using another item.");
    let evolutionResult: GameEvent["evolution"];
    const applied = await this.update(p, c.requestId, async (profile, tx) => {
      switch (c.kind) {
        case "appearance":
          profile.appearance = normalizeAppearance(c.appearance);
          if (c.nickname) profile.nickname = c.nickname;
          break;
        case "renamePet": {
          const pet = profile.creatures.find((pet) => pet.id === c.creature);
          if (!pet) throw new Error("That Pokémon is not in your collection.");
          pet.nickname = c.nickname;
          break;
        }
        case "class":
          profile.classId = c.classId;
          if (c.appearance)
            profile.appearance = normalizeAppearance(c.appearance);
          break;
        case "starter": {
          profile.classId = c.classId ?? "knight";
          profile.appearance = normalizeAppearance(c.appearance);
          profile.heroHp = heroMaxHp(profile);
          if (profile.creatures.length)
            throw new Error("You already have a companion.");
          const creature = makeCreature(c.species);
          profile.creatures.push(creature);
          recordPokemon(profile, creature.species, true);
          profile.team = [creature.id];
          profile.active = creature.id;
          increment(profile, "starter");
          break;
        }
        case "buy":
          await purchase(profile, tx, c.item, c.quantity, c.requestId);
          break;
        case "heal":
          profile.heroHp = heroMaxHp(profile);
          for (const creature of profile.creatures)
            creature.hp = creature.maxHp;
          break;
        case "team":
          if (
            new Set(c.ids).size !== c.ids.length ||
            c.ids.some(
              (id) => !profile.creatures.some((creature) => creature.id === id),
            )
          )
            throw new Error("Choose creatures from your collection once each.");
          profile.team = c.ids;
          if (!c.ids.includes(profile.active ?? ""))
            profile.active = c.ids[0] ?? null;
          break;
        case "deploy":
          if (c.id !== null && !profile.team.includes(c.id))
            throw new Error("That creature is not in your team.");
          profile.active = c.id;
          break;
        case "evolve": {
          evolutionResult = await evolvePokemon(
            profile,
            c.id,
            c.species,
            biomeAt(p.x, p.z),
            tx,
          );
          break;
        }
        case "acceptQuest":
          acceptQuest(profile, c.quest, p);
          break;
        case "claim":
          await claimQuest(profile, tx, c.quest, p);
          break;
        case "use":
          itemEffect = useItem(profile, c.item, p.combatUntil > now);
          break;
      }
    });
    if (!applied) return;
    if (evolutionResult)
      this.event({
        type: "evolution",
        source: p.profile.id,
        evolution: evolutionResult,
        message: `${POKEMON[evolutionResult.to].name} evolved!`,
      });
    if (c.kind === "use") {
      p.lastUse = now;
      if (itemEffect === "bait") p.bait = true;
      if (itemEffect === "cleanse") {
        p.slowUntil = 0;
        p.stunUntil = 0;
        for (const id of ["slow", "stun", "burn", "poison"] as const)
          p.auras.delete(id);
      }
    }
    if (c.kind === "heal") clearAuras(p);
    if (c.kind === "heal" || c.kind === "class" || c.kind === "starter") {
      p.resource = this.startResource(p);
      p.combo = 0;
      p.auto = undefined;
    }
    const messages: Record<string, string> = {
      starter: "Your first companion is ready. The meadow is just beyond town.",
      buy: "Supplies packed. Your balance has been saved.",
      heal: "Your entire collection is rested and ready.",
      team: "Your expedition team has been updated.",
      deploy: "Companion deployment updated.",
      acceptQuest: "Quest accepted. Your journal shows the next destination.",
      claim:
        c.kind === "claim"
          ? (QUESTS.find((q) => q.id === c.quest)?.completion ??
            `Quest complete. ${BRAND.currency} added to your expedition fund.`)
          : "Quest complete.",
      use: "Item used.",
    };
    if (evolutionResult) return;
    this.event(
      {
        type: c.kind === "claim" ? "reward" : c.kind,
        message:
          c.kind === "appearance"
            ? "Your new look is saved."
            : c.kind === "renamePet"
              ? "Your companion’s name is saved."
              : (messages[c.kind] ?? "Done."),
      },
      p,
    );
  }
  private async attack(
    p: Player,
    targetId: string,
    slot: number,
    requestId: string,
    companion = false,
  ) {
    const now = Date.now(),
      creature =
        p.profile.creatures.find((c) => c.id === p.profile.active) ??
        p.profile.creatures[0],
      ability = abilityFor(p.profile, slot, companion);
    if (!creature) throw new Error("Choose your starter first.");
    const duel = this.duels.get(p.duelId ?? "");
    if ((duel?.state === "active" ? p.duelHp : heroHp(p.profile)) <= 0)
      throw new Error("You need healing at the Springhouse.");
    if (p.stunUntil > now) throw new Error("You are briefly stunned.");
    if (companion) {
      const pet = p.pet,
        move = POKEMON_MOVES[ability.id],
        wild = this.wilds.get(targetId);
      if (
        !pet ||
        !move ||
        creature.hp <= 0 ||
        pet.cast ||
        pet.nextAction > now ||
        (pet.cooldowns[ability.id] ?? 0) > now ||
        p.duelId ||
        (isSafeArea(p.x, p.z) && !isTraining(wild))
      )
        return;
      if (
        move.shape !== "self" &&
        (!wild ||
          wild.hp <= 0 ||
          distance(pet, wild) > move.range ||
          !lineOfSight(pet, wild))
      )
        return;
      pet.cooldowns[ability.id] = now + ability.cooldown * 1000;
      const target = move.shape === "self" ? pet : wild!;
      pet.cast = {
        ability: ability.id,
        target: move.shape === "self" ? p.profile.id : targetId,
        startedAt: now,
        releasesAt: now + move.anticipation,
        resolvesAt:
          now +
          move.anticipation +
          (move.shape === "self" || move.shape === "melee"
            ? 0
            : (distance(pet, target) / move.travelSpeed) * 1000),
        x: pet.x,
        z: pet.z,
        aimX: target.x,
        aimZ: target.z,
      };
      pet.command = undefined;
      p.combatUntil = now + COMBAT_MS;
      this.event({
        type: "pet-cast",
        actor: "companion",
        source: p.profile.id,
        target: pet.cast.target,
        ability: ability.id,
        message: ability.name,
      });
      return;
    }
    const cls = heroClass(p.profile.classId),
      resourceName = RESOURCES[cls.resource].name;
    if (!abilityUnlocked(ability, this.combatLevel(p)))
      throw new Error(`${ability.name} unlocks at level ${ability.unlock}.`);
    const self = ["heal", "guard", "evasion"].includes(ability.effect ?? "");
    // Off-GCD abilities (defensives, taunts, interrupts) are instant and usable mid-cast.
    if (p.cast && !ability.offGcd)
      throw new Error("Finish your current attack first.");
    if (p.dash && p.dash.until > now)
      throw new Error("Finish your dash first.");
    if ((p.cooldowns.get(ability.id) ?? 0) > now)
      throw new Error("That ability is cooling down.");
    if (!ability.offGcd && p.gcdUntil - now > 150)
      throw new Error("Not ready yet.");
    if (p.resource < (ability.cost ?? 0))
      throw new Error(`Not enough ${resourceName}.`);
    if (ability.finisher && !p.combo)
      throw new Error("Build combo points first.");
    if (self) {
      if (
        ability.effect === "heal" &&
        heroHp(p.profile) >= heroMaxHp(p.profile) &&
        duel?.state !== "active"
      )
        throw new Error("You are already at full health.");
      let healed = 0;
      const applied = await this.update(p, requestId, (profile) => {
        if (ability.effect === "heal" && duel?.state !== "active") {
          const before = heroHp(profile);
          profile.heroHp = Math.min(
            heroMaxHp(profile),
            before + Math.ceil(heroMaxHp(profile) * 0.24),
          );
          healed = profile.heroHp - before;
        }
      });
      if (!applied) return;
      this.spend(p, ability, now);
      if (ability.effect === "guard") {
        this.cancelCast(p);
        applyAura(p, "guard", now, 4000, { ability: ability.id });
      }
      if (ability.effect === "evasion")
        applyAura(p, "evasion", now, EVASION_MS, { ability: ability.id });
      if (ability.effect === "heal" && duel?.state === "active") {
        const before = p.duelHp;
        p.duelHp = Math.min(p.duelMax, p.duelHp + Math.ceil(p.duelMax * 0.24));
        healed = p.duelHp - before;
      }
      if (healed)
        for (const wild of this.wilds.values())
          if (wild.threat.has(p.profile.id))
            this.addThreat(wild, p.profile.id, healed * 0.5);
      this.event({
        type: "attack",
        actor: "hero",
        message: ability.name,
        target: p.profile.id,
        source: p.profile.id,
        ability: ability.id,
        amount: healed,
        heal: ability.effect === "heal",
      });
      return;
    }
    if (duel?.state === "invite")
      throw new Error("Resolve your invitation first.");
    if (ability.aoeSelf) {
      if (
        !duel &&
        isSafeArea(p.x, p.z) &&
        ![...this.wilds.values()].some(
          (w) => isTraining(w) && distance(p, w) <= (ability.aoe ?? 0),
        )
      )
        throw new Error("Leave the sanctuary to battle.");
      targetId = p.profile.id;
    } else {
      const opponent =
        duel?.state === "active" ? this.players.get(targetId) : undefined;
      const wild = opponent ? undefined : this.wilds.get(targetId);
      if (
        duel?.state === "active" &&
        (!opponent ||
          (duel.a !== targetId && duel.b !== targetId) ||
          targetId === p.profile.id)
      )
        throw new Error("Target your duel opponent.");
      if (!opponent && (!wild || wild.hp <= 0))
        throw new Error("Select a living wild creature.");
      if (ability.effect === "taunt" && !wild)
        throw new Error("Only creatures can be taunted.");
      const target = opponent ?? wild!;
      if (distance(p, target) > ability.range)
        throw new Error("Move closer to use that ability.");
      if (!lineOfSight(p, target))
        throw new Error("An obstacle blocks this attack.");
      if (wild && !isTraining(wild) && isSafeArea(p.x, p.z))
        throw new Error("Leave the sanctuary to battle.");
      const health = opponent
        ? opponent.duelHp / opponent.duelMax
        : wild!.hp / wild!.maxHp;
      if (ability.execute && health > ability.execute)
        throw new Error(
          `The target must be below ${ability.execute * 100}% health.`,
        );
    }
    if (!(await this.update(p, requestId, () => {}, false))) return;
    const combo = ability.finisher ? p.combo : 0;
    if (ability.finisher) p.combo = 0;
    this.spend(p, ability, now);
    p.combatUntil = now + COMBAT_MS;
    const target = ability.aoeSelf
      ? p
      : (this.wilds.get(targetId) ?? this.players.get(targetId)!);
    if (!ability.aoeSelf) {
      p.yaw = Math.atan2(target.x - p.x, target.z - p.z);
      if (ability.range <= 6) this.startAuto(p, targetId);
    }
    const timing = castTiming(ability.id, distance(p, target));
    this.event({
      type: "cast",
      actor: "hero",
      source: p.profile.id,
      target: targetId,
      ability: ability.id,
      message: ability.name,
    });
    if (!timing.windup && !timing.flight && ability.offGcd) {
      await this.impactAttack(p, targetId, ability, false, combo);
      return;
    }
    p.cast = {
      ability: ability.id,
      target: targetId,
      startedAt: now,
      releasesAt: now + timing.windup,
      resolvesAt: now + timing.windup + timing.flight,
      x: p.x,
      z: p.z,
      aimX: target.x,
      aimZ: target.z,
      cost: ability.cost,
      combo,
    };
  }
  /** Pay an ability's resource, cooldown and global cooldown. */
  private spend(p: Player, ability: Ability, now: number) {
    p.resource -= ability.cost ?? 0;
    p.cooldowns.set(ability.id, now + ability.cooldown * 1000);
    if (!ability.offGcd) p.gcdUntil = Math.max(now, p.gcdUntil) + GCD_MS;
    if (heroClass(p.profile.classId).resource === "mana" && ability.cost)
      p.lastCast = now;
  }
  private cancelCast(p: Player) {
    if (!p.cast || p.cast.released) return;
    const { ability, cost, combo } = p.cast;
    p.cast = undefined;
    p.cooldowns.set(ability, Date.now() + 350);
    this.gainResource(p, cost ?? 0);
    if (combo) p.combo = combo;
    this.event({
      type: "cast-cancel",
      source: p.profile.id,
      ability,
      message: "Cast interrupted",
    });
  }
  private async advanceCast(p: Player, now: number) {
    const cast = p.cast;
    if (!cast) return;
    const duel = this.duels.get(p.duelId ?? "");
    if (
      (duel?.state === "active" ? p.duelHp : heroHp(p.profile)) <= 0 ||
      (!duel &&
        isSafeArea(p.x, p.z) &&
        !isTraining(this.wilds.get(cast.target)) &&
        !ABILITIES[cast.ability].aoeSelf)
    ) {
      p.cast = undefined;
      return;
    }
    if (castInterrupted(cast, p, p.stunUntil > now, now)) {
      this.cancelCast(p);
      return;
    }
    const ability = ABILITIES[cast.ability];
    const target = ability.aoeSelf
      ? p
      : (this.wilds.get(cast.target) ?? this.players.get(cast.target));
    if (!cast.released && now >= cast.releasesAt) {
      if (
        !target ||
        distance(p, target) > ability.range + 0.75 ||
        !lineOfSight(p, target)
      ) {
        this.cancelCast(p);
        return;
      }
      cast.released = true;
      cast.aimX = target.x;
      cast.aimZ = target.z;
      this.event({
        type: "attack",
        actor: "hero",
        source: p.profile.id,
        target: cast.target,
        ability: cast.ability,
        x: cast.aimX,
        z: cast.aimZ,
        message: ability.name,
      });
    }
    if (now < cast.resolvesAt) return;
    p.cast = undefined;
    if (ability.aoe && !p.duelId) {
      const center = ability.aoeSelf ? p : { x: cast.aimX, z: cast.aimZ };
      for (const wild of this.wilds.values()) {
        if (
          wild.hp <= 0 ||
          (SPECIES[wild.species].companion &&
            wild.id !== cast.target &&
            !wild.threat.has(p.profile.id))
        )
          continue;
        if (
          distance(wild, center) <= ability.aoe &&
          distance(p, wild) <= ability.range + ability.aoe &&
          lineOfSight(p, wild)
        )
          await this.impactAttack(p, wild.id, ability, false, cast.combo);
      }
    } else if (ability.aoeSelf) {
      const opponent = this.duelOpponent(p);
      if (opponent && distance(p, opponent) <= (ability.aoe ?? 0))
        await this.impactAttack(p, opponent.profile.id, ability, false);
    } else await this.impactAttack(p, cast.target, ability, false, cast.combo);
  }
  private duelOpponent(p: Player) {
    const duel = this.duels.get(p.duelId ?? "");
    if (duel?.state !== "active") return undefined;
    return this.players.get(duel.a === p.profile.id ? duel.b : duel.a);
  }
  /** Begin or retarget automatic weapon swings. */
  private startAuto(p: Player, targetId: string, explicit = false) {
    const target =
      this.wilds.get(targetId) ??
      (this.duelOpponent(p)?.profile.id === targetId
        ? this.duelOpponent(p)
        : undefined);
    if (!target || ("hp" in target && target.hp <= 0))
      if (explicit) throw new Error("Select a living enemy to attack.");
      else return;
    if (!p.duelId && isSafeArea(p.x, p.z) && !isTraining(target)) {
      if (explicit) throw new Error("Leave the sanctuary to battle.");
      return;
    }
    // Abilities never start swings on wild Pokémon, so they are not knocked out by accident.
    if (!explicit && "species" in target && SPECIES[target.species].companion)
      return;
    p.auto = {
      target: targetId,
      next: Math.max(p.auto?.next ?? 0, Date.now() + 120),
    };
  }
  private addThreat(w: Wild, id: string, amount: number) {
    w.threat.set(id, (w.threat.get(id) ?? 0) + Math.max(0, amount));
  }
  /** Hit, miss and critical rolls for a hero attacking a creature or duel opponent. */
  private heroChances(
    p: Player,
    ability: Ability | undefined,
    wild: Wild | undefined,
    opponent: Player | undefined,
    companion: boolean,
  ): HitChances {
    const cls = heroClass(p.profile.classId);
    if (companion)
      return {
        miss: 1 - (POKEMON_MOVES[ability?.id ?? ""]?.accuracy ?? 0.96),
        dodge: 0,
        parry: 0,
        block: 0,
        crit: 0.05,
      };
    if (isTraining(wild))
      return {
        miss: 0,
        dodge: 0,
        parry: 0,
        block: 0,
        crit: cls.crit + (ability?.crit ?? 0),
      };
    if (wild)
      return heroAttackChances(cls, ability, heroLevel(p.profile), wild.level);
    const defender = heroClass(opponent?.profile.classId);
    const melee = !ability || !isSpell(ability);
    return {
      miss: 0.04,
      dodge:
        (melee ? defender.dodge : 0) +
        (opponent && hasAura(opponent, "evasion", Date.now()) ? 0.5 : 0),
      parry: melee ? defender.parry : 0,
      block: defender.block,
      crit: cls.crit + (ability?.crit ?? 0),
    };
  }
  private async impactAttack(
    p: Player,
    targetId: string,
    ability: Ability,
    companion: boolean,
    combo = 0,
  ) {
    const now = Date.now(),
      duel = this.duels.get(p.duelId ?? "");
    const creature =
      p.profile.creatures.find((c) => c.id === p.profile.active) ??
      p.profile.creatures[0];
    const opponent =
      duel?.state === "active" &&
      targetId !== p.profile.id &&
      [duel.a, duel.b].includes(targetId)
        ? this.players.get(targetId)
        : undefined;
    const wild = p.duelId ? undefined : this.wilds.get(targetId);
    if (!creature || (!opponent && (!wild || wild.hp <= 0))) return;
    if (wild && !isTraining(wild) && isSafeArea(p.x, p.z)) return;
    const target = opponent ?? wild!;
    if (
      !lineOfSight(companion && p.pet ? p.pet : p, target) ||
      (opponent && (!opponent.online || opponent.duelHp <= 0))
    )
      return;
    const report = (outcome: Outcome, amount = 0) =>
      this.event({
        type: "impact",
        actor: companion ? "companion" : "hero",
        message: `${ability.name} · ${amount || outcome}`,
        source: p.profile.id,
        target: targetId,
        amount,
        ability: ability.id,
        outcome,
      });
    p.combatUntil = now + COMBAT_MS;
    if (opponent?.dash && now - opponent.dash.startedAt < DASH.invulnerable)
      return report("dodge");
    if (wild?.resetting) return report("evade");
    const cls = heroClass(p.profile.classId);
    const outcome = rollOutcome(
      this.heroChances(p, ability, wild, opponent, companion),
    );
    if (wild && !companion) this.addThreat(wild, p.profile.id, 1);
    if (!landed(outcome)) return report(outcome);
    const targetSpecies = opponent
      ? activeCreature(opponent.profile).species
      : wild!.species;
    const level = opponent
      ? DUEL_LEVEL
      : companion
        ? creature.level
        : heroLevel(p.profile);
    const base =
      (ability.power +
        (ability.finisher ?? 0) * combo +
        SPECIES[creature.species].power * 0.4 +
        level * 2) *
      (companion ? 0.45 : 1) *
      (opponent ? 1 : creature.evolved ? 1.2 : 1);
    const shattered =
      ability.shatter && (target.slowUntil > now || target.stunUntil > now);
    const matchup = isTraining(wild)
      ? 1
      : effectiveness(
          ability.element,
          SPECIES[targetSpecies].element,
          POKEMON[targetSpecies]?.types,
        );
    if (!companion && !matchup) return report("evade");
    let damage = Math.max(
      1,
      Math.round(
        base *
          matchup *
          outcomeScale(outcome, isSpell(ability)) *
          variance() *
          (shattered ? 3 : 1) *
          (!companion && hasAura(p, "enrage", now) ? 1.2 : 1),
      ),
    );
    const move = companion ? POKEMON_MOVES[ability.id] : undefined;
    if (move && POKEMON[creature.species]) {
      const attackStats = pokemonStats(
        creature.species,
        creature.level,
        creature.ivs,
        creature.nature,
      );
      const defenseStats = POKEMON[targetSpecies]
        ? pokemonStats(targetSpecies, wild?.level ?? 10)
        : {
            defense: 20 + (wild?.level ?? 1) * 4,
            specialDefense: 20 + (wild?.level ?? 1) * 4,
          };
      damage = pokemonDamage({
        level,
        power: move.power,
        attack:
          move.category === "physical"
            ? attackStats.attack
            : attackStats.specialAttack,
        defense:
          move.category === "physical"
            ? defenseStats.defense
            : defenseStats.specialDefense,
        type: move.type,
        attackerTypes: POKEMON[creature.species].types,
        defenderTypes: isTraining(wild)
          ? []
          : (POKEMON[targetSpecies]?.types ?? [
              LEGACY_TYPES[SPECIES[targetSpecies].element],
            ]),
        critical: outcome === "crit",
        random: Math.random(),
      });
      if (
        typeMultiplier(
          move.type,
          isTraining(wild)
            ? []
            : (POKEMON[targetSpecies]?.types ?? [
                LEGACY_TYPES[SPECIES[targetSpecies].element],
              ]),
        ) === 0
      )
        return report("evade");
    }
    if (target.guardUntil > now)
      damage = Math.max(damage > 0 ? 1 : 0, Math.round(damage * 0.35));
    this.dealDamage(
      p,
      target,
      damage,
      companion ? 0.5 : cls.threat,
      ability.id,
    );
    if (companion && ability.effect === "heal" && creature.hp > 0) {
      creature.hp = Math.min(
        creature.maxHp,
        creature.hp + Math.round(damage * 0.5),
      );
      p.hpDirty = true;
    }
    if (!companion) {
      this.gainResource(p, ability.generate ?? 0);
      if (ability.combo) p.combo = Math.min(COMBO_MAX, p.combo + ability.combo);
      if (outcome === "crit" && cls.resource === "rage")
        applyAura(p, "enrage", now, ENRAGE_MS, { ability: "enrage" });
    }
    if (wild && !companion && (p.petMode ?? "assist") === "assist")
      p.petTarget = targetId;
    if (ability.effect === "slow")
      applyAura(target, "slow", now, 3500, {
        ability: ability.id,
        source: p.profile.id,
      });
    if (ability.effect === "burn" || ability.effect === "poison") {
      const seconds = (ability.effect === "poison" ? DOT_MS : 4000) / 1000;
      applyAura(target, ability.effect, now, seconds * 1000, {
        ability: ability.id,
        source: p.profile.id,
        tick: Math.max(
          1,
          Math.round(
            (base * (ability.effect === "poison" ? 1 : 0.5)) / seconds,
          ),
        ),
      });
    }
    if (ability.effect === "taunt" && wild) {
      wild.threat.set(
        p.profile.id,
        Math.max(...wild.threat.values(), 0) * 1.1 + 10,
      );
      wild.tauntBy = p.profile.id;
      wild.tauntUntil = now + TAUNT_MS;
      wild.target = p.profile.id;
      applyAura(wild, "taunted", now, TAUNT_MS, {
        ability: ability.id,
        source: p.profile.id,
      });
    }
    const stun = ability.effect === "stun";
    if (stun)
      applyAura(target, "stun", now, 900, {
        ability: ability.id,
        source: p.profile.id,
      });
    if ((stun || ability.interrupt) && wild?.cast) {
      const interrupted = wild.cast;
      wild.cast = undefined;
      wild.castVictims = undefined;
      if (ability.interrupt) {
        wild.lockoutUntil = now + LOCKOUT_MS;
        wild.nextSpecial = Math.max(wild.nextSpecial, wild.lockoutUntil);
        applyAura(wild, "silenced", now, LOCKOUT_MS, {
          ability: ability.id,
          source: p.profile.id,
        });
      }
      this.event({
        type: "interrupt",
        source: p.profile.id,
        target: wild.id,
        ability: interrupted.ability,
        message: `Interrupted ${interrupted.name ?? "attack"}`,
      });
    }
    if ((stun || ability.interrupt) && opponent) this.cancelCast(opponent);
    report(outcome, damage);
    if (shattered)
      this.event({
        type: "shatter",
        source: p.profile.id,
        target: targetId,
        message: "Shatter",
      });
    await this.settleDamage(p, target);
  }
  /** Apply hero-caused damage to a creature or duel opponent. */
  private dealDamage(
    p: Player,
    target: Wild | Player,
    damage: number,
    threat: number,
    ability = "weapon",
  ) {
    const now = Date.now();
    if ("profile" in target) {
      target.duelHp = Math.max(0, target.duelHp - damage);
      target.combatUntil = now + COMBAT_MS;
      return;
    }
    if (isTraining(target)) {
      hitTrainingTarget(p, target, damage, ability, now);
      return;
    }
    target.hp = Math.max(0, target.hp - damage);
    target.contributors.set(
      p.profile.id,
      (target.contributors.get(p.profile.id) ?? 0) + damage,
    );
    this.addThreat(target, p.profile.id, damage * threat);
    if (target.state === "idle" || target.state === "roam")
      target.state = "chase";
  }
  private async settleDamage(p: Player, target: Wild | Player) {
    if ("profile" in target) {
      const duel = this.duels.get(p.duelId ?? "");
      if (duel && target.duelHp <= 0)
        await this.finishDuel(duel, p.profile.id, "defeat");
    } else if (target.hp <= 0 && target.state !== "defeat")
      await this.defeatWild(target);
  }
  /** Resolve one automatic weapon swing if the target is in reach. */
  private async swing(p: Player, now: number) {
    const auto = p.auto;
    if (!auto) return;
    const opponent = this.duelOpponent(p);
    const wild = p.duelId ? undefined : this.wilds.get(auto.target);
    const target = opponent?.profile.id === auto.target ? opponent : wild;
    if (
      !target ||
      ("species" in target ? target.hp <= 0 : target.duelHp <= 0) ||
      (!p.duelId && isSafeArea(p.x, p.z) && !isTraining(wild)) ||
      heroHp(p.profile) <= 0 ||
      (wild && weakenedPokemon(wild))
    ) {
      p.auto = undefined;
      return;
    }
    const cls = heroClass(p.profile.classId);
    if (
      now < auto.next ||
      p.stunUntil > now ||
      (p.dash && p.dash.until > now) ||
      (p.cast &&
        !p.cast.released &&
        castTiming(p.cast.ability, 0).stationary) ||
      distance(p, target) > cls.swing.range + (wild?.boss ? 1.5 : 0) ||
      !lineOfSight(p, target)
    )
      return;
    auto.next = now + cls.swing.speed;
    p.combatUntil = now + COMBAT_MS;
    const report = (outcome: Outcome, amount = 0) =>
      this.event({
        type: "swing",
        actor: "hero",
        auto: true,
        source: p.profile.id,
        target: auto.target,
        amount,
        outcome,
        message: cls.swing.name,
      });
    if (wild?.resetting) return report("evade");
    if (opponent?.dash && now - opponent.dash.startedAt < DASH.invulnerable)
      return report("dodge");
    if (wild) this.addThreat(wild, p.profile.id, 1);
    const outcome = rollOutcome(
      this.heroChances(p, undefined, wild, opponent, false),
    );
    if (!landed(outcome)) return report(outcome);
    let damage = Math.max(
      1,
      Math.round(
        swingDamage(cls, opponent ? DUEL_LEVEL : heroLevel(p.profile)) *
          outcomeScale(outcome, false) *
          (hasAura(p, "enrage", now) ? 1.2 : 1),
      ),
    );
    if (target.guardUntil > now)
      damage = Math.max(1, Math.round(damage * 0.35));
    this.dealDamage(p, target, damage, cls.threat);
    this.gainResource(p, resourceFromDealt(cls.resource, damage, true));
    if (outcome === "crit" && cls.resource === "rage")
      applyAura(p, "enrage", now, ENRAGE_MS, { ability: "enrage" });
    if (wild && (p.petMode ?? "assist") === "assist") p.petTarget = wild.id;
    report(outcome, damage);
    await this.settleDamage(p, target);
  }
  private async tame(
    p: Player,
    id: string,
    item: "capsule" | "prism",
    request: string,
  ) {
    if (p.duelId) throw new Error("Finish your duel first.");
    if (!p.profile.creatures.length)
      throw new Error("Choose your first Pokémon first.");
    const w = this.wilds.get(id),
      now = Date.now();
    if (!w || w.hp <= 0) throw new Error("Select a living wild creature.");
    if (!SPECIES[w.species].companion)
      throw new Error(
        "Hostile monsters cannot be captured. Look for wild Pokémon.",
      );
    const capturedBy = await captureOwner(w.encounter);
    if (capturedBy) {
      w.hp = 0;
      w.state = "defeat";
      w.respawnAt = now + encounterRespawnMs(w.boss, w.elite, true);
      w.target = undefined;
      w.rewardPending = false;
      if (capturedBy === p.profile.id) {
        await this.saveHp(p);
        p.profile = await getProfile(p.profile.id);
        safeSend(p.client, "profile", p.profile);
        this.event(
          {
            type: "capture",
            message: "Your taming result was recovered and saved.",
            target: w.id,
            source: p.profile.id,
          },
          p,
        );
        return;
      }
      throw new Error("This creature has already been tamed.");
    }
    if (w.boss)
      throw new Error(
        "The Stormheart guardian cannot be tamed. Its young kin can.",
      );
    if (distance(p, w) > 14 || !lineOfSight(p, w))
      throw new Error("Get closer with a clear view to tame.");
    if (heroHp(p.profile) <= 0) throw new Error("Heal your companion first.");
    if (now - p.lastUse < 1500)
      throw new Error("Wait for your last capsule to settle.");
    if (w.contributors.size && !w.contributors.has(p.profile.id))
      throw new Error("Help with this encounter before attempting to tame.");
    if (
      w.hp / w.maxHp > 0.75 &&
      !p.bait &&
      !(w.activity === "sleep" && Math.hypot(p.dx, p.dz) < 0.1)
    )
      throw new Error("Weaken this creature or use Sweetseed bait first.");
    const chance = captureChance(
      SPECIES[w.species].difficulty,
      w.hp,
      w.maxHp,
      ITEMS[item].value,
      w.slowUntil > now ||
        w.stunUntil > now ||
        (w.activity === "sleep" && Math.hypot(p.dx, p.dz) < 0.1),
      p.bait,
    );
    const success = tutorialCapture(p.profile) || Math.random() < chance;
    const caught = makeCreature(w.species, w.level);
    caught.shiny = w.shiny ?? false;
    const captureBiome = biomeAt(w.x, w.z);
    const applied = await this.update(p, request, async (profile, tx) => {
      consume(profile, item);
      if (success) {
        await tx.capture(w.encounter, profile.id, caught.id);
        profile.creatures.push(caught);
        recordPokemon(profile, caught.species, true);
        if (profile.team.length < 3) profile.team.push(caught.id);
        increment(profile, "captures");
        recordQuestEvent(profile, `research:${captureBiome}`, caught.species);
      }
    });
    if (!applied) return;
    p.lastUse = now;
    p.bait = false;
    if (success) {
      w.hp = 0;
      w.state = "defeat";
      w.respawnAt = now + encounterRespawnMs(w.boss, w.elite, true);
      w.target = undefined;
      w.rewardPending = false;
      this.event(
        {
          type: "capture",
          message: `${SPECIES[w.species].name} joined your collection!`,
          capture: {
            ...capturePresentation(true),
            species: w.species,
            shiny: w.shiny ?? false,
            creatureId: caught.id,
          },
          target: w.id,
          source: p.profile.id,
        },
        p,
      );
    } else {
      w.target = p.profile.id;
      w.state = "alert";
      p.combatUntil = now + 8000;
      this.event(
        {
          type: "capture-failed",
          capture: {
            ...capturePresentation(false),
            species: w.species,
            shiny: w.shiny ?? false,
          },
          message:
            "The creature slipped free. Weaken it further and try again.",
          target: w.id,
          source: p.profile.id,
        },
        p,
      );
    }
  }
  private async defeatWild(w: Wild) {
    if (isTraining(w)) return;
    this.resetCombat(w);
    w.cast = undefined;
    w.hp = 0;
    w.state = "defeat";
    w.target = undefined;
    w.rewardPending = true;
    w.respawnAt =
      Date.now() +
      encounterRespawnMs(w.boss, w.elite, !!SPECIES[w.species].companion);
    this.event({
      type: "defeat",
      message: `${w.boss ? "Stormheart" : SPECIES[w.species].name} defeated.`,
      target: w.id,
    });
    await this.rewardWild(w);
  }
  private async rewardWild(w: Wild) {
    if (isTraining(w)) return;
    for (const [id, damage] of w.contributors) {
      if (damage < Math.max(1, w.maxHp * (w.boss ? 0.05 : 0.01))) continue;
      const reward = w.boss ? 180 : w.elite ? 55 : 12 + w.level * 2;
      const online = this.players.get(id);
      const result = await mutate(
        id,
        `reward:${w.encounter}`,
        async (profile, tx) => {
          this.carryHp(online, profile);
          await tx.credit(
            profile,
            reward,
            w.boss
              ? "world boss"
              : w.elite
                ? "elite encounter"
                : "wild encounter",
            `encounter:${w.encounter}`,
          );
          increment(profile, "defeats");
          if (!SPECIES[w.species].companion)
            recordQuestEvent(profile, `camp:${w.habitat}`);
          if (w.elite) increment(profile, "elites");
          if (w.boss) increment(profile, "bosses");
          const creature = profile.creatures.find(
            (c) => c.id === profile.active,
          );
          const previousMax = heroMaxHp(profile);
          if (creature)
            gainExperience(
              creature,
              (w.boss ? 220 : w.elite ? 100 : 32) + w.level * 12,
            );
          profile.heroHp = Math.min(
            heroMaxHp(profile),
            heroHp(profile) + heroMaxHp(profile) - previousMax,
          );
        },
      );
      const p = this.players.get(id);
      if (p) {
        if (result.applied && p === online) p.hpDirty = false;
        p.profile = result.profile;
        if (p.online) safeSend(p.client, "profile", p.profile);
        if (result.applied)
          this.event(
            {
              type: "reward",
              message: `+${reward} ${BRAND.currency} · Field experience earned`,
              amount: reward,
              target: w.id,
            },
            p,
          );
      }
    }
    w.rewardPending = false;
  }
  private async tick() {
    const now = Date.now();
    for (const p of this.players.values()) {
      if (!isCurrent(p, this) || !p.online) continue;
      if (
        !p.duelId &&
        isSafeArea(p.x, p.z) &&
        !isTraining(
          this.wilds.get(p.auto?.target ?? p.cast?.target ?? p.petTarget ?? ""),
        )
      ) {
        p.combatUntil = 0;
        p.petTarget = undefined;
        p.auto = undefined;
        p.auras.delete("burn");
        p.auras.delete("poison");
      }
      if (p.dash && p.dash.until <= now) p.dash = undefined;
      if (p.dash && p.stunUntil <= now) {
        const next = dashStep(
          p,
          p.dash,
          Math.min(0.05, (p.dash.until - now) / 1000),
          this.wilds.values(),
        );
        const duel = this.duels.get(p.duelId ?? "");
        if (
          !duel?.arena ||
          duel.state !== "active" ||
          distance(next, PLACES.find((place) => place.id === "arena")!) < 17
        ) {
          p.x = next.x;
          p.z = next.z;
        }
      } else if (now - p.inputAt < 300 && p.stunUntil <= now) {
        const magnitude = Math.hypot(p.dx, p.dz);
        if (magnitude) {
          const speed =
            (p.sprint ? WORLD.sprint : WORLD.speed) *
            (p.slowUntil > now ? 0.55 : 1) *
            0.05;
          const next = moveAmongCreatures(
            p.x,
            p.z,
            (p.dx / Math.max(1, magnitude)) * speed,
            (p.dz / Math.max(1, magnitude)) * speed,
            this.wilds.values(),
          );
          const duel = this.duels.get(p.duelId ?? "");
          if (
            !duel?.arena ||
            duel.state !== "active" ||
            distance(next, PLACES.find((place) => place.id === "arena")!) < 17
          ) {
            p.x = next.x;
            p.z = next.z;
          }
        }
      }
      await this.advanceCast(p, now);
      await this.swing(p, now);
      const seconds = Math.min(1, (now - p.resourceAt) / 1000);
      p.resourceAt = now;
      p.resource = regenResource(
        heroClass(p.profile.classId).resource,
        p.resource,
        this.maxResource(p),
        seconds,
        p.combatUntil > now,
        now - p.lastCast,
      );
      if (p.combo && p.combatUntil + 10000 < now) p.combo = 0;
      for (const aura of dueTicks(p, now)) {
        const duel = this.duels.get(p.duelId ?? "");
        if (duel?.state !== "active" || !aura.tick) continue;
        p.duelHp = Math.max(0, p.duelHp - aura.tick);
        this.event({
          type: "dot",
          source: aura.source,
          target: p.profile.id,
          amount: aura.tick,
          ability: aura.ability,
          message: AURAS[aura.id].name,
        });
        if (p.duelHp === 0)
          await this.finishDuel(
            duel,
            duel.a === p.profile.id ? duel.b : duel.a,
            "defeat",
          );
      }
      const hp = heroHp(p.profile);
      if (
        !p.duelId &&
        p.combatUntil <= now &&
        hp > 0 &&
        hp < heroMaxHp(p.profile) &&
        now - p.regenAt >= 1000
      ) {
        p.regenAt = now;
        this.setHeroHp(
          p,
          hp + Math.max(1, heroMaxHp(p.profile) * OUT_OF_COMBAT_REGEN),
        );
      }
      await this.companionCombat.tick(p, now);
      if (heroHp(p.profile) === 0 && !p.duelId) {
        p.combatUntil = 0;
      }
      if (p.hpDirty && now - p.hpSavedAt > HP_SAVE_MS) await this.saveHp(p);
    }
    if (now - this.lastDiscovery > 1000) {
      this.lastDiscovery = now;
      for (const p of this.players.values()) {
        if (!p.online || !isCurrent(p, this)) continue;
        const stone = WAYSTONES.find(
          (w) => distance(p, w) < 9 && !p.profile.waystones?.includes(w.id),
        );
        if (stone) {
          await this.update(p, `waystone:${stone.id}`, (profile) => {
            profile.waystones ??= [];
            if (!profile.waystones.includes(stone.id)) {
              profile.waystones.push(stone.id);
              increment(profile, `attune:${stone.biome}`);
            }
          });
          this.event(
            {
              type: "discovery",
              message: `${stone.name} waystone attuned. Open the map to travel.`,
            },
            p,
          );
        }
        for (const wild of this.wilds.values())
          if (
            wild.hp > 0 &&
            distance(p, wild) < 28 &&
            recordPokemon(p.profile, wild.species)
          )
            p.hpDirty = true;
        const biome = biomeAt(p.x, p.z);
        if (biome !== "town" && !p.profile.discoveries.includes(biome)) {
          await this.update(p, `discovery:${biome}`, async (profile, tx) => {
            if (!profile.discoveries.includes(biome)) {
              profile.discoveries.push(biome);
              increment(profile, `discover:${biome}`);
              await tx.credit(profile, 20, "discovery", `discovery:${biome}`);
            }
          });
          this.event(
            {
              type: "discovery",
              message: `Discovered ${BIOMES[biome].name} · +20 ${BRAND.currency}`,
            },
            p,
          );
        }
      }
    }
    const visitors = [...this.players.values()]
      .filter((p) => p.online && heroHp(p.profile) > 0 && !p.duelId)
      .flatMap((p) => {
        const visitors = [
          {
            id: p.profile.id,
            x: p.x,
            z: p.z,
            moving: Math.hypot(p.dx, p.dz) > 0.1,
          },
        ];
        if (
          p.pet &&
          p.profile.creatures.some((c) => c.id === p.pet!.id && c.hp > 0)
        )
          visitors.push({
            id: p.profile.id,
            x: p.pet.x,
            z: p.pet.z,
            moving: p.pet.moving,
          });
        return visitors;
      });
    for (const w of this.wilds.values()) {
      if (
        POKEMON[w.species] &&
        !w.threat.size &&
        !pokemonAvailable(w.species, now)
      ) {
        w.hp = 0;
        w.respawnAt = now + 1000;
        continue;
      }
      if (w.hp <= 0) {
        if (w.rewardPending) await this.rewardWild(w);
        if (
          !w.rewardPending &&
          (w.respawnAt ?? Infinity) <= now &&
          canRespawn(w.home, this.players.values())
        ) {
          w.shiny = !!POKEMON[w.species] && Math.random() < 1 / 512;
          w.hp = w.maxHp;
          w.x = w.home.x;
          w.z = w.home.z;
          w.state = "idle";
          w.phase = 1;
          w.cast = undefined;
          w.castCount = 0;
          w.encounter = randomUUID();
          w.contributors.clear();
          w.respawnAt = undefined;
          w.resetting = false;
          this.resetCombat(w);
        }
        continue;
      }
      if (isTraining(w)) {
        tickTrainingTarget(w, this.players, now, (event) => this.event(event));
        continue;
      }
      for (const aura of dueTicks(w, now)) {
        if (!aura.tick) continue;
        w.hp = Math.max(0, w.hp - aura.tick);
        const source = this.players.get(aura.source ?? "");
        if (source) {
          w.contributors.set(
            source.profile.id,
            (w.contributors.get(source.profile.id) ?? 0) + aura.tick,
          );
          this.addThreat(
            w,
            source.profile.id,
            aura.tick * heroClass(source.profile.classId).threat,
          );
        }
        this.event({
          type: "dot",
          source: aura.source,
          target: w.id,
          amount: aura.tick,
          ability: aura.ability,
          message: AURAS[aura.id].name,
        });
        if (w.hp <= 0) break;
      }
      if (w.hp <= 0) {
        await this.defeatWild(w);
        continue;
      }
      if (w.stunUntil > now) continue;
      if (w.boss && w.hp < w.maxHp * 0.5 && w.phase === 1) {
        w.phase = 2;
        w.nextSpecial = now + 4000;
        this.event({
          type: "boss-phase",
          message: "Stormheart awakens! Watch the gathering lightning.",
          target: w.id,
        });
      }
      if (w.cast) {
        await this.advanceWildCast(w, now);
        continue;
      }
      if (POKEMON[w.species] && !w.threat.size && !w.resetting) {
        const aggro = tickPokemonAmbient(w, visitors, this.wilds.values(), now);
        if (aggro) {
          w.threat.set(aggro, 1);
          w.nextSwing = now + 700;
          w.nextSpecial = now + 3000;
        } else continue;
      }
      w.activity = undefined;
      const target = this.wildTarget(w, now);
      if (target) await this.engage(w, target, now);
      else if (distance(w, w.home) > 2.5 || w.state === "retreat") {
        if (w.state !== "retreat") w.retreatSince = now;
        w.state = "retreat";
        this.moveWild(w, w.home, w.resetting ? 0.3 : 0.14);
        // Scenery can block the straight path home; never stay stuck (or immune).
        if (now - w.retreatSince > (w.resetting ? 5000 : 12000)) {
          w.x = w.home.x;
          w.z = w.home.z;
        }
        if (distance(w, w.home) < 1) {
          w.state = "idle";
          if (w.resetting) {
            w.hp = w.maxHp;
            w.contributors.clear();
          }
          w.resetting = false;
          this.resetCombat(w);
        }
      } else {
        if (now - w.lastThink > 3000) {
          w.lastThink = now;
          w.angle = Math.random() * Math.PI * 2;
          w.state = Math.random() > 0.35 ? "roam" : "idle";
        }
        if (w.state === "roam") {
          const next = moveWithCollision(
            w.x,
            w.z,
            Math.cos(w.angle) * 0.018,
            Math.sin(w.angle) * 0.018,
          );
          if (!isSafeArea(next.x, next.z)) {
            w.x = next.x;
            w.z = next.z;
          }
        }
      }
    }
    this.duelSystem.pruneQueue();
    for (const d of this.duels.values()) {
      if (d.state === "invite" && now > d.expires) this.cancelDuel(d);
      if (d.state === "active" && now > d.expires)
        await this.finishDuel(d, null, "timeout");
      if (d.state === "finished" && now > d.expires) this.duels.delete(d.id);
    }
    if (now - this.lastSnapshot >= WORLD.snapshotMs) {
      this.lastSnapshot = now;
      const snapshot = this.snapshot();
      for (const p of this.players.values())
        if (p.online)
          safeSend(p.client, "world", {
            ...snapshot,
            wilds: snapshot.wilds.filter((w) => distance(p, w) < 100),
          });
    }
  }
  private resetCombat(w: Wild) {
    w.threat.clear();
    clearAuras(w);
    w.target = undefined;
    w.tauntBy = undefined;
    w.tauntUntil = 0;
    w.lockoutUntil = 0;
    w.nextSpecial = 0;
    w.specials = 0;
  }
  /** Leashed: run home immune to damage and reset. */
  private evade(w: Wild) {
    w.state = "retreat";
    w.resetting = true;
    w.retreatSince = Date.now();
    w.cast = undefined;
    this.resetCombat(w);
  }
  private canFight(w: Wild, p: Player) {
    return (
      p.online &&
      this.duels.get(p.duelId ?? "")?.state !== "active" &&
      isCurrent(p, this) &&
      p.profile.creatures.length > 0 &&
      heroHp(p.profile) > 0 &&
      !isSafeArea(p.x, p.z) &&
      distance(p, w) <= 40
    );
  }
  /** Maintain the threat table and pick who the creature attacks. */
  private wildTarget(w: Wild, now: number) {
    let dropped = false;
    for (const id of [...w.threat.keys()]) {
      const p = this.players.get(id);
      if (!p || !this.canFight(w, p)) {
        w.threat.delete(id);
        dropped = true;
      }
    }
    if (w.tauntUntil <= now) w.tauntBy = undefined;
    let id = threatLeader(w.threat, w.target, w.tauntBy);
    // Leashed: dragged too far from home, or nobody it was fighting remains.
    if (
      (!id && (w.target || dropped)) ||
      (id && distance(w, w.home) > encounterLeash(w.boss))
    ) {
      this.evade(w);
      return undefined;
    }
    if (!id && !w.resetting && !SPECIES[w.species].companion) {
      const found = [...this.players.values()].find(
        (p) =>
          this.canFight(w, p) &&
          distance(p, w) < (w.boss ? 12 : w.elite ? 6 : 5),
      );
      if (found) {
        id = found.profile.id;
        w.threat.set(id, 1);
        w.state = "alert";
        w.nextSwing = now + 700;
        w.nextSpecial = now + 2500 + Math.random() * 1500;
        this.event({
          type: "aggro",
          source: w.id,
          target: id,
          message: `${SPECIES[w.species].name} attacks!`,
        });
      }
    }
    w.target = id;
    return id ? this.players.get(id) : undefined;
  }
  private async engage(w: Wild, target: Player, now: number) {
    target.combatUntil = Math.max(target.combatUntil, now + 1500);
    const species = SPECIES[w.species],
      d = distance(w, target),
      sight = lineOfSight(w, target),
      ranged = RANGED_ELEMENTS.includes(species.element);
    if (w.boss) {
      if (now - w.lastAttack > (w.phase === 2 ? 2300 : 3300) && sight) {
        w.lastAttack = now;
        w.state = "attack";
        w.castVictims = undefined;
        w.cast = bossCast(w, target, w.castCount++, now);
        this.event({
          type: "boss-telegraph",
          message: `${BOSS_ATTACKS[(w.castCount - 1) % 3].name} — move out of the marked ground!`,
          source: w.id,
          target: target.profile.id,
          ability: w.cast.ability,
        });
        return;
      }
      if (
        w.phase === 2 &&
        now >= w.nextSpecial &&
        now >= w.lockoutUntil &&
        sight
      ) {
        w.nextSpecial = now + 14000;
        w.state = "attack";
        w.cast = creatureSpell(
          "storm",
          w,
          target.profile.id,
          "spark",
          "storm",
          now,
        );
        this.event({
          type: "boss-telegraph",
          message: "Stormheart begins casting Stormcall — interrupt it!",
          source: w.id,
          ability: "storm",
        });
        return;
      }
    } else if (
      now >= w.nextSpecial &&
      now >= w.lockoutUntil &&
      sight &&
      d <= (ranged ? 13 : 8)
    ) {
      const special = this.chooseSpecial(w, target, d, ranged, now);
      if (special) {
        w.cast = special;
        w.castVictims = undefined;
        w.state = "attack";
        w.lastAttack = now;
        w.specials++;
        w.nextSpecial = now + (w.elite ? 5200 : 7000) + Math.random() * 2000;
        return;
      }
    }
    const reach = w.boss ? 4.2 : ranged ? 9 : 2.6;
    if (d > reach) {
      w.state = "chase";
      this.moveWild(w, target, (w.slowUntil > now ? 2.1 : 4.2) * 0.05);
      return;
    }
    if (now >= w.nextSwing && sight) {
      w.nextSwing = now + (w.boss ? 1600 : w.elite ? 1800 : 2000);
      w.swungAt = now;
      w.state = "attack";
      await this.wildHit(
        w,
        target,
        ranged ? `${species.name} bolt` : `${species.name} attack`,
        0,
        ranged ? "bolt" : "auto",
      );
      return;
    }
    if (now - Math.max(w.lastAttack, w.swungAt) > 600) w.state = "alert";
  }
  private chooseSpecial(
    w: Wild,
    target: Player,
    d: number,
    ranged: boolean,
    now: number,
  ): BossCast | undefined {
    const species = SPECIES[w.species],
      [primary, secondary] = species.moves;
    if (
      (w.elite || ranged) &&
      w.hp < w.maxHp * 0.55 &&
      w.specials % 3 === 2 &&
      species.element !== "flame"
    )
      return creatureSpell("mend", w, w.id, species.element, secondary, now);
    if (ranged)
      return w.specials % 2
        ? creatureSpell(
            "bolt",
            w,
            target.profile.id,
            species.element,
            secondary,
            now,
          )
        : creatureCast(primary, target, now, w, 0, species.element);
    return creatureCast(
      primary,
      target,
      now,
      w,
      d > 4.5 ? 2 : 1,
      species.element,
    );
  }
  private async advanceWildCast(w: Wild, now: number) {
    const cast = w.cast!;
    if (cast.spell) {
      if (now < cast.resolvesAt) return;
      w.cast = undefined;
      w.lastAttack = now;
      if (cast.spell === "mend") {
        const healed = Math.min(w.maxHp - w.hp, Math.round(w.maxHp * 0.22));
        w.hp += healed;
        this.event({
          type: "heal",
          source: w.id,
          target: w.id,
          amount: healed,
          heal: true,
          ability: cast.ability,
          message: cast.name ?? "Mend",
        });
        return;
      }
      const victims =
        cast.spell === "storm"
          ? [...this.players.values()].filter(
              (p) =>
                this.canFight(w, p) &&
                distance(w, p) <= encounterLeash(true) + 12 &&
                lineOfSight(w, p),
            )
          : [this.players.get(cast.target ?? "")].filter(
              (p): p is Player =>
                !!p &&
                this.canFight(w, p) &&
                distance(w, p) <= 30 &&
                lineOfSight(w, p),
            );
      this.event({
        type: "attack",
        source: w.id,
        target: cast.target,
        ability: cast.ability,
        message: cast.name ?? "Spell",
      });
      for (const victim of victims)
        await this.wildHit(
          w,
          victim,
          cast.name ?? "Spell",
          cast.spell === "storm" ? 3 : 0,
          "spell",
        );
      return;
    }
    if (cast.releasesAt !== undefined)
      await this.resolveWildCast(w, cast, cast.name ?? "Aimed bolt", 0, now);
    const quarry = this.players.get(w.target ?? "");
    if (
      cast.charge &&
      now >= cast.resolvesAt - 250 &&
      (!quarry || distance(w, quarry) > 1.8)
    ) {
      const next = dashStep(
        w,
        { x: Math.sin(cast.yaw ?? 0), z: Math.cos(cast.yaw ?? 0) },
        0.05,
        [],
      );
      if (
        !isSafeArea(next.x, next.z) &&
        distance(next, w.home) <= encounterLeash(w.boss)
      ) {
        w.x = next.x;
        w.z = next.z;
      }
    }
    if (now < cast.resolvesAt) return;
    w.cast = undefined;
    const index = w.boss
      ? BOSS_ATTACKS.findIndex((attack) => attack.id === cast.ability)
      : 0;
    const name = w.boss
      ? BOSS_ATTACKS[index]?.name
      : (cast.name ?? `${SPECIES[w.species].name} strike`);
    if (!name) return;
    if (cast.releasesAt === undefined)
      await this.resolveWildCast(w, cast, name, index, now);
    this.event({
      type: "attack",
      message: name,
      source: w.id,
      ability: cast.ability,
    });
  }
  private async resolveWildCast(
    w: Wild,
    cast: BossCast,
    name: string,
    index: number,
    now: number,
  ) {
    for (const player of this.players.values()) {
      if (
        player.pet &&
        this.canFight(w, player) &&
        !w.castVictims?.has(`pet:${player.profile.id}`) &&
        castHits(cast, player.pet, now)
      ) {
        w.castVictims ??= new Set();
        w.castVictims.add(`pet:${player.profile.id}`);
        this.companionCombat.hit(w, player, 1.7, now);
      }
      if (w.castVictims?.has(player.profile.id)) continue;
      if (
        this.canFight(w, player) &&
        (w.boss ||
          player.profile.id === w.target ||
          w.threat.has(player.profile.id)) &&
        castHits(cast, player, now)
      ) {
        w.castVictims ??= new Set();
        w.castVictims.add(player.profile.id);
        await this.wildHit(w, player, name, index, "telegraph");
      }
    }
  }
  private moveWild(w: Wild, target: { x: number; z: number }, amount: number) {
    const d = distance(w, target);
    if (d < 0.1) return;
    const next = moveWithCollision(
      w.x,
      w.z,
      ((target.x - w.x) / d) * Math.min(amount, d),
      ((target.z - w.z) / d) * Math.min(amount, d),
    );
    if (!isSafeArea(next.x, next.z)) {
      w.x = next.x;
      w.z = next.z;
    }
  }
  private async wildHit(
    w: Wild,
    p: Player,
    attack: string,
    variant: number,
    kind: "auto" | "bolt" | "telegraph" | "spell",
  ) {
    const now = Date.now();
    if (
      !p.profile.creatures.length ||
      this.duels.get(p.duelId ?? "")?.state === "active" ||
      !isCurrent(p, this)
    )
      return;
    const invitation = this.duels.get(p.duelId ?? "");
    if (invitation?.state === "invite") this.cancelDuel(invitation);
    const c =
      p.profile.creatures.find((c) => c.id === p.profile.active) ??
      p.profile.creatures[0];
    if (heroHp(p.profile) <= 0) return;
    if (
      (kind === "auto" || kind === "bolt") &&
      p.pet &&
      c.id === p.pet.id &&
      c.hp > 0 &&
      p.petTarget === w.id &&
      distance(p.pet, w) < (kind === "auto" ? 4 : 14) &&
      (p.pet.guardUntil > now || Math.random() < 0.45)
    ) {
      this.companionCombat.hit(w, p, kind === "auto" ? 1 : 1.6, now);
      return;
    }
    const report = (outcome: Outcome, amount = 0) =>
      this.event({
        type: "hit",
        ability: SPECIES[w.species].moves[0],
        message: amount ? `${attack} · −${amount}` : `${attack} · ${outcome}`,
        source: w.id,
        target: p.profile.id,
        amount,
        outcome,
        auto: kind === "auto" || kind === "bolt",
      });
    p.combatUntil = now + COMBAT_MS;
    if (p.dash && now - p.dash.startedAt < DASH.invulnerable)
      return report("dodge");
    const cls = heroClass(p.profile.classId);
    const chances = creatureAttackChances(cls, w.level, heroLevel(p.profile), {
      melee: kind === "auto",
      evasion: hasAura(p, "evasion", now),
      elite: w.elite || w.boss,
    });
    if (kind === "telegraph" || kind === "spell")
      Object.assign(chances, { miss: 0, dodge: 0, parry: 0 });
    if (kind === "spell") chances.block = 0;
    const outcome = rollOutcome(chances);
    if (!landed(outcome)) return report(outcome);
    const scale = { auto: 1.25, bolt: 1.15, telegraph: 1.7, spell: 1.9 }[kind];
    const damage = Math.max(
      1,
      Math.round(
        (5 + w.level * 1.3 + (w.elite ? 4 : 0) + (w.boss ? variant * 3 : 0)) *
          scale *
          effectiveness(
            SPECIES[w.species].element,
            SPECIES[c.species].element,
          ) *
          outcomeScale(outcome, kind === "spell") *
          variance() *
          (p.guardUntil > now ? 0.35 : 1),
      ),
    );
    this.setHeroHp(p, heroHp(p.profile) - damage);
    this.gainResource(
      p,
      resourceFromTaken(cls.resource, damage, outcome === "block"),
    );
    if (w.boss && variant === 1)
      applyAura(p, "slow", now, 2500, { ability: "wave", source: w.id });
    if (w.boss && variant === 2)
      applyAura(p, "stun", now, 500, { ability: "storm", source: w.id });
    report(outcome, damage);
    if (heroHp(p.profile) <= 0) {
      p.cast = undefined;
      p.dash = undefined;
      p.auto = undefined;
      p.x = WORLD.spawn.x;
      p.z = WORLD.spawn.z;
      p.dx = 0;
      p.dz = 0;
      p.combatUntil = 0;
      p.combo = 0;
      p.resource = this.startResource(p);
      clearAuras(p);
      await this.saveHp(p);
      this.event(
        {
          type: "defeat",
          message:
            "You fell in battle and returned safely to town. Visit the Springhouse for free healing.",
          target: p.profile.id,
        },
        p,
      );
    }
  }
  private invite(...args: Parameters<DuelSystem["invite"]>) {
    return this.duelSystem.invite(...args);
  }
  private respondDuel(...args: Parameters<DuelSystem["respondDuel"]>) {
    return this.duelSystem.respondDuel(...args);
  }
  private cancelDuel(...args: Parameters<DuelSystem["cancelDuel"]>) {
    return this.duelSystem.cancelDuel(...args);
  }
  private finishDuel(...args: Parameters<DuelSystem["finishDuel"]>) {
    return this.duelSystem.finishDuel(...args);
  }
  private matchQueue() {
    return this.duelSystem.matchQueue();
  }
}
