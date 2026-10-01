import {
  CAPTURE_TIMING,
  EVOLUTION_TIMING,
} from "../../../packages/shared/pokedex";
import type {
  Biome,
  GameEvent,
  WorldSnapshot,
} from "../../../packages/shared/types";
import { POKEMON } from "../../../packages/shared/pokemon";
import { AudioMixer } from "./audio/mixer";
import {
  audioDefaults,
  normalizeAudio,
  tracks,
  type AudioSettings,
  type CueId,
  type Point,
} from "./audio/catalog";
import { abilitySound, impactSound } from "./audio/combat";
import { footSurface, soundscape } from "./audio/soundscape";
export class GameAudio {
  private mixer?: AudioMixer;
  private settings = { ...audioDefaults };
  private biome: Biome = "town";
  private nextBiome: Biome = "town";
  private biomeChangedAt = 0;
  private position: Point = { x: 0, z: -32 };
  private alpha = -Math.PI / 2;
  private snapshot?: WorldSnapshot;
  private self = "";
  private playing = false;
  private connected = true;
  private timer?: ReturnType<typeof setInterval>;
  private scheduled = new Set<ReturnType<typeof setTimeout>>();
  private combatUntil = 0;
  private nextCall = 0;
  private remoteSteps = new Map<string, { x: number; z: number; at: number }>();
  private disposed = false;
  private visibility = () => {
    if (document.hidden && !this.settings.backgroundAudio)
      this.cancelScheduled();
    this.update();
  };
  constructor() {
    document.addEventListener("visibilitychange", this.visibility);
  }
  async start() {
    if (this.disposed || this.settings.mute || this.settings.master === 0)
      return;
    try {
      if (!this.mixer) {
        this.mixer = new AudioMixer(
          new AudioContext({ latencyHint: "interactive" }),
        );
        this.mixer.configure(this.settings);
        this.timer = setInterval(() => this.update(), 200);
        for (const id of [
          "ui",
          "error",
          "open",
          "swing-0",
          "hit-0",
          "step-stone-0",
          "step-grass-0",
          "fire-cast",
          "capture-shake",
          "reward",
        ])
          void this.mixer.buffers.get(id).catch(() => {});
      }
      this.update();
      if (this.audible()) await this.mixer.context.resume();
    } catch {}
  }
  configure(settings: Partial<AudioSettings>) {
    this.settings = normalizeAudio({ ...this.settings, ...settings });
    this.mixer?.configure(this.settings);
    if (this.settings.mute) this.cancelScheduled();
    this.update();
  }
  setBiome(biome: Biome) {
    if (biome !== this.nextBiome) {
      this.nextBiome = biome;
      this.biomeChangedAt = Date.now();
    }
    if (Date.now() - this.biomeChangedAt >= 1500) this.biome = biome;
  }
  setPlaying(playing: boolean) {
    this.playing = playing;
    if (!playing) {
      this.combatUntil = 0;
      this.cancelScheduled();
    }
    this.update();
  }
  setConnected(connected: boolean) {
    this.connected = connected;
    if (!connected) {
      this.combatUntil = 0;
      this.cancelScheduled();
    }
    this.update();
  }
  setListener(point: Point, alpha: number) {
    this.position = { ...point };
    this.alpha = alpha;
    this.mixer?.setListener(point, alpha);
  }
  setSnapshot(snapshot: WorldSnapshot, self: string) {
    this.snapshot = snapshot;
    this.self = self;
    const player = snapshot.players.find((player) => player.id === self);
    if (
      player?.inCombat ||
      snapshot.duels.some(
        (duel) =>
          duel.state === "active" && (duel.a === self || duel.b === self),
      )
    )
      this.combatUntil = Date.now() + 5000;
    if (player && player.hp <= 0) this.combatUntil = 0;
    const ids = new Set(snapshot.players.map((player) => player.id));
    for (const id of this.remoteSteps.keys())
      if (!ids.has(id)) this.remoteSteps.delete(id);
    for (const other of snapshot.players) {
      if (other.id === self) continue;
      const previous = this.remoteSteps.get(other.id);
      if (
        previous &&
        this.connected &&
        other.moving &&
        Math.hypot(other.x - previous.x, other.z - previous.z) > 1.4 &&
        Date.now() - previous.at > 280 &&
        Math.hypot(other.x - this.position.x, other.z - this.position.z) < 16
      ) {
        this.emit(footSurface(other), other, 0.45);
        this.remoteSteps.set(other.id, {
          x: other.x,
          z: other.z,
          at: Date.now(),
        });
      } else if (!previous || !other.moving)
        this.remoteSteps.set(other.id, {
          x: other.x,
          z: other.z,
          at: Date.now(),
        });
    }
  }
  private audible() {
    return (
      !this.disposed &&
      !this.settings.mute &&
      this.settings.master > 0 &&
      (!document.hidden || this.settings.backgroundAudio)
    );
  }
  private update() {
    if (!this.mixer || this.disposed) return;
    const active = this.audible();
    this.mixer.setActive(active);
    if (!active) return;
    this.mixer.setListener(this.position, this.alpha);
    const exploring = this.playing && this.connected;
    this.mixer.update(
      exploring && Date.now() < this.combatUntil
        ? "combat"
        : tracks[exploring ? this.biome : "town"],
      exploring
        ? soundscape(
            this.biome,
            this.position,
            this.snapshot?.conditions?.time === "night",
            this.snapshot?.conditions?.weather === "rain",
          )
        : [],
    );
    if (
      exploring &&
      Date.now() > this.nextCall &&
      Date.now() > this.combatUntil
    ) {
      this.nextCall = Date.now() + 12000 + Math.random() * 12000;
      const nearby =
        this.snapshot?.wilds.filter(
          (w) =>
            w.hp > 0 &&
            ["idle", "roam"].includes(w.state) &&
            Math.hypot(w.x - this.position.x, w.z - this.position.z) < 22,
        ) ?? [];
      const wild = nearby[Math.floor(Math.random() * nearby.length)];
      if (wild)
        this.emit("creature-call", wild, 0.6, this.creaturePitch(wild.species));
    }
  }
  private emit(cue: CueId, point?: Point, volume = 1, pitch = 1) {
    if (this.audible()) void this.mixer?.play(cue, point, volume, pitch);
  }
  private creaturePitch(species?: string) {
    return Math.max(
      0.75,
      Math.min(1.45, 1.2 / Math.sqrt(POKEMON[species ?? ""]?.size ?? 1)),
    );
  }
  private point(event: GameEvent, impact = false): Point | undefined {
    if (event.x !== undefined && event.z !== undefined)
      return { x: event.x, z: event.z };
    const id = impact ? event.target : (event.source ?? event.target);
    const player = this.snapshot?.players.find((player) => player.id === id);
    if (player)
      return !impact && event.actor === "companion" && player.pet
        ? player.pet
        : player;
    return this.snapshot?.wilds.find((wild) => wild.id === id);
  }
  step(point: Point, landing = false, sprint = false) {
    if (this.playing && this.connected)
      this.emit(
        footSurface(point),
        undefined,
        landing ? 1.35 : sprint ? 1.1 : 0.85,
        landing ? 0.9 : 1,
      );
  }
  playImpact(event: GameEvent) {
    if (!this.connected) return;
    const point = this.point(event, true);
    if (!point && event.source !== this.self && event.target !== this.self)
      return;
    this.emit(impactSound(event), point, event.type === "dot" ? 0.4 : 1);
    if (
      !event.heal &&
      event.type !== "dot" &&
      (!event.outcome || ["hit", "crit"].includes(event.outcome)) &&
      this.snapshot?.wilds.some((w) => w.id === event.target && w.hp > 0)
    )
      this.emit("creature-hurt", point, 0.4);
    if (event.target === this.self && event.outcome === "crit")
      this.mixer?.duck(0.7);
  }
  handleEvent(event: GameEvent) {
    if (!this.connected) return;
    const local =
      (!event.source && !event.target) ||
      event.type === "reward" ||
      event.source === this.self ||
      event.target === this.self;
    const point = this.point(event);
    if (
      !local &&
      (!point ||
        Math.hypot(point.x - this.position.x, point.z - this.position.z) > 40)
    )
      return;
    switch (event.type) {
      case "reward":
        if (event.target) this.emit("coin", undefined, 0.6);
        break;
      case "cast":
      case "pet-cast":
      case "mobility":
        this.emit(
          abilitySound(event.ability),
          point,
          event.actor === "companion" ? 0.8 : 1,
        );
        break;
      case "swing":
        this.emit("swing", point, 0.7);
        break;
      case "attack":
        if (
          ["heal", "guard"].includes(abilitySound(event.ability)) ||
          event.ability === "vanish"
        )
          this.emit(abilitySound(event.ability), point);
        break;
      case "dash":
        this.emit("dash", point);
        break;
      case "interrupt":
        this.emit("shatter", point);
        break;
      case "cast-cancel":
        if (event.source === this.self) this.emit("close", undefined, 0.7);
        break;
      case "shatter":
        this.emit("shatter", this.point(event, true));
        break;
      case "aggro":
        this.emit("creature-roar", point, 0.55);
        break;
      case "boss-phase":
      case "boss-telegraph":
        this.emit("creature-roar", point);
        if (local) this.mixer?.duck(2);
        break;
      case "pet-heal":
      case "heal":
        this.emit("heal", point);
        break;
      case "pet-swap":
        this.emit("magic", point, 0.7);
        this.later(350, () => this.emit("creature-call", point));
        break;
      case "defeat":
        if (event.target === this.self) {
          this.emit("defeat");
          this.combatUntil = 0;
          this.mixer?.duck(3);
        } else this.emit("creature-faint", this.point(event, true));
        break;
      case "capture":
      case "capture-failed":
        if (!event.capture || event.source !== this.self) break;
        this.emit("swing", undefined, 0.65);
        for (let i = 0; i < event.capture.shakes; i++)
          this.later(CAPTURE_TIMING.flight + i * CAPTURE_TIMING.shake, () =>
            this.emit("capture-shake"),
          );
        this.later(event.capture.duration - CAPTURE_TIMING.reveal, () => {
          this.emit(event.capture!.success ? "reward" : "error");
          this.mixer?.duck(1.5);
        });
        break;
      case "duel-result":
        this.emit(event.message === "Victory!" ? "victory" : "defeat");
        this.mixer?.duck(4);
        break;
      case "evolution":
        this.emit("magic", point);
        this.later(EVOLUTION_TIMING.reveal, () =>
          this.emit("reward", local ? undefined : point, local ? 1 : 0.5),
        );
        if (local) this.mixer?.duck(2.5);
        break;
    }
  }
  play(kind = "ui") {
    const cue: CueId | undefined = (
      {
        ui: "ui",
        error: "error",
        reward: "reward",
        quest: "confirm",
        starter: "confirm",
        acceptQuest: "page",
        buy: "coin",
        use: "water",
        class: "equip",
        team: "equip",
        deploy: "magic",
        learn: "confirm",
        level: "victory",
        discovery: "confirm",
        travel: "magic",
        interact: "open",

        welcome: "confirm",
        open: "open",
        close: "close",
        page: "page",
        bag: "bag",
        equip: "equip",
        jump: "dash",
        coin: "coin",
        target: "target",
      } as Record<string, CueId>
    )[kind];
    if (cue) {
      this.emit(cue);
      if (cue === "reward" || cue === "victory") this.mixer?.duck(4);
    }
  }
  private later(ms: number, action: () => void) {
    if (this.scheduled.size >= 24) return;
    const timer = setTimeout(() => {
      this.scheduled.delete(timer);
      if (!this.disposed && this.audible()) action();
    }, ms);
    this.scheduled.add(timer);
  }
  private cancelScheduled() {
    for (const timer of this.scheduled) clearTimeout(timer);
    this.scheduled.clear();
  }
  get metrics() {
    return {
      ...this.mixer?.metrics,
      biome: this.biome,
      scheduled: this.scheduled.size,
    };
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    this.cancelScheduled();
    document.removeEventListener("visibilitychange", this.visibility);
    this.mixer?.dispose();
  }
}
