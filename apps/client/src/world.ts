import { createTrainingDummy } from "./render/training-dummy";
import {
  isTraining,
  TRAINING_TARGETS,
} from "../../../packages/shared/training";
import { cacheEnabledMeshCandidates } from "./render/mesh-candidates";
import {
  companionMood,
  personalityPhase,
} from "../../../packages/shared/companion-personality";
import { startup } from "./loading/progress";
import {
  appearanceKey,
  normalizeAppearance,
  RACES,
} from "../../../packages/shared/appearance";
import { heroCanWalk } from "../../../packages/shared/hero";
import { alignPokemon } from "./render/pokemon-pose";
import { POKEMON_MOVES } from "../../../packages/shared/pokemon-moves";
import { POKEMON } from "../../../packages/shared/pokemon";
import { ABILITIES } from "../../../packages/shared/data";
import {
  DASH,
  dashStep,
  type DashState,
} from "../../../packages/shared/combat";
import { createStoryWorld } from "./render/story-world";
import { movementScale, impactDelay } from "./render/combat-motion";
import { SPECIES_MODELS, EVOLVED_MODELS } from "./roster";
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
  SceneInstrumentation,
  type AbstractMesh,
} from "@babylonjs/core";
import { SPAWNS, WORLD, SPECIES } from "../../../packages/shared/data";
import {
  distance,
  moveWithCollision,
  moveAmongCreatures,
  terrainHeight,
} from "../../../packages/shared/rules";
import type {
  GameEvent,
  PlayerView,
  Profile,
  WildView,
  WorldSnapshot,
} from "../../../packages/shared/types";
import { buildEnvironment } from "./render/environment";
import { loadCreatures, type CreatureActor } from "./render/creatures";
import { loadTrainers, type TrainerActor } from "./render/trainer";
import { createCameraControls } from "./render/camera-controls";
import { createCombatEffects } from "./render/combat-effects";
import { createCombatOverlay, type FloatKind } from "./render/overlay";
import {
  difficulty,
  landed,
  type Outcome,
} from "../../../packages/shared/combat-rules";
import { createThreatMarker } from "./render/threat";
import { createWorldLabel } from "./render/labels";
import { guestStep, isGuest } from "../../../packages/shared/access";
import { createCameraCollision } from "./render/camera-collision";
import {
  turnTowards,
  bodyVisibility,
  followCameraTarget,
} from "./render/camera-presentation";

export interface WorldSettings {
  quality?: string;
  sensitivity?: number;
  reducedMotion?: boolean;
  cameraShake?: boolean;
  keybinds?: Record<string, string>;
}
export interface GameWorld {
  setOverview: (
    center: { x: number; z: number; alpha?: number; beta?: number },
    radius: number,
  ) => void;
  dash: () => void;
  setSnapshot: (snapshot: WorldSnapshot, selfId: string) => void;
  setProfile: (profile: Profile) => void;
  setPlaying: (playing: boolean) => void;
  setTarget: (id: string | null) => void;
  /** Play the local hero's ability motion before the server confirms it. */
  predictAbility: (ability: string) => void;
  /** Level-up flourish around the local hero. */
  celebrate: () => void;
  /** Floating reward text above the local hero. */
  floatSelf: (text: string, kind: FloatKind) => void;
  cancelPrediction: () => void;
  /** Show a chat bubble above a player. */
  say: (playerId: string, text: string, ms: number) => void;
  setSettings: (settings: WorldSettings) => void;
  getPosition: () => { x: number; z: number };
  handleEvent: (event: GameEvent) => void;
  dispose: () => void;
}
interface Callbacks {
  onTarget: (id: string) => void;
  onAutoAttack?: (id: string) => void;
  onMove: (dx: number, dz: number, sprint: boolean, yaw: number) => void;
  onInteract: () => void;
  onDash: (dx: number, dz: number) => void;
  onAbility: (slot: number, quiet?: boolean) => void;
  onTame: () => void;
  onImpact?: (event: GameEvent) => void;
  onStep?: (
    point: { x: number; z: number },
    landing: boolean,
    sprint: boolean,
  ) => void;
  onJump?: () => void;
  onListener?: (point: { x: number; z: number }, alpha: number) => void;
  /** A guest walked into the edge of the guest regions. */
  onBoundary?: () => void;
}
interface Actor {
  visual: CreatureActor;
  view: WildView;
  lastHp: number;
  impactAt?: number;
  defeatStarted?: boolean;
  holdUntil: number;
  hitUntil: number;
  attackTarget?: string;
}
interface PlayerActor {
  restSince: number;
  greetingUntil: number;
  personalityPhase: number;
  mood?: string;
  nameHeight: number;
  heroAimUntil?: number;
  trainer: TrainerActor;
  nameplate: ReturnType<typeof createWorldLabel>;
  companion?: CreatureActor;
  companionLabel?: ReturnType<typeof createWorldLabel>;
  companionKey?: string;
  cinematicUntil?: number;
  view: PlayerView;
  holdUntil: number;
  hitUntil: number;
  attackTarget?: string;
}

export async function createWorld(
  canvas: HTMLCanvasElement,
  callbacks: Callbacks,
): Promise<GameWorld> {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    antialias: true,
  });
  engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
  const scene = new Scene(engine);
  cacheEnabledMeshCandidates(scene);
  let overview:
    | { x: number; z: number; radius: number; alpha?: number; beta?: number }
    | undefined;
  const instrumentation = new SceneInstrumentation(scene);
  instrumentation.captureFrameTime = true;
  const frameMs: number[] = [];
  scene.clearColor = new Color4(0.65, 0.79, 0.79, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0026;
  scene.fogColor = new Color3(0.72, 0.85, 0.82);
  scene.ambientColor = new Color3(0.14, 0.17, 0.14);
  const camera = new ArcRotateCamera(
    "expedition camera",
    -Math.PI / 2 + 0.46,
    1.08,
    47,
    new Vector3(-2, 2, -17),
    scene,
  );
  camera.minZ = 0.15;
  camera.maxZ = 1200;
  camera.lowerRadiusLimit = 0.85;
  camera.upperRadiusLimit = 60;
  camera.lowerBetaLimit = 0.35;
  camera.upperBetaLimit = 1.48;
  camera.wheelPrecision = 28;
  camera.panningSensibility = 0;
  camera.angularSensibilityX = 900;
  camera.angularSensibilityY = 900;
  camera.inputs.clear();
  const hemi = new HemisphericLight("sky fill", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.58;
  hemi.diffuse = new Color3(0.8, 0.88, 1);
  hemi.groundColor = new Color3(0.35, 0.38, 0.25);
  const sun = new DirectionalLight(
    "golden sun",
    new Vector3(-0.55, -1, 0.35),
    scene,
  );
  sun.position = new Vector3(30, 60, -35);
  sun.intensity = 1.4;
  sun.diffuse = new Color3(1, 0.9, 0.71);
  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadows.darkness = 0.2;
  shadows.bias = 0.002;
  shadows.normalBias = 0.05;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 180;
  sun.shadowFrustumSize = 60;
  sun.autoUpdateExtends = false;
  const pipeline = new DefaultRenderingPipeline("warm film", true, scene, [
    camera,
  ]);
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 1.0;
  pipeline.bloomWeight = 0.22;
  pipeline.bloomKernel = 36;
  pipeline.imageProcessing.contrast = 1.1;
  pipeline.imageProcessing.exposure = 1.3;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType =
    ImageProcessingConfiguration.TONEMAPPING_ACES;
  let cameraCollision: ReturnType<typeof createCameraCollision> | undefined;
  const loaded = await Promise.allSettled([
    buildEnvironment(scene, (meshes) => {
      for (const mesh of meshes) shadows.addShadowCaster(mesh);
      cameraCollision?.include(meshes);
    }),
    loadCreatures(
      scene,
      (meshes) => {
        for (const mesh of meshes) shadows.addShadowCaster(mesh);
      },
      startup.active,
    ),
    loadTrainers(scene),
  ] as const);
  if (
    loaded[0].status === "rejected" ||
    loaded[1].status === "rejected" ||
    loaded[2].status === "rejected"
  ) {
    for (const result of loaded)
      if (result.status === "fulfilled") result.value.dispose();
    instrumentation.dispose();
    scene.dispose();
    engine.dispose();
    throw loaded.find((result) => result.status === "rejected")!.reason;
  }
  const environment = loaded[0].value;
  const creatures = loaded[1].value;
  const trainers = loaded[2].value;
  const storyWorld = createStoryWorld(scene, trainers);
  cameraCollision = createCameraCollision(scene, camera);
  for (const mesh of scene.meshes)
    if (mesh.metadata?.castShadow) shadows.addShadowCaster(mesh);
  const threats = new Map<string, ReturnType<typeof createThreatMarker>>();
  const overlay = createCombatOverlay(canvas, scene, (id, attack) => {
    if (!playing) return;
    callbacks.onTarget(id);
    if (attack) callbacks.onAutoAttack?.(id);
  });
  overlay.setCamera(camera);
  let collisionCreatures: WildView[] = [];
  let serverTime = Date.now(),
    receivedTime = 0;

  const targets = new Map<string, Actor>(),
    players = new Map<string, PlayerActor>();
  let playing = false,
    selfId = "",
    targetId: string | null = null,
    settings: WorldSettings = {},
    guest = false,
    disposed = false;
  let predictedDash: DashState | undefined;
  let position = { ...WORLD.spawn },
    yaw = 0,
    jump = 0,
    jumpVelocity = 0,
    lastSend = 0,
    velocity = { x: 0, z: 0 },
    time = 0,
    shake = 0,
    hitstopUntil = 0,
    nextHeldAttack = 0,
    stepDistance = 0,
    lastTab = 0;
  const recentTabs: string[] = [];
  let predicted: { ability: string; at: number } | undefined;
  Object.defineProperty(window, "__islandMetrics", {
    configurable: true,
    get: () => ({
      fps: engine.getFps(),
      frameMs: [...frameMs],
      meshes: scene.meshes.length,
      activeMeshes: scene.getActiveMeshes().length,
      activeIndices: scene.getActiveIndices(),
      vertices: scene.getTotalVertices(),
      drawCalls: instrumentation.drawCallsCounter.current,
      creatures: targets.size,
      loadedPokemon: [...targets.values()].filter(
        (actor) => POKEMON[actor.view.species] && actor.visual.modelReady,
      ).length,
      visiblePokemon: [...targets.values()].filter(
        (actor) =>
          POKEMON[actor.view.species] &&
          actor.view.hp > 0 &&
          actor.visual.root.isEnabled() &&
          !!scene.frustumPlanes &&
          actor.visual.meshes.some(
            (mesh) => mesh.isEnabled() && mesh.isInFrustum(scene.frustumPlanes),
          ),
      ).length,
      players: players.size,
      selfPosition: { ...position },
      cameraAlpha: camera.alpha,
      cameraBeta: camera.beta,
      activeEffects: combatEffects.count,
      floatingText: overlay.floatCount,
      effectNames: combatEffects.activeNames,
      heroMotion: players.get(selfId)?.trainer.motion,
      characterNames: [...players.values()].map((actor) => ({
        id: actor.view.id,
        name: actor.view.nickname,
        pet: actor.view.companionName,
        appearance: actor.view.appearance,
        mood: actor.mood,
        nameVisible:
          actor.nameplate.mesh.isEnabled() && actor.nameplate.mesh.isVisible,
        petVisible:
          !!actor.companionLabel?.mesh.isEnabled() &&
          !!actor.companionLabel?.mesh.isVisible,
      })),
      heroLegMotion: players.get(selfId)?.trainer.legMotion,
      movementSpeed: Math.hypot(velocity.x, velocity.z),
      jumpHeight: jump,
      targetId,
      cameraCollision: cameraCollision!.metrics(),
    }),
  });
  const presentationObserver = scene.onBeforeCameraRenderObservable.add(
    (activeCamera) => {
      if (activeCamera !== camera || !playing) return;
      const self = players.get(selfId);
      if (!self) return;
      const trainerVisibility = bodyVisibility(camera.radius, 2.4, 3.8);
      for (const mesh of self.trainer.meshes)
        mesh.visibility = trainerVisibility;
      if (self.companion) {
        const center = self.companion.root.position.add(new Vector3(0, 0.8, 0));
        const distance = Vector3.Distance(camera.globalPosition, center);
        const companionVisibility = Math.min(
          bodyVisibility(distance, 1.8, 3),
          trainerVisibility,
        );
        for (const mesh of self.companion.meshes)
          mesh.visibility = companionVisibility;
      }
    },
  );
  const keys = new Set<string>();
  const wildHitColor = new Color3(1, 0.8, 0.5);
  const companionHitColor = new Color3(1, 0.3, 0.15);
  const gold = new StandardMaterial("selection gold", scene);
  gold.diffuseColor = Color3.FromHexString("#efdc94");
  gold.emissiveColor = gold.diffuseColor.scale(0.5);
  gold.specularColor = Color3.Black();
  const selection = MeshBuilder.CreateTorus(
    "selected target",
    { diameter: 2.8, thickness: 0.07, tessellation: 48 },
    scene,
  );
  selection.material = gold;
  selection.isPickable = false;
  selection.setEnabled(false);
  const combatEffects = createCombatEffects(scene, (event) => {
    if (
      event.actor === "hero" &&
      event.type === "attack" &&
      event.amount === undefined
    )
      return;
    const hit = landed(event.outcome ?? "hit");
    const victim = targets.get(event.target ?? "");
    if (hit && victim && victim.view.hp > 0) {
      victim.visual.animate("hit");
      victim.holdUntil = time + 0.22;
      victim.hitUntil = time + 0.12;
    }
    const hero = players.get(event.target ?? "");
    if (hit && hero && event.type === "hit") {
      hero.trainer.action("hit");
      hero.hitUntil = time + 0.12;
    }
    combatText(event);
    if (event.source === selfId || event.target === selfId) {
      const crit = event.outcome === "crit";
      if (hit) shake = Math.max(shake, crit ? 1 : event.auto ? 0.25 : 0.45);
      if (crit && event.source === selfId && !settings.reducedMotion)
        hitstopUntil = time + 0.07;
    }
    callbacks.onImpact?.(event);
  });
  const AVOIDED: Partial<Record<Outcome, string>> = {
    miss: "Miss",
    dodge: "Dodge",
    parry: "Parry",
    evade: "Evade",
    immune: "Immune",
  };
  /** Floating numbers for your own damage, healing and anything that hits you. */
  function combatText(event: GameEvent) {
    const wild = targets.get(event.target ?? "");
    const root =
      wild?.visual.root ?? players.get(event.target ?? "")?.trainer.root;
    if (!root || root.isDisposed()) return;
    const mine = event.source === selfId,
      incoming = event.target === selfId && !mine;
    if (!mine && !incoming && !(event.heal && event.target === selfId)) return;
    const height = wild
      ? wild.view.boss
        ? 5.6
        : wild.view.elite
          ? 2.9
          : 2.1
      : 2.2;
    const at = root.position.add(new Vector3(0, height, 0));
    const outcome = event.outcome ?? "hit";
    const avoided = AVOIDED[outcome];
    if (avoided) {
      overlay.float(at, avoided, "avoid", {
        small: event.actor === "companion",
      });
      return;
    }
    const amount = event.amount ?? 0;
    if (!amount) return;
    const crit = outcome === "crit";
    if (event.heal) overlay.float(at, `+${amount}`, "heal", { crit });
    else if (incoming)
      overlay.float(
        at,
        `-${amount}${outcome === "block" ? " (Block)" : ""}`,
        "incoming",
        { crit },
      );
    else {
      const kind: FloatKind =
        event.type === "dot"
          ? "dot"
          : event.actor === "companion"
            ? "pet"
            : event.auto
              ? "auto"
              : "damage";
      overlay.float(at, crit ? `${amount}!` : String(amount), kind, {
        crit,
        small: kind === "pet" || kind === "dot",
      });
    }
  }
  const blocked = () =>
    !!document.querySelector(
      'dialog[open],.modal-overlay,.modal-backdrop,[role="dialog"],[data-menu-open="true"]',
    ) ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(
      document.activeElement?.tagName || "",
    );
  function disposeVisual(
    actor: { meshes: AbstractMesh[]; dispose: () => void } | undefined,
  ) {
    if (!actor) return;
    for (const mesh of actor.meshes) shadows.removeShadowCaster(mesh);
    actor.dispose();
  }
  function addShadow(meshes: AbstractMesh[]) {
    for (const mesh of meshes) shadows.addShadowCaster(mesh);
  }
  function setWild(view: WildView) {
    let actor = targets.get(view.id);
    if (!actor) {
      const visual = isTraining(view)
        ? createTrainingDummy(scene, view.id)
        : creatures.create(
            view.boss ? "Yeti" : SPECIES_MODELS[view.species],
            view.id,
            view.boss
              ? 5.2
              : view.elite
                ? 2.2
                : (POKEMON[view.species]?.modelScale ?? 1.45),
          );
      visual.root.position.set(view.x, terrainHeight(view.x, view.z), view.z);
      addShadow(visual.meshes);
      actor = {
        visual,
        view,
        lastHp: view.hp,
        holdUntil: 0,
        hitUntil: 0,
      };
      targets.set(view.id, actor);
    }
    if (view.hp === 0 && actor.lastHp > 0)
      actor.holdUntil = Math.max(time, actor.impactAt ?? 0) + 2;
    if (view.hp > 0) actor.defeatStarted = false;
    actor.lastHp = view.hp;
    actor.view = view;
    return actor;
  }
  for (const spawn of SPAWNS.filter((s) => Math.hypot(s.x, s.z) < 100))
    setWild({
      ...spawn,
      hp: 100,
      maxHp: 100,
      elite: !!spawn.elite,
      boss: !!spawn.boss,
      phase: 1,
      state: "idle",
    });
  const showcase = creatures.create("Bulbasaur", "title-spriglet", 1.3);
  showcase.root.position.set(17, terrainHeight(17, -14), -14);
  showcase.root.rotation.y = Math.PI - 0.6;
  addShadow(showcase.meshes);
  const showcase2 = creatures.create("Squirtle", "title-brookfin", 1.1);
  showcase2.root.rotation.y = Math.PI;
  showcase2.root.position.set(20, terrainHeight(20, -10), -10);
  addShadow(showcase2.meshes);
  function setPlayer(view: PlayerView) {
    let actor = players.get(view.id);
    if (!actor) {
      actor = {
        restSince: time,
        greetingUntil: 0,
        personalityPhase: personalityPhase(view.id),
        nameHeight: 2.28,
        trainer: trainers.create(
          view.id,
          view.id === selfId,
          view.classId,
          normalizeAppearance(view.appearance),
        ),
        nameplate: createWorldLabel(scene, view.nickname, 3.3, {
          distance: 60,
          color: "#ffffff",
        }),
        view,
        holdUntil: 0,
        hitUntil: 0,
      };
      actor.trainer.root.position.set(
        view.x,
        terrainHeight(view.x, view.z),
        view.z,
      );
      addShadow(actor.trainer.meshes);
      players.set(view.id, actor);
    }
    if (
      actor.view.classId !== view.classId ||
      appearanceKey(actor.view.appearance) !== appearanceKey(view.appearance)
    ) {
      disposeVisual(actor.trainer);
      actor.trainer = trainers.create(
        view.id,
        view.id === selfId,
        view.classId,
        normalizeAppearance(view.appearance),
      );
      actor.trainer.root.position.set(
        view.x,
        terrainHeight(view.x, view.z),
        view.z,
      );
      addShadow(actor.trainer.meshes);
    }
    if (
      view.emote &&
      view.emote !== actor.view.emote &&
      ["hello", "cheer"].includes(view.emote)
    )
      actor.greetingUntil = time + 3.5;
    actor.view = view;
    const appearance = normalizeAppearance(view.appearance);
    actor.nameHeight = RACES[appearance.race].height * appearance.height + 0.38;
    const phrases: Record<string, string> = {
      hello: "Hello!",
      cheer: "You can do it!",
      thanks: "Thank you!",
      ready: "Ready!",
    };
    actor.nameplate.update(
      view.emote
        ? `${view.nickname}: ${phrases[view.emote] || view.emote}`
        : view.nickname,
    );
    actor.nameplate.mesh.setEnabled(true);
    const key = `${view.companion}:${view.companionEvolved}`;
    if (actor.companionKey !== key) {
      disposeVisual(actor.companion);
      actor.companionLabel?.dispose();
      actor.companionLabel = undefined;
      actor.companion = undefined;
      actor.companionKey = key;
      if (view.companion) {
        actor.companion = creatures.create(
          view.companionEvolved
            ? EVOLVED_MODELS[view.companion] || SPECIES_MODELS[view.companion]
            : SPECIES_MODELS[view.companion],
          `companion:${view.id}`,
          POKEMON[view.companion]?.modelScale ??
            (view.companionEvolved ? 1.6 : 1.1),
        );
        actor.companion.root.position
          .copyFrom(actor.trainer.root.position)
          .addInPlace(new Vector3(1.8, 0, -1));
        addShadow(actor.companion.meshes);
        actor.companionLabel = createWorldLabel(scene, "", 3.4, {
          distance: 45,
          color: "#5ce1ff",
        });
      }
    }
    actor.companionLabel?.update(
      `${view.companionName || SPECIES[view.companion ?? ""]?.name || "Companion"} · Lv ${view.companionLevel}`,
      `${view.nickname}’s companion`,
    );
    return actor;
  }
  /** Tab targeting: enemies in front of the camera first, then by distance, cycling through recent picks. */
  function cycleTarget(reverse: boolean) {
    const facing = new Vector3(
      -Math.cos(camera.alpha),
      0,
      -Math.sin(camera.alpha),
    );
    const candidates = [...targets.values()]
      .filter((actor) => actor.view.hp > 0)
      .map((actor) => {
        const dx = actor.view.x - position.x,
          dz = actor.view.z - position.z,
          d = Math.hypot(dx, dz);
        const ahead = (dx * facing.x + dz * facing.z) / Math.max(0.01, d);
        return { id: actor.view.id, d, score: d + (ahead < 0.2 ? 30 : 0) };
      })
      .filter((c) => c.d < 32)
      .sort((a, b) => a.score - b.score)
      .map((c) => c.id);
    if (!candidates.length) return;
    if (time - lastTab > 2.5) recentTabs.length = 0;
    lastTab = time;
    const order = reverse ? [...candidates].reverse() : candidates;
    let next = order.find((id) => id !== targetId && !recentTabs.includes(id));
    if (!next) {
      recentTabs.length = 0;
      next = order.find((id) => id !== targetId) ?? order[0];
    }
    recentTabs.push(next);
    callbacks.onTarget(next);
  }
  const ability = (slot: number) => callbacks.onAbility(slot);
  const bind = (action: string, fallback: string) =>
    settings.keybinds?.[action]?.toLowerCase() || fallback;
  const orbitHeld = (key: string) =>
    keys.has(key) &&
    !Object.values(settings.keybinds ?? {}).some((value) =>
      [key, `key${key}`].includes(value.toLowerCase()),
    );
  function requestDash() {
    const self = players.get(selfId),
      now = serverTime + (time - receivedTime) * 1000;
    if (
      !playing ||
      blocked() ||
      !self ||
      self.view.hp <= 0 ||
      (self.view.stunUntil ?? 0) > now ||
      (self.view.cooldowns?.dash ?? 0) > now ||
      (predictedDash?.until ?? 0) > now
    )
      return;
    predictedDash = {
      x: Math.sin(yaw),
      z: Math.cos(yaw),
      startedAt: now,
      until: now + DASH.duration,
    };
    self.trainer.cancel();
    self.trainer.action("dash");
    combatEffects.dash(
      self.trainer.root.position,
      self.view.classId ?? "knight",
    );
    callbacks.onDash(predictedDash.x, predictedDash.z);
  }
  function keydown(event: KeyboardEvent) {
    if (!playing || blocked()) return;
    const key = event.key.toLowerCase();
    keys.add(key);
    keys.add(event.code.toLowerCase());
    if (
      [" ", "tab", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(
        key,
      )
    )
      event.preventDefault();
    if (event.repeat) return;
    const matches = (action: string, fallback: string) =>
      [key, event.code.toLowerCase()].includes(bind(action, fallback));
    if (matches("interact", "e")) callbacks.onInteract();
    else if (matches("tame", "f")) callbacks.onTame();
    else if (key === "tab") cycleTarget(event.shiftKey);
    else if (key === "t" && targetId) callbacks.onAutoAttack?.(targetId);
    else if (key === " ") requestDash();
    else if (key === "alt" && jump === 0) {
      event.preventDefault();
      jumpVelocity = 5;
      callbacks.onJump?.();
    } else if (/^[1-6]$/.test(key)) ability(Number(key) - 1);
  }
  function keyup(event: KeyboardEvent) {
    keys.delete(event.key.toLowerCase());
    keys.delete(event.code.toLowerCase());
  }
  function blur() {
    keys.clear();
    velocity = { x: 0, z: 0 };
    if (playing) callbacks.onMove(0, 0, false, yaw);
  }
  function pick(x: number, y: number, attack = false) {
    const bounds = canvas.getBoundingClientRect();
    const result = scene.pick(
      x - bounds.left,
      y - bounds.top,
      (mesh) => !!mesh.metadata?.target,
    );
    const id = result?.pickedMesh?.metadata?.target;
    if (id && id !== selfId && !id.startsWith("companion:")) {
      callbacks.onTarget(id);
      if (attack && targets.has(id)) callbacks.onAutoAttack?.(id);
    }
  }
  const controls = createCameraControls(
    canvas,
    camera,
    () => playing && !blocked(),
    pick,
  );
  const resize = () => engine.resize();
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", blur);
  window.addEventListener("resize", resize);

  engine.runRenderLoop(() => {
    if (disposed) return;
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    time += dt;
    scene.animationTimeScale = time < hitstopUntil ? 0.08 : 1;
    const reduced = !!settings.reducedMotion;
    controls.update(dt, orbitHeld("q"), orbitHeld("r"));
    const sharedNow = serverTime + (time - receivedTime) * 1000;
    const daylight = (Math.sin((sharedNow / 1200000) * Math.PI * 2) + 1) / 2;
    sun.position.set(
      (playing ? position.x : -6) + 33,
      60,
      (playing ? position.z : -10) - 21,
    );
    sun.intensity = 1.6 + daylight * 0.2;
    hemi.intensity = 0.62 + daylight * 0.06;
    sun.diffuse = Color3.Lerp(
      new Color3(0.72, 0.81, 1),
      new Color3(1, 0.9, 0.71),
      daylight,
    );
    scene.fogColor = Color3.Lerp(
      new Color3(0.6, 0.77, 0.8),
      new Color3(0.72, 0.85, 0.82),
      daylight,
    );
    environment.update(time, reduced);
    if (playing) {
      let dx = 0,
        dz = 0;
      const self = players.get(selfId);
      const active = !blocked() && (!self || heroCanWalk(self.view));
      if (!active) keys.clear();
      const held = (action: string, key: string, arrow: string) =>
        keys.has(bind(action, key)) || keys.has(arrow);
      const forward =
        Number(held("forward", "w", "arrowup")) -
        Number(held("backward", "s", "arrowdown"));
      const right =
        Number(held("right", "d", "arrowright")) -
        Number(held("left", "a", "arrowleft"));
      if (active && (forward || right)) {
        const f = new Vector3(
          -Math.cos(camera.alpha),
          0,
          -Math.sin(camera.alpha),
        );
        const r = new Vector3(f.z, 0, -f.x);
        const input = f.scale(forward).add(r.scale(right)).normalize();
        dx = input.x;
        dz = input.z;
        yaw = Math.atan2(dx, dz);
      }
      const sprint = keys.has(bind("sprint", "shift"));
      const pace = movementScale(
        self?.view.stunUntil,
        self?.view.slowUntil,
        sharedNow,
      );
      const speed = (sprint ? WORLD.sprint : WORLD.speed) * pace;
      const previous = position;
      if (predictedDash && predictedDash.until <= sharedNow)
        predictedDash = undefined;
      const dash = predictedDash ?? self?.view.dash;
      const next =
        dash && dash.until > sharedNow
          ? dashStep(
              position,
              dash,
              Math.min(dt, (dash.until - sharedNow) / 1000),
              collisionCreatures,
            )
          : moveAmongCreatures(
              position.x,
              position.z,
              dx * speed * dt,
              dz * speed * dt,
              collisionCreatures,
            );
      position = guest ? guestStep(position, next) : next;
      if (guest && (position.x !== next.x || position.z !== next.z))
        callbacks.onBoundary?.();
      velocity.x = (position.x - previous.x) / Math.max(0.001, dt);
      velocity.z = (position.z - previous.z) / Math.max(0.001, dt);
      if (
        active &&
        (self?.view.hp ?? 0) > 0 &&
        keys.has("1") &&
        time >= nextHeldAttack
      ) {
        callbacks.onAbility(0, true);
        nextHeldAttack = time + 0.12;
      }
      if (jump === 0) {
        stepDistance += distance(position, previous);
        if (stepDistance > (sprint ? 1.9 : 1.6)) {
          stepDistance = 0;
          callbacks.onStep?.(position, false, sprint);
        }
      }
      if (time - lastSend > 0.05) {
        callbacks.onListener?.(position, camera.alpha);
        callbacks.onMove(dx, dz, sprint, yaw);
        lastSend = time;
      }
      if (jumpVelocity || jump) {
        jumpVelocity -= dt * 13;
        jump = Math.max(0, jump + jumpVelocity * dt);
        if (jump === 0) {
          jumpVelocity = 0;
          callbacks.onStep?.(position, true, sprint);
        }
      }
      if (self) {
        self.trainer.root.position.set(
          position.x,
          terrainHeight(position.x, position.z) + jump,
          position.z,
        );
        const aim = targets.get(self.attackTarget ?? "")?.visual.root.position;
        if (aim && time < (self.heroAimUntil ?? 0) && Math.hypot(dx, dz) < 0.1)
          yaw = Math.atan2(aim.x - position.x, aim.z - position.z);
        self.trainer.root.rotation.y = turnTowards(
          self.trainer.root.rotation.y,
          yaw,
          dt,
        );
        self.trainer.animate(
          time,
          Math.hypot(velocity.x, velocity.z) > 0.08,
          reduced,
          sprint,
          Math.hypot(velocity.x, velocity.z),
          jump,
          jumpVelocity,
          heroCanWalk(self.view),
        );
      }
      const focal = new Vector3(
        position.x + velocity.x * 0.035,
        terrainHeight(position.x, position.z) + 1.4,
        position.z + velocity.z * 0.035,
      );
      followCameraTarget(camera, focal, dt);
      camera.fov +=
        ((sprint && Math.hypot(velocity.x, velocity.z) > 1 && !reduced
          ? 0.84
          : 0.8) -
          camera.fov) *
        (1 - Math.exp(-dt * 5));
      cameraCollision!.update(time, dt);
      shake = Math.max(0, shake - dt * 4.5);
      if (settings.cameraShake && !reduced && shake > 0) {
        camera.target.x += Math.sin(time * 91) * 0.09 * shake * shake;
        camera.target.y += Math.sin(time * 67 + 1.3) * 0.06 * shake * shake;
      }
    } else {
      camera.alpha = -0.65 + (reduced ? 0 : Math.sin(time * 0.045) * 0.035);
      camera.beta = 1.24;
      camera.radius = 42;
      camera.target.set(-6, 1.8, -10);
    }
    if (overview) {
      camera.target.set(
        overview.x,
        terrainHeight(overview.x, overview.z) + 0.6,
        overview.z,
      );
      camera.radius = overview.radius;
      camera.alpha = overview.alpha ?? -Math.PI / 2;
      camera.beta = overview.beta ?? 0.82;
    }
    for (const actor of targets.values()) {
      const { view, visual } = actor;
      if (
        view.hp === 0 &&
        !actor.defeatStarted &&
        time >= (actor.impactAt ?? 0)
      ) {
        actor.defeatStarted = true;
        visual.animate("defeat");
      }
      const self = players.get(selfId)?.view;
      const shown =
        playing &&
        view.hp > 0 &&
        (view.id === targetId ||
          view.target === selfId ||
          Vector3.Distance(visual.root.position, camera.target) < 22);
      overlay.plate(
        view.id,
        visual.root.position.add(
          new Vector3(0, view.boss ? 6.2 : view.elite ? 3.2 : 2.45, 0),
        ),
        shown
          ? {
              name: isTraining(view)
                ? (TRAINING_TARGETS.find((t) => t.id === view.id)?.name ??
                  "Training dummy")
                : view.boss
                  ? "Stormheart"
                  : SPECIES[view.species].name,
              level: view.level,
              difficulty: difficulty(view.level, self?.level ?? 1),
              hp: view.hp,
              maxHp: view.maxHp,
              reaction:
                isTraining(view) || SPECIES[view.species].companion
                  ? "neutral"
                  : "hostile",
              rank: view.boss ? "boss" : view.elite ? "elite" : "normal",
              targeted: view.id === targetId,
              aggro: view.target === selfId,
              evading: !!view.evading,
              cast:
                view.cast && view.cast.resolvesAt > sharedNow
                  ? {
                      name: view.cast.name ?? "Attack",
                      interruptible: !!view.cast.interruptible,
                      progress: Math.min(
                        1,
                        Math.max(
                          0,
                          (sharedNow - (view.cast.startedAt ?? sharedNow)) /
                            Math.max(
                              1,
                              view.cast.resolvesAt -
                                (view.cast.startedAt ?? sharedNow),
                            ),
                        ),
                      ),
                    }
                  : undefined,
            }
          : undefined,
      );
      const spell =
        view.hp > 0 && view.cast?.spell && view.cast.resolvesAt > sharedNow
          ? view.cast
          : undefined;
      combatEffects.charge(
        `wild:${view.id}`,
        visual.root.position,
        spell?.ability,
        spell
          ? Math.min(
              1,
              (sharedNow - (spell.startedAt ?? sharedNow)) /
                Math.max(1, spell.resolvesAt - (spell.startedAt ?? sharedNow)),
            )
          : 0,
      );
      for (const mesh of visual.meshes) {
        if ("renderOverlay" in mesh) {
          mesh.renderOverlay = time < actor.hitUntil;
          mesh.overlayColor = wildHitColor;
          mesh.overlayAlpha = 0.5;
        }
      }

      const destination = new Vector3(
        view.x,
        terrainHeight(view.x, view.z),
        view.z,
      );
      const delta = destination.subtract(visual.root.position);
      if (delta.lengthSquared() > 0.02)
        visual.root.rotation.y = turnTowards(
          visual.root.rotation.y,
          Math.atan2(delta.x, delta.z),
          dt,
        );
      const focus = view.target
        ? players.get(view.target)?.trainer.root.position
        : undefined;
      if (view.cast?.yaw !== undefined) visual.root.rotation.y = view.cast.yaw;
      else if (focus && view.state === "attack")
        visual.root.rotation.y = Math.atan2(focus.x - view.x, focus.z - view.z);
      visual.root.position = Vector3.Lerp(
        visual.root.position,
        destination,
        1 - Math.exp(-dt * 9),
      );
      visual.setDetail(Vector3.Distance(camera.position, visual.root.position));
      alignPokemon(visual.root, view.species, dt);
      if (
        view.shiny &&
        Math.floor(time * 2) !== Math.floor((time - dt) * 2) &&
        Vector3.DistanceSquared(camera.position, visual.root.position) < 1600
      )
        combatEffects.cast(
          { type: "pet-cast", ability: "pk-thunder-shock", message: "Shiny" },
          visual.root.position,
          visual.root.position,
          "spark",
          undefined,
          0,
          0.6,
        );
      visual.root.setEnabled(view.hp > 0 || time < actor.holdUntil);
      const charging =
        view.cast?.charge && sharedNow >= view.cast.resolvesAt - 250;
      if (time > actor.holdUntil && view.hp > 0)
        visual.animate(
          view.activity === "sleep"
            ? "sleep"
            : view.activity === "feed" || view.activity === "drink"
              ? "idle-variant"
              : charging
                ? "run"
                : view.state === "attack"
                  ? "attack"
                  : view.state === "chase" ||
                      view.state === "roam" ||
                      view.state === "retreat"
                    ? "move"
                    : "idle",
          charging
            ? 0.22
            : view.cast
              ? (view.cast.resolvesAt - (view.cast.startedAt ?? sharedNow)) /
                1000
              : delta.lengthSquared() > 0.02
                ? Math.max(
                    0.3,
                    Math.min(1.5, 0.9 / Math.max(0.1, delta.length() * 9)),
                  )
                : undefined,
        );
    }
    for (const [id, actor] of players) {
      const root = actor.trainer.root;
      for (const mesh of actor.trainer.meshes) {
        mesh.renderOverlay = time < actor.hitUntil;
        mesh.overlayColor = companionHitColor;
        mesh.overlayAlpha = 0.35;
      }
      actor.nameplate.mesh.position.set(
        root.position.x,
        root.position.y + actor.nameHeight,
        root.position.z,
      );
      overlay.anchorBubble(
        id,
        root.position.x,
        root.position.y + actor.nameHeight + 0.35,
        root.position.z,
      );
      if (id !== selfId) {
        root.position = Vector3.Lerp(
          root.position,
          new Vector3(
            actor.view.x,
            terrainHeight(actor.view.x, actor.view.z),
            actor.view.z,
          ),
          1 - Math.exp(-dt * 10),
        );
        root.rotation.y = turnTowards(root.rotation.y, actor.view.yaw, dt);
        actor.trainer.animate(
          time,
          actor.view.moving,
          reduced,
          false,
          undefined,
          0,
          0,
          heroCanWalk(actor.view),
        );
      }
      if (actor.companion) {
        const companion = actor.companion;
        companion.root.setEnabled(time >= (actor.cinematicUntil ?? 0));
        actor.companionLabel?.mesh.setEnabled(companion.root.isEnabled());
        actor.companionLabel?.mesh.position
          .copyFrom(companion.root.position)
          .addInPlace(
            new Vector3(
              0,
              (POKEMON[actor.view.companion ?? ""]?.modelScale ?? 1.3) + 0.45,
              0,
            ),
          );
        const desired = root.position.add(
          new Vector3(
            -Math.cos(root.rotation.y) * 1.7,
            0,
            -Math.sin(root.rotation.y) * 1.7,
          ),
        );
        const petEnemy = actor.view.petTarget
          ? targets.get(actor.view.petTarget)
          : undefined;
        if (actor.view.pet)
          desired.set(
            actor.view.pet.x,
            terrainHeight(actor.view.pet.x, actor.view.pet.z),
            actor.view.pet.z,
          );
        if (!actor.view.pet && petEnemy && petEnemy.view.hp > 0) {
          desired.copyFrom(petEnemy.visual.root.position);
          desired.x -= 3.5;
          desired.z -= 2;
        }
        const distance = Vector3.Distance(companion.root.position, desired);
        const diff = desired.subtract(companion.root.position);
        if (distance > 0.08 && (actor.view.pet?.hp ?? 1) > 0) {
          const speed = Math.min(12, 3 + distance * 2) * dt;
          const step = diff.normalize().scale(Math.min(distance, speed));
          const next = moveWithCollision(
            companion.root.position.x,
            companion.root.position.z,
            step.x,
            step.z,
          );
          companion.root.position.set(
            next.x,
            terrainHeight(next.x, next.z),
            next.z,
          );
          companion.root.rotation.y = turnTowards(
            companion.root.rotation.y,
            Math.atan2(step.x, step.z),
            dt,
          );
          if (distance > 12)
            companion.root.position = Vector3.Lerp(
              companion.root.position,
              desired,
              dt * 3,
            );
        }
        if (time < actor.holdUntil && actor.attackTarget) {
          const facing =
            targets.get(actor.attackTarget)?.visual.root ??
            players.get(actor.attackTarget)?.trainer.root;
          if (facing)
            companion.root.rotation.y = Math.atan2(
              facing.position.x - companion.root.position.x,
              facing.position.z - companion.root.position.z,
            );
        }
        alignPokemon(companion.root, actor.view.companion!, dt);
        const moving = !!actor.view.pet?.moving || distance > 0.7;
        if (moving || actor.view.moving || actor.view.inCombat)
          actor.restSince = time;
        const mood = companionMood({
          temperament:
            POKEMON[actor.view.companion ?? ""]?.temperament ?? "curious",
          phase: actor.personalityPhase,
          time,
          restingFor: time - actor.restSince,
          moving,
          inCombat: !!actor.view.inCombat || !!actor.view.duelId,
          fainted: (actor.view.pet?.hp ?? actor.view.hp) === 0,
          greeting: time < actor.greetingUntil,
        });
        actor.mood = mood;
        if (mood === "celebrate" && !moving)
          companion.root.rotation.y = turnTowards(
            companion.root.rotation.y,
            Math.atan2(
              root.position.x - companion.root.position.x,
              root.position.z - companion.root.position.z,
            ),
            dt,
          );
        if (time > actor.holdUntil)
          companion.animate(
            mood === "defeat"
              ? mood
              : moving
                ? distance > 3
                  ? "run"
                  : "move"
                : mood,
            moving
              ? Math.max(0.28, Math.min(1.2, 0.9 / Math.max(1, distance * 4)))
              : undefined,
          );
      }
    }
    const target =
      targets.get(targetId || "")?.visual.root ||
      players.get(targetId || "")?.trainer.root;
    selection.setEnabled(playing && !!target);
    if (target) {
      selection.position.set(
        target.position.x,
        terrainHeight(target.position.x, target.position.z) + 0.14,
        target.position.z,
      );
      selection.rotation.y = time * 0.4;
    }
    for (const [id, actor] of players) {
      const cast = actor.view.cast;
      const charging =
        cast &&
        !cast.released &&
        cast.releasesAt > sharedNow &&
        ["meteor", "firebolt", "frostbolt"].includes(cast.ability);
      combatEffects.charge(
        id,
        actor.trainer.root.position,
        charging ? cast.ability : undefined,
        charging
          ? Math.min(
              1,
              (sharedNow - cast.startedAt) / (cast.releasesAt - cast.startedAt),
            )
          : 0,
      );
    }
    combatEffects.update(dt, reduced);
    overlay.update(dt);
    for (const [id, actor] of targets) {
      const cast =
        playing &&
        actor.view.cast &&
        !actor.view.cast.spell &&
        distance(actor.view.cast, position) < 28
          ? actor.view.cast
          : undefined;
      if (cast && !threats.has(id)) threats.set(id, createThreatMarker(scene));
      threats.get(id)?.update(cast, serverTime + (time - receivedTime) * 1000);
    }
    scene.render();
    frameMs.push(engine.getDeltaTime());
    if (frameMs.length > 600) frameMs.shift();
  });
  await scene.whenReadyAsync();
  await new Promise<void>((resolve) =>
    scene.onAfterRenderObservable.addOnce(() => resolve()),
  );
  return {
    dash: requestDash,
    setSnapshot(value, id) {
      collisionCreatures = value.wilds;
      serverTime = value.time;
      receivedTime = time;
      selfId = id;
      const visibleWilds = new Set(value.wilds.map((w) => w.id));
      for (const [id, actor] of targets)
        if (!visibleWilds.has(id)) {
          disposeVisual(actor.visual);
          overlay.remove(id);
          combatEffects.charge(`wild:${id}`, Vector3.Zero(), undefined, 0);
          targets.delete(id);
          threats.get(id)?.dispose();
          threats.delete(id);
        }
      for (const view of value.wilds) setWild(view);
      const ids = new Set(value.players.map((v) => v.id));
      for (const view of value.players) {
        setPlayer(view);
        if (view.id === selfId) {
          if (view.hp <= 0) predictedDash = undefined;
          const error = Math.hypot(position.x - view.x, position.z - view.z);
          if (error > 3 || !playing) position = { x: view.x, z: view.z };
          else if (error > 0.35) {
            position.x += (view.x - position.x) * 0.15;
            position.z += (view.z - position.z) * 0.15;
          }
        }
      }
      for (const [pid, actor] of players)
        if (!ids.has(pid)) {
          actor.nameplate.dispose();
          actor.companionLabel?.dispose();
          disposeVisual(actor.trainer);
          disposeVisual(actor.companion);
          combatEffects.charge(pid, Vector3.Zero(), undefined, 0);
          overlay.removeBubble(pid);
          players.delete(pid);
        }
    },
    setProfile(value) {
      guest = isGuest(value);
      storyWorld.setProfile(value);
      const active = value.creatures.find(
        (creature) => creature.id === value.active,
      );
      if (active?.hp === 0) players.get(selfId)?.companion?.animate("defeat");
    },
    setOverview(center, radius) {
      overview = { ...center, radius };
      camera.upperRadiusLimit = Math.max(60, radius);
    },
    setPlaying(value) {
      if (value === playing) return;
      playing = value;
      showcase.root.setEnabled(!value);
      showcase2.root.setEnabled(!value);
      keys.clear();
      camera.upperRadiusLimit = value ? 24 : 60;
      if (value) {
        camera.radius = 9.5;
        cameraCollision!.reset(9.5);
        camera.alpha = -Math.PI / 2;
        camera.beta = 1.16;
        camera.target.set(position.x, 1.7, position.z);
      } else {
        camera.target.set(-2, 2, -17);
      }
    },
    setTarget(id) {
      targetId = id;
    },
    setSettings(value) {
      settings = { ...settings, ...value };
      const low = settings.quality === "low";
      engine.setHardwareScalingLevel(
        low ? 1.7 : settings.quality === "high" ? 1 : 1.2,
      );
      shadows.getShadowMap()?.resize(low ? 512 : 2048);
      shadows.setDarkness(low ? 0.3 : 0.2);
      pipeline.bloomEnabled = !low;
      environment.setQuality(low);
      controls.setSensitivity(settings.sensitivity ?? 1);
    },
    getPosition() {
      return { ...position };
    },
    predictAbility(ability) {
      const self = players.get(selfId);
      if (!self || self.view.hp <= 0) return;
      predicted = { ability, at: time };
      self.trainer.action("attack", ability);
      if (targetId && !ABILITIES[ability]?.aoeSelf) {
        self.attackTarget = targetId;
        self.heroAimUntil = time + 1.2;
      }
    },
    celebrate() {
      const self = players.get(selfId);
      if (!self) return;
      combatEffects.levelUp(self.trainer.root.position);
      self.companion?.animate("celebrate");
      self.holdUntil = time + 1.5;
    },
    floatSelf(text, kind) {
      const self = players.get(selfId);
      if (self)
        overlay.float(
          self.trainer.root.position.add(new Vector3(0, 2.5, 0)),
          text,
          kind,
        );
    },
    say(playerId, text, ms) {
      overlay.say(playerId, text, ms);
    },
    cancelPrediction() {
      if (!predicted || time - predicted.at > 0.8) return;
      predicted = undefined;
      players.get(selfId)?.trainer.cancel();
    },
    handleEvent(event) {
      const player = players.get(event.source ?? "");
      const wild = targets.get(event.source ?? "");
      const early =
        event.source === selfId &&
        event.actor === "hero" &&
        !!predicted &&
        predicted.ability === event.ability &&
        time - predicted.at < 0.8;
      if (early) predicted = undefined;
      const victimRoot =
        targets.get(event.target ?? "")?.visual.root ??
        players.get(event.target ?? "")?.trainer.root;
      if (event.type === "evolution" && event.evolution && player) {
        const position = (
          player.companion?.root.position ?? player.trainer.root.position
        ).clone();
        player.cinematicUntil = time + 3.2;
        const before = creatures.create(
          SPECIES_MODELS[event.evolution.from],
          "evolution-before",
          POKEMON[event.evolution.from].modelScale,
        );
        const after = creatures.create(
          SPECIES_MODELS[event.evolution.to],
          "evolution-after",
          POKEMON[event.evolution.to].modelScale,
        );
        before.root.position.copyFrom(position);
        after.root.position.copyFrom(position);
        after.root.setEnabled(false);
        const baseBefore = before.root.scaling.clone(),
          baseAfter = after.root.scaling.clone();
        combatEffects.evolve(
          position,
          (t) => {
            before.root.setEnabled(t < 0.62);
            after.root.setEnabled(t >= 0.62);
            const actor = t < 0.62 ? before : after,
              scale = t < 0.62 ? baseBefore : baseAfter;
            actor.root.scaling
              .copyFrom(scale)
              .scaleInPlace(
                t < 0.62
                  ? 1 + t * 0.5
                  : 1 + Math.sin(((t - 0.62) / 0.38) * Math.PI) * 0.1,
              );
            actor.root.rotation.y = t * Math.PI * 2;
            for (const mesh of actor.meshes) {
              mesh.renderOverlay = t < 0.7;
              mesh.overlayColor = Color3.FromHexString("#e8ffe4");
              mesh.overlayAlpha = 0.85;
            }
            actor.animate(t > 0.7 ? "celebrate" : "idle");
          },
          () => {
            before.dispose();
            after.dispose();
          },
        );
        return;
      }
      if (event.type === "pet-cast" && player?.companion) {
        player.companion.animate(
          POKEMON_MOVES[event.ability ?? ""]?.animation ?? "attack",
        );
        player.holdUntil = time + 0.8;
        combatEffects.cast(
          event,
          player.companion.root.position.clone(),
          victimRoot?.position.clone() ??
            player.companion.root.position.clone(),
          SPECIES[player.view.companion!].element,
          undefined,
          0,
          POKEMON[player.view.companion!]?.modelScale ?? 1,
        );
        return;
      }
      if (["pet-hit", "pet-faint", "pet-heal"].includes(event.type)) {
        const owner = players.get(
          event.type === "pet-heal"
            ? (event.source ?? "")
            : (event.target ?? ""),
        );
        if (owner?.companion) {
          owner.companion.animate(
            event.type === "pet-faint"
              ? "defeat"
              : event.type === "pet-hit"
                ? "hit"
                : "celebrate",
          );
          owner.holdUntil = time + (event.type === "pet-faint" ? 4 : 0.5);
          overlay.float(
            owner.companion.root.position.add(new Vector3(0, 2, 0)),
            event.type === "pet-faint"
              ? "Fainted"
              : event.amount
                ? `−${event.amount}`
                : event.message,
            "damage",
          );
        }
        return;
      }
      if (event.type === "pet-swap" && player) {
        combatEffects.capture(
          player.companion?.root.position ?? player.trainer.root.position,
          true,
        );
        return;
      }
      if (event.type === "cast" && player) {
        if (!early) player.trainer.action("attack", event.ability);
        player.attackTarget = event.target;
        player.heroAimUntil = time + 1.5;
        return;
      }
      if (event.type === "cast-cancel" && player) {
        player.trainer.cancel();
        return;
      }
      if (event.type === "dash" && player) {
        if (event.source === selfId && predictedDash) return;
        player.trainer.action("dash");
        combatEffects.dash(
          player.trainer.root.position,
          player.view.classId ?? "knight",
        );
        return;
      }
      if (event.type === "swing" && player && victimRoot) {
        const motion = player.trainer.busy
          ? undefined
          : player.trainer.action("attack");
        if (motion) {
          player.attackTarget = event.target;
          player.heroAimUntil = time + 0.8;
        }
        const victim = targets.get(event.target ?? "");
        if (victim) victim.impactAt = time + (motion?.impact ?? 0.1);
        combatEffects.swing(
          event,
          player.trainer.root.position.clone(),
          victimRoot.position.clone(),
          () => (victimRoot.isDisposed() ? undefined : victimRoot.position),
          motion?.impact ?? 0.1,
        );
        return;
      }
      if (event.type === "dot") {
        combatText(event);
        return;
      }
      if (event.type === "interrupt" || event.type === "shatter") {
        if (!victimRoot) return;
        if (event.type === "interrupt")
          combatEffects.interrupt(victimRoot.position);
        if (event.source === selfId || event.type === "interrupt")
          overlay.float(
            victimRoot.position.add(new Vector3(0, 2.6, 0)),
            event.type === "interrupt" ? "Interrupted!" : "Shatter!",
            event.type === "interrupt" ? "interrupt" : "shatter",
          );
        return;
      }
      if (event.type === "aggro") {
        if (event.target === selfId && wild)
          overlay.float(
            wild.visual.root.position.add(
              new Vector3(0, wild.view.elite ? 3.3 : 2.5, 0),
            ),
            "!",
            "alert",
          );
        return;
      }
      if (event.type === "heal") {
        if (wild) {
          combatEffects.cast(
            { ...event, type: "attack", ability: "bloom" },
            wild.visual.root.position.clone(),
            wild.visual.root.position.clone(),
            "leaf",
          );
          if (targetId === wild.view.id || wild.view.target === selfId)
            overlay.float(
              wild.visual.root.position.add(new Vector3(0, 2.4, 0)),
              `+${event.amount}`,
              "heal",
            );
        }
        return;
      }
      if (event.heal && event.target === selfId) combatText(event);
      if (player && event.actor === "hero") player.heroAimUntil = time + 0.65;
      if (event.type === "defeat")
        players.get(event.target ?? "")?.trainer.action("defeat");
      const source = player
        ? event.actor === "companion"
          ? player.companion
          : player.trainer
        : wild?.visual;
      const target =
        targets.get(event.target ?? "")?.visual ??
        players.get(event.target ?? "")?.trainer;
      if (
        ((event.type === "attack" && !wild) ||
          event.type === "hit" ||
          event.type === "impact") &&
        source &&
        target
      ) {
        const motion =
          "action" in source &&
          event.type !== "impact" &&
          !early &&
          (event.actor !== "hero" ||
            ["guard", "heal", "evasion"].includes(
              ABILITIES[event.ability ?? ""]?.effect ?? "",
            ))
            ? source.action("attack", event.ability)
            : undefined;
        if (!("action" in source) && event.type !== "impact")
          source.animate("attack");
        const actor = player ?? wild;
        if (actor) {
          actor.holdUntil = time + 0.65;
          actor.attackTarget = event.target;
        }
        if (source !== target)
          source.root.rotation.y = Math.atan2(
            target.root.position.x - source.root.position.x,
            target.root.position.z - source.root.position.z,
          );
        const autoWindup = wild && event.type === "hit" && event.auto ? 0.2 : 0;
        const victim = targets.get(event.target ?? "");
        if (victim)
          victim.impactAt =
            time +
            (event.type === "impact"
              ? 0
              : impactDelay(
                  event.ability,
                  Vector3.Distance(source.root.position, target.root.position),
                  motion?.impact ?? 0,
                  event.actor === "hero",
                ));
        const species = player?.view.companion ?? wild?.view.species;
        combatEffects.cast(
          event,
          source.root.position.clone(),
          event.x !== undefined &&
            event.z !== undefined &&
            ["meteor", "frostbolt"].includes(event.ability ?? "")
            ? new Vector3(event.x, terrainHeight(event.x, event.z), event.z)
            : target.root.position.clone(),
          SPECIES[species ?? ""]?.element ?? "spirit",
          ["meteor", "frostbolt"].includes(event.ability ?? "")
            ? undefined
            : () =>
                target.root.isDisposed() ? undefined : target.root.position,
          motion?.impact ?? autoWindup,
          POKEMON[species ?? ""]?.modelScale ?? 1,
        );
      }
      if (event.type === "reward" && event.amount) {
        const corpse = targets.get(event.target ?? "");
        if (corpse)
          overlay.float(
            corpse.visual.root.position.add(new Vector3(0, 1.6, 0)),
            `+${event.amount} PD`,
            "coin",
          );
      }
      if (event.type === "capture" || event.type === "tame") {
        const captured = targets.get(event.target ?? "");
        if (captured && event.capture) {
          captured.holdUntil = time + event.capture.duration / 1000;
          captured.defeatStarted = true;
          combatEffects.captureSequence(
            players.get(event.source ?? "")?.trainer.root.position ??
              captured.visual.root.position,
            captured.visual.root,
            event,
          );
        } else if (captured)
          combatEffects.capture(
            captured.visual.root.position,
            event.type === "capture",
          );
        if (event.type === "capture") {
          const self = players.get(selfId);
          self?.companion?.animate("celebrate");
          if (self) self.holdUntil = time + 1.5;
        }
      }
    },
    dispose() {
      disposed = true;
      engine.stopRenderLoop();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", resize);
      controls.dispose();
      combatEffects.dispose();
      for (const actor of targets.values()) disposeVisual(actor.visual);
      overlay.dispose();
      for (const actor of players.values()) {
        actor.nameplate.dispose();
        actor.companionLabel?.dispose();
        disposeVisual(actor.trainer);
        disposeVisual(actor.companion);
      }
      showcase.dispose();
      showcase2.dispose();
      creatures.dispose();
      storyWorld.dispose();
      trainers.dispose();
      environment.dispose();
      for (const threat of threats.values()) threat.dispose();
      scene.onBeforeCameraRenderObservable.remove(presentationObserver);
      instrumentation.dispose();
      delete (window as unknown as Record<string, unknown>).__islandMetrics;
      scene.dispose();
      engine.dispose();
    },
  };
}
