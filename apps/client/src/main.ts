import { PLACES } from "../../../packages/shared/data";
import { trainingPanel } from "./ui/practice";
import { TRAINING_TARGETS } from "../../../packages/shared/training";
import { duelReach } from "../../../packages/shared/duel-rules";
import { directionLabel } from "./ui/adventure-guide";
import { captureGuidance, castWarning } from "./ui/combat-guidance";
import {
  explorerRows,
  explorersPanel,
  invitedIsland,
  islandInvite,
} from "./ui/explorers";
import { performanceMarkup, updatePerformance } from "./ui/performance";
import "./adventure.css";
import { onboardingSteps } from "./ui/onboarding";
import { startup } from "./loading/progress";
import { failLoading, finishLoading } from "./loading/screen";
import { prepareInterface } from "./loading/interface-assets";
import {
  normalizeAppearance,
  cleanDisplayName,
  validDisplayName,
} from "../../../packages/shared/appearance";
import { mountCharacterCreator } from "./ui/character-creator";
import { pokedexPanel } from "./ui/pokedex";
import { POKEMON } from "../../../packages/shared/pokemon";
import { companionBarMarkup, updateCompanionBar } from "./ui/companion-bar";
import { pokemonStatsMarkup } from "./ui/pokemon-stats";
import { DASH } from "../../../packages/shared/combat";
import { storyTracker, storyJournal } from "./ui/story-journal";
import {
  interactionRadius,
  currentQuest,
  questDestination,
} from "../../../packages/shared/story";
import { HABITATS } from "../../../packages/shared/encounters";
import {
  CLASS_IDS,
  heroClass,
  GCD_MS,
  abilityUnlocked,
  type ClassId,
} from "../../../packages/shared/classes";
import { heroLevel } from "../../../packages/shared/hero";
import { actionBarMarkup, tooltipMarkup, updateSlot } from "./ui/action-bar";
import {
  healthTone,
  playerFrameMarkup,
  targetFrameMarkup,
  targetKey,
  updatePlayerFrame,
  updateTargetFrame,
} from "./ui/unit-frames";
import { createCombatLog } from "./ui/combat-log";
import { installTooltips } from "./ui/tooltip";
import { worldMap, mapPoint, explorerMapPins } from "./ui/world-map";
import { updateMarkup, preservePanel } from "./ui/dom";
import { creaturePortrait } from "./roster";
import { Client, type Room } from "colyseus.js";
import type {
  Profile,
  WorldSnapshot,
  GameEvent,
  Command,
  Creature,
} from "../../../packages/shared/types";
import { createWorld } from "./world";
import { BRAND, BIOMES, ABILITIES } from "../../../packages/shared/data";
import {
  biomeAt,
  creatureName,
  distance,
  xpForLevel,
} from "../../../packages/shared/rules";
import { drawMinimap } from "./ui/minimap";
import { abilityAvailability, abilityHighlighted } from "./ui/combat";
import { GameAudio } from "./audio";
import {
  audioDefaults,
  normalizeAudio,
  type AudioSettings,
} from "./audio/catalog";
import { icon, escape as esc } from "./ui/icons";
import {
  species,
  items,
  places,
  findSpecies,
  findAbility,
  findItem,
  title,
  currency,
  text,
  number,
} from "./ui/data";
import { adventureNavigation, worldMark } from "./ui/navigation";
import { hudMarkup } from "./ui/hud";
import {
  GUEST_LIMIT_MESSAGE,
  WALLETS,
  WOP,
  isGuest,
  shortAddress,
  type WalletKind,
} from "../../../packages/shared/access";
import { CHAT, type ChatMessage } from "../../../packages/shared/chat";
import { createChat, type Chat } from "./ui/chat";
import {
  updateWopPreview,
  walletButtons,
  wopPanel,
  type WopStatus,
} from "./ui/wop";
import { signInWithWallet } from "./wallet";
import "./style.css";
import "./interface.css";
import "./wallet.css";

type Panel =
  | "explorers"
  | "appearance"
  | "pokedex"
  | "collection"
  | "inventory"
  | "shop"
  | "quests"
  | "map"
  | "arena"
  | "settings"
  | "credits"
  | "ledger"
  | "wop";
type Settings = AudioSettings & {
  quality: string;
  sensitivity: number;
  reducedMotion: boolean;
  cameraShake: boolean;
  scale: number;
  keybinds: Record<string, string>;
};
const defaults: Settings = {
  ...audioDefaults,
  quality: "high",
  sensitivity: 1,
  reducedMotion: false,
  cameraShake: true,
  scale: 1,
  keybinds: {
    forward: "KeyW",
    backward: "KeyS",
    left: "KeyA",
    right: "KeyD",
    sprint: "ShiftLeft",
    interact: "KeyE",
    tame: "KeyF",
  },
};
const app = document.querySelector<HTMLDivElement>("#app")!;
const canvas = document.querySelector<HTMLCanvasElement>("#world")!;
const audio = new GameAudio();
Object.defineProperty(window, "__audioMetrics", { get: () => audio.metrics });
let settings = readSettings();
let world: Awaited<ReturnType<typeof createWorld>>;
let room: Room | undefined;
let profile: Profile | undefined;
let snapshot: WorldSnapshot | undefined;
let target: string | null = null;
let playing = false;
let connected = false;
let connecting = false;
let activePanel: Panel | null = null;
let selectedStarter = "";
let selectedClass: ClassId = "knight";
let classChosen = false;
let draftAppearance = normalizeAppearance();
let characterCreator: ReturnType<typeof mountCharacterCreator> | undefined;
let appearanceEditor: ReturnType<typeof mountCharacterCreator> | undefined;
let lastFocus: HTMLElement | null = null;
let latestTransactions: unknown[] = [];
let latestMatches: unknown[] = [];
let latestLeaderboard: unknown[] = [];
let cooldowns = [0, 0, 0, 0, 0, 0];
/** Global cooldown end on the local clock, predicted on key press. */
let gcdUntil = 0;
let lastAttackSent = 0;
let barKey = "";
let frameKey = "";
let targetFrame = "";
let knownLevel = 0;
let knownXp: { id: string; xp: number; level: number } | undefined;
let combatLog: ReturnType<typeof createCombatLog> | undefined;
let tooltips: ReturnType<typeof installTooltips> | undefined;
let errorTimer = 0;
let snapshotAt = 0;
let lastDiagnosticsAt = 0;
let lastExplorersAt = 0;
let lastActiveDuel: string | null = null;
let lastInvitation: string | null = null;
let lastCastAt = 0;
let queuedAbility:
  | { slot: number; target: string | null; until: number }
  | undefined;
let combatHint: { text: string; until: number } | undefined;
/** Saved sessions: a guest token and, separately, a wallet session. */
const STORE = {
  guest: "island.token",
  wallet: "island.walletToken",
  address: "island.wallet",
  resume: "island.resume",
};
let sessionToken = "";
let chat: Chat | undefined;
let wopStatus: WopStatus | undefined;
let wopLoading = false;
let lastBoundaryNote = 0;
const stored = (key: string) => {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};
const environment = import.meta.env as Record<string, string | undefined>;
const serverUrl =
  environment.VITE_SERVER_URL ||
  (location.port === "5173"
    ? `${location.protocol}//${location.hostname}:2567`
    : location.origin);
const client = new Client(serverUrl.replace(/^http/, "ws"));

function readSettings(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem("island.settings") || "{}");
    return {
      ...defaults,
      ...stored,
      ...normalizeAudio(stored),
      keybinds: {
        ...defaults.keybinds,
        ...stored.keybinds,
      },
    };
  } catch {
    return structuredClone(defaults);
  }
}
function saveSettings() {
  localStorage.setItem("island.settings", JSON.stringify(settings));
  document.documentElement.style.setProperty(
    "--ui-scale",
    String(settings.scale),
  );
  document.body.classList.toggle("reduced-motion", settings.reducedMotion);
  audio.configure(settings);
  world?.setSettings(settings as Parameters<typeof world.setSettings>[0]);
}
function button(label: string, action: string, cls = "", disabled = false) {
  return `<button class="${cls}" data-action="${action}" ${disabled ? "disabled" : ""}>${label}</button>`;
}
function portrait(species: string, evolved = false, cls = "") {
  return `<img class="creature-portrait ${cls}" src="${creaturePortrait(species, evolved)}" alt="" draggable="false" />`;
}
function glyph(element: string, cls = "") {
  return `<span class="element-glyph ${esc(element)} ${cls}">${icon(element)}</span>`;
}
function health(hp: number, max: number) {
  return `<span class="health-track" data-health="${healthTone(hp, max)}"><span style="width:${Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100))}%"></span></span>`;
}
function notify(message: string, kind = "info") {
  const stack = document.querySelector("#toasts")!;
  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;
  toast.setAttribute("role", kind === "error" ? "alert" : "status");
  toast.innerHTML = `${icon(kind === "error" ? "close" : "check")}<span>${esc(message)}</span>`;
  stack.append(toast);
  if (stack.children.length > 4) stack.firstElementChild?.remove();
  window.setTimeout(
    () => toast.remove(),
    kind === "duel-result" ? 10000 : 5500,
  );
  audio.play(kind);
}
/** Red combat feedback above the action bar instead of a toast. */
function combatError(message: string) {
  const line = document.querySelector<HTMLElement>("#error-line");
  if (!line) return;
  line.textContent = message;
  line.classList.remove("show");
  void line.offsetWidth;
  line.classList.add("show");
  window.clearTimeout(errorTimer);
  errorTimer = window.setTimeout(() => line.classList.remove("show"), 1800);
  audio.play("error");
}
function flashScreen(heavy: boolean) {
  if (settings.reducedMotion) return;
  const fx = document.querySelector<HTMLElement>("#screen-fx");
  if (!fx) return;
  fx.classList.remove("hurt", "hurt-heavy");
  void fx.offsetWidth;
  fx.classList.add(heavy ? "hurt-heavy" : "hurt");
}
function nameOf(id?: string) {
  const wild = snapshot?.wilds.find((w) => w.id === id);
  if (wild)
    return wild.boss
      ? "Stormheart"
      : (findSpecies(wild.species).name as string);
  return snapshot?.players.find((p) => p.id === id)?.nickname ?? "Someone";
}
function companionName() {
  const active = profile?.creatures.find((c) => c.id === profile?.active);
  return active
    ? active.nickname || String(findSpecies(active.species).name)
    : "Your companion";
}
function selectTarget(id: string | null) {
  if (id && id !== target) audio.play("target");
  target = id;
  world.setTarget(id);
  refreshWorld();
}
function send(kind: string, fields: Record<string, unknown> = {}) {
  if (!room || !connected) {
    notify("Connection lost. Reconnect to continue.", "error");
    return;
  }
  room.send("command", {
    kind,
    requestId: crypto.randomUUID(),
    ...fields,
  } satisfies Command);
}
async function api(path: string, init?: RequestInit) {
  const token = sessionToken || stored(STORE.guest);
  const response = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    signal: AbortSignal.timeout(12000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error || result.message || `Server returned ${response.status}`,
    );
  return result;
}
const post = (path: string, body: unknown) =>
  api(path, { method: "POST", body: JSON.stringify(body) });

/** Title-screen buttons follow the saved sessions in this browser. */
function refreshEntry(ready = !!world) {
  const address = stored(STORE.address);
  const walletSession = address && stored(STORE.wallet);
  const session = document.querySelector<HTMLElement>("#wallet-session");
  if (session)
    session.innerHTML = walletSession
      ? `${button(`${icon("wallet")}<span>Continue as ${esc(shortAddress(address))}</span>`, "wallet-continue", "primary start-button", !ready || connecting)}${button("Sign out", "wallet-signout", "text-button", connecting)}`
      : "";
  session?.classList.toggle("hidden", !walletSession);
  for (const element of document.querySelectorAll<HTMLButtonElement>(
    "#entry-form [data-action^='wallet:']",
  ))
    element.disabled = !ready || connecting;
  const start = document.querySelector<HTMLButtonElement>("#start");
  if (start) start.disabled = !ready || connecting;
  const label = document.querySelector("#start-label");
  if (label)
    label.textContent = !ready
      ? "Preparing the island…"
      : stored(STORE.guest)
        ? "Continue as guest"
        : "Play as guest";
}
function refreshAccount() {
  const pill = document.querySelector<HTMLElement>("#account-pill");
  if (!pill || !profile) return;
  pill.classList.toggle("guest", isGuest(profile));
  pill.innerHTML = profile.wallet
    ? `${icon("wallet")}<span>${esc(shortAddress(profile.wallet))}</span><small>${WOP.symbol}</small>`
    : `${icon("wallet")}<span>Guest</span><small>CONNECT WALLET</small>`;
}
async function loadWop() {
  if (!profile?.wallet) return;
  wopLoading = true;
  try {
    wopStatus = (await api("/api/wop")) as WopStatus;
  } catch (error) {
    notify(
      error instanceof Error ? error.message : "Could not reach your wallet.",
      "error",
    );
  } finally {
    wopLoading = false;
    if (activePanel === "wop") {
      renderPanel(false);
      updateWopPreview(wopStatus);
    }
  }
}
/** Sign in with a wallet from inside the game. A guest account is upgraded. */
async function linkWallet(kind: WalletKind) {
  try {
    const result = await signInWithWallet(kind, post, {
      guestToken: isGuest(profile) ? sessionToken : undefined,
      nickname: profile?.nickname,
    });
    localStorage.setItem(STORE.wallet, result.token);
    localStorage.setItem(STORE.address, result.profile.wallet!);
    if (result.linked) {
      localStorage.removeItem(STORE.guest);
      sessionToken = result.token;
      profile = result.profile;
      world.setProfile(result.profile);
      refreshProfile();
      notify(
        `${WALLETS[kind].name} connected. The whole isle is open to you now!`,
      );
      if (activePanel === "wop") {
        renderPanel(false);
        void loadWop();
      }
    } else {
      notify("This wallet already has an explorer. Loading their journey…");
      sessionStorage.setItem(STORE.resume, "wallet");
      window.setTimeout(() => location.reload(), 900);
    }
  } catch (error) {
    notify(
      error instanceof Error ? error.message : "Wallet sign-in failed.",
      "error",
    );
  }
}
async function convertWop() {
  const input = document.querySelector<HTMLInputElement>("#wop-pd");
  const pd = Math.floor(Number(input?.value));
  if (!Number.isSafeInteger(pd) || pd <= 0) {
    notify(`Enter how much ${currency} to convert.`, "error");
    return;
  }
  const action = document.querySelector<HTMLButtonElement>(
    '[data-action="wop-convert"]',
  );
  if (action) action.disabled = true;
  try {
    const result = (await post("/api/wop/convert", {
      pd,
      requestId: crypto.randomUUID(),
    })) as { status: WopStatus };
    wopStatus = result.status;
    notify(
      `${pd.toLocaleString()} ${currency} converted. Your ${WOP.symbol} is on its way to your wallet.`,
    );
  } catch (error) {
    notify(
      error instanceof Error ? error.message : "Conversion failed.",
      "error",
    );
  } finally {
    if (activePanel === "wop") {
      renderPanel(false);
      updateWopPreview(wopStatus);
    }
  }
}

function shell() {
  app.innerHTML = `
    <div id="title-screen" class="title-screen">
      <header class="title-header"><a class="wordmark" href="#" aria-label="${esc(title)} home">${worldMark()}<span>${esc(title)}<small>${esc(BRAND.subtitle).toUpperCase()}</small></span></a><div class="edition"><span class="live-dot"></span> A SHARED WORLD, YOUR OWN STORY</div>${button(icon("settings"), "panel:settings", "icon-button", false)}</header>
      <main class="title-content"><div class="eyebrow"><span></span> WELCOME TO ${esc(BRAND.island).toUpperCase()}</div><h1><span>WORLD OF</span>POKÉMON</h1><div class="adventure-tags"><span>EXPLORE</span><span>BEFRIEND</span><span>BATTLE</span></div><p>Your Pokémon. Your party. Your adventure.<br />Discover a shared world, one encounter at a time.</p>
      <div id="entry-form" class="entry-form"><div id="wallet-session" class="wallet-session hidden"></div><label for="nickname">WHAT SHOULD WE CALL YOU?</label><input id="nickname" maxlength="18" minlength="2" autocomplete="nickname" placeholder="Your explorer name" aria-describedby="guest-note" /><div class="wallet-buttons">${walletButtons("wallet", true)}</div><div class="or-rule"><span>or</span></div><button id="start" class="secondary start-button guest-button" data-action="start" disabled><span id="start-label">Preparing the island…</span>${icon("arrow")}</button><details class="world-choice"><summary>Choose an island</summary><label for="world-mode">SHARED WORLD</label><select id="world-mode"><option value="auto">Find an island automatically</option><option value="new">Create a fresh island</option><option value="code">Join a friend’s island</option></select><input id="world-code" aria-label="Island code" maxlength="24" placeholder="Paste your friend’s island code" class="hidden" /></details><div id="guest-note" class="guest-note">Wallet explorers roam the whole isle, tame Pokémon, duel, chat and convert ${esc(currency)} to ${WOP.symbol}.<br />Guests can explore Hearthwick and Sunpetal Meadows and battle the monsters there.</div></div>
      <div id="loading-status" class="loading-status"><span class="loading-line"></span>Preparing your expedition</div></main>
      <aside class="vista-label"><span class="coordinate">01 / 04</span><span>Hearthwick<small>Every great friendship starts somewhere.</small></span></aside>
      <footer class="title-footer"><span>EXPLORE. BEFRIEND. BELONG.</span><div>${button("Field notes & credits", "panel:credits", "text-button")}<span class="footer-rule"></span><span>DESKTOP ADVENTURE</span></div></footer>
    </div>
    ${hudMarkup()}
    <div id="screen-fx" class="screen-fx"></div>
    <div id="starter-screen" class="starter-screen hidden"></div>
    <div id="connection" class="connection hidden" role="alert"></div>
    <div id="modal-root"></div><div id="toasts" class="toasts" aria-live="polite"></div>
    <div class="small-screen"><strong>A bigger world needs a bigger screen.</strong><p>Play on a desktop with a keyboard and mouse. A window at least 800 pixels wide works best.</p></div>`;
  document
    .querySelector<HTMLSelectElement>("#world-mode")!
    .addEventListener("change", (event) => {
      document
        .querySelector("#world-code")!
        .classList.toggle(
          "hidden",
          (event.target as HTMLSelectElement).value !== "code",
        );
    });
  const invitation = invitedIsland(location.search);
  if (invitation) {
    document.querySelector<HTMLDetailsElement>(".world-choice")!.open = true;
    document.querySelector<HTMLSelectElement>("#world-mode")!.value = "code";
    const code = document.querySelector<HTMLInputElement>("#world-code")!;
    code.value = invitation;
    code.classList.remove("hidden");
  }
  combatLog = createCombatLog(document.querySelector("#combat-log")!);
  tooltips = installTooltips(app, (key) =>
    profile?.classId
      ? tooltipMarkup(key, profile.classId, currentCombatLevel())
      : "",
  );
  const nickname = document.querySelector<HTMLInputElement>("#nickname")!;
  nickname.value = localStorage.getItem("island.nickname") || "";
  nickname.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !playing)
      void connect(stored(STORE.wallet) ? "wallet" : "guest");
  });
  chat = createChat(document.querySelector("#chat")!, {
    selfId: () => profile?.id,
    blocked: () =>
      isGuest(profile) ? "Connect a wallet to chat · guests can read" : null,
    send(text) {
      if (!room || !connected) {
        notify("Connection lost. Reconnect to continue.", "error");
        return;
      }
      room.send("chat", { text });
    },
    error: (message) => notify(message, "error"),
  });
  refreshEntry(false);
}

/**
 * Enter the island as a guest, with the saved wallet session, or by signing in
 * with a wallet (walletKind).
 */
async function connect(
  access: "guest" | "wallet" = "guest",
  walletKind?: WalletKind,
) {
  if (connecting || !world) return;
  const input = document.querySelector<HTMLInputElement>("#nickname")!;
  const nickname =
    input.value.trim() || localStorage.getItem("island.nickname") || "";
  if (access === "guest" && !stored(STORE.guest) && nickname.length < 2) {
    notify("Choose an explorer name with 2–18 characters.", "error");
    input.focus();
    return;
  }
  connecting = true;
  refreshEntry();
  document.querySelector("#loading-status")!.innerHTML =
    `<span class="loading-line"></span>${walletKind ? `Waiting for ${WALLETS[walletKind].name}…` : "Connecting to your island…"}`;
  void audio.start();
  try {
    let session: { token: string; profile: Profile };
    if (walletKind) {
      const result = await signInWithWallet(walletKind, post, {
        nickname: nickname.length >= 2 ? nickname : undefined,
        guestToken: stored(STORE.guest) || undefined,
      });
      localStorage.setItem(STORE.wallet, result.token);
      localStorage.setItem(STORE.address, result.profile.wallet!);
      if (result.linked) localStorage.removeItem(STORE.guest);
      session = result;
    } else if (access === "wallet") {
      session = await post("/api/session", {
        nickname: nickname.length >= 2 ? nickname : "Explorer",
        token: stored(STORE.wallet),
      }).catch((error: Error) => {
        if (/Session not found|Invalid session/.test(error.message)) {
          localStorage.removeItem(STORE.wallet);
          localStorage.removeItem(STORE.address);
          throw new Error(
            "Your wallet session has ended. Connect your wallet again.",
          );
        }
        throw error;
      });
    } else {
      session = await post("/api/session", {
        nickname: nickname.length >= 2 ? nickname : "Explorer",
        token: stored(STORE.guest) || undefined,
      });
      localStorage.setItem(STORE.guest, session.token);
    }
    sessionToken = session.token;
    localStorage.setItem("island.nickname", session.profile.nickname);
    profile = session.profile;
    selectedClass = profile?.classId ?? "knight";
    draftAppearance = normalizeAppearance(profile?.appearance);
    classChosen = Boolean(profile?.classId);
    const mode =
      document.querySelector<HTMLSelectElement>("#world-mode")!.value;
    const code = document
      .querySelector<HTMLInputElement>("#world-code")!
      .value.trim();
    if (mode === "code" && !code)
      throw new Error("Enter the island code your friend shared.");
    room =
      mode === "new"
        ? await client.create("island", { token: session.token })
        : mode === "code"
          ? await client.joinById(code, { token: session.token })
          : await client.joinOrCreate("island", { token: session.token });
    document.querySelector("#room-code")!.textContent = room.roomId;
    connected = true;
    room.onMessage("profile", (next: Profile) => {
      profile = next;
      localStorage.setItem("island.nickname", next.nickname);
      world.setProfile(next);
      refreshProfile();
    });
    room.onMessage("world", (next: WorldSnapshot) => {
      snapshot = next;
      snapshotAt = Date.now();
      const self = next.players.find((player) => player.id === profile?.id);
      if (self?.cooldowns) {
        const local = (until = 0) =>
          Date.now() + Math.max(0, until - next.time);
        cooldowns = heroClass(profile?.classId).abilities.map((a) =>
          local(self.cooldowns?.[a.id]),
        );
        if (Date.now() - lastAttackSent > 350) gcdUntil = local(self.gcdUntil);
      }
      audio.setSnapshot(next, profile!.id);
      world.setSnapshot(next, profile!.id);
      refreshWorld();
    });
    room.onMessage("chatHistory", (messages: ChatMessage[]) => {
      chat?.clear();
      for (const message of messages) chat?.add(message);
    });
    room.onMessage("chat", (message: ChatMessage) => {
      chat?.add(message);
      world.say(message.playerId, message.text, CHAT.bubbleMs);
      if (message.playerId !== profile?.id) audio.play("ui");
    });
    room.send("chatHistory");
    room.onMessage("event", (event: GameEvent) => {
      if (event.type === "defeat" && event.target === profile?.id)
        selectTarget(null);
      if (event.type === "defeat" && event.target === target)
        selectTarget(null);
      if (event.type === "appearance" && activePanel === "appearance")
        closePanel();
      audio.handleEvent(event);
      world.handleEvent(event);
      combatLog?.record(event, {
        selfId: profile?.id ?? "",
        name: nameOf,
        companion: companionName(),
      });
      if (event.capture?.success && event.source === profile?.id) {
        const caught = event.capture;
        window.setTimeout(() => {
          document.querySelector("#caught-card")?.remove();
          const card = document.createElement("div");
          card.id = "caught-card";
          card.className = "caught-card";
          card.innerHTML = `<span class="eyebrow">${caught.shiny ? "SHINY POKÉMON" : "NEW FRIEND"}</span><h2>Caught!</h2>${portrait(caught.species)}<h3>${POKEMON[caught.species].name}</h3><p>Saved to your collection and Pokédex.</p><button class="primary compact" data-action="panel:pokedex">View Pokédex</button>`;
          app.append(card);
          window.setTimeout(() => card.remove(), 5500);
        }, caught.duration);
      }
      if (event.target === profile?.id && event.type === "hit" && event.amount)
        flashScreen(event.outcome === "crit");
      if (
        [
          "cast",
          "attack",
          "hit",
          "impact",
          "dash",
          "cast-cancel",
          "swing",
          "dot",
          "interrupt",
          "aggro",
          "heal",
          "shatter",
        ].includes(event.type)
      ) {
        if (
          event.source === profile?.id &&
          event.ability &&
          (event.type === "cast" ||
            (event.type === "attack" &&
              ["heal", "guard", "evasion"].includes(
                ABILITIES[event.ability]?.effect ?? "",
              )))
        ) {
          const slot = heroClass(profile?.classId).abilities.findIndex(
            (a) => a.id === event.ability,
          );
          if (slot >= 0)
            cooldowns[slot] =
              Date.now() + (ABILITIES[event.ability]?.cooldown ?? 0) * 1000;
        }
      } else if (event.type === "defeat" && event.target !== profile?.id)
        return;
      else if (event.type === "reward" && event.target) return;
      else if (event.type === "defeat") return;
      else if (event.capture) {
        if (!event.capture.success)
          window.setTimeout(
            () => notify(event.message, event.type),
            event.capture.duration,
          );
      } else notify(event.message, event.type);
    });
    room.onMessage("error", (error: { message: string }) => {
      if (Date.now() - lastAttackSent < 700) {
        world.cancelPrediction();
        gcdUntil = 0;
        combatError(error.message);
      } else notify(error.message, "error");
    });
    room.onDrop(() => {
      connected = false;
      audio.setConnected(false);
      document.querySelector("#connection")!.classList.remove("hidden");
      document.querySelector("#connection")!.textContent =
        "Connection interrupted. Reconnecting to your island…";
    });
    room.onReconnect(() => {
      connected = true;
      audio.setConnected(true);
      document.querySelector("#connection")!.classList.add("hidden");
      notify("Reconnected. Your expedition is ready.");
    });
    room.onLeave(() => {
      connected = false;
      audio.setConnected(false);
      document.querySelector("#connection")!.classList.remove("hidden");
      document.querySelector("#connection")!.innerHTML =
        `<span>Connection interrupted. Your saved progress is safe.</span>${button("Reconnect", "reconnect", "primary")}`;
    });
    room.onError((_code, message) =>
      notify(message || "The connection encountered an error.", "error"),
    );
    document.querySelector("#connection")!.classList.add("hidden");
    document.querySelector("#title-screen")!.classList.add("hidden");
    playing = true;
    audio.setConnected(true);
    audio.setPlaying(true);
    world.setPlaying(true);
    world.setProfile(profile!);
    refreshProfile();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The island server is unavailable. Please try again.";
    notify(message, "error");
    if (
      access === "guest" &&
      /Session not found|Invalid session/.test(message)
    ) {
      const banner = document.querySelector("#connection")!;
      banner.classList.remove("hidden");
      banner.innerHTML = `<span>This browser’s guest identity was not found. Starting a new guest creates a separate collection.</span>${button("Start a new guest", "new-guest", "primary")}`;
    }
  } finally {
    connecting = false;
    refreshEntry();
    document.querySelector("#loading-status")!.innerHTML =
      '<span class="live-dot"></span> Your island is ready';
  }
}

function starterScreen() {
  const screen = document.querySelector<HTMLElement>("#starter-screen")!;
  if (!classChosen) {
    if (!characterCreator)
      characterCreator = mountCharacterCreator(
        document.querySelector("#starter-screen")!,
        {
          appearance: draftAppearance,
          classId: selectedClass,
          nickname: profile?.nickname ?? "Adventurer",
          hasCompanion: Boolean(profile?.creatures.length),
          onChange: (appearance) => {
            draftAppearance = appearance;
          },
        },
      );
    focusOnboardingStep(screen, "character");
    return;
  }

  characterCreator?.dispose();
  characterCreator = undefined;
  const starters = species().filter((entry) => entry.starter);
  if (!selectedStarter) selectedStarter = text(starters[0] || {}, "id");
  document.querySelector("#starter-screen")!.innerHTML =
    `<div class="starter-intro">${onboardingSteps(2)}<span class="eyebrow">YOUR FIRST CHAPTER</span><h2>Every adventure<br />begins with <em>a friend.</em></h2><p>Three different spirits. One lifelong companion.<br />Find wild Pokémon to grow your team. Hostile monsters are enemies.</p></div><div class="starter-options">${starters.map((entry) => `<button class="starter-option ${selectedStarter === entry.id ? "selected" : ""}" aria-pressed="${selectedStarter === entry.id}" data-action="starter-select:${esc(entry.id)}">${portrait(text(entry, "id"), false, "starter-portrait")}<span class="eyebrow">${esc(entry.element)} AFFINITY</span><h3>${esc(entry.name)}</h3><p>${esc(entry.description || entry.blurb || "A loyal little companion, ready for a big adventure.")}</p><span class="starter-choice">${selectedStarter === entry.id ? `${icon("check")} YOUR COMPANION` : "GET TO KNOW ME"}</span></button>`).join("")}</div><div class="starter-footer">${button(`Meet your companion ${icon("arrow")}`, "starter-confirm", "primary")}<small>Move with WASD · Drag to orbit · Q / R to rotate · E to interact</small></div>`;
  screen
    .querySelector(".starter-footer")!
    .insertAdjacentHTML(
      "beforeend",
      button("Back to character", "starter-back", "secondary"),
    );
  focusOnboardingStep(screen, "pokemon");
}
function focusOnboardingStep(screen: HTMLElement, step: string) {
  if (screen.dataset.step === step) return;
  screen.dataset.step = step;
  screen.classList.remove("hidden");
  screen.scrollTop = 0;
  const heading = screen.querySelector<HTMLElement>("h2");
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}
function currentCombatLevel() {
  return (
    snapshot?.players.find((p) => p.id === profile?.id)?.level ??
    (profile ? heroLevel(profile) : 1)
  );
}
function refreshActionBar() {
  if (!profile?.classId) return;
  const level = currentCombatLevel();
  const key = `${profile.classId}:${level}:${profile.inventory.capsule ?? 0}`;
  if (key === barKey) return;
  barKey = key;
  document.querySelector("#abilities")!.innerHTML = actionBarMarkup(
    profile.classId,
    level,
    profile.inventory.capsule ?? 0,
  );
  tooltips?.refresh();
}
function refreshProfile() {
  if (!profile) return;
  const needsStarter = profile.creatures.length === 0 || !profile.classId;
  document
    .querySelector("#starter-screen")!
    .classList.toggle("hidden", !needsStarter);
  document
    .querySelector("#hud")!
    .classList.toggle("hidden", needsStarter || !playing);
  if (needsStarter) {
    starterScreen();
    world.setPlaying(false);
  } else {
    characterCreator?.dispose();
    characterCreator = undefined;
    if (!activePanel) world.setPlaying(true);
  }
  document.querySelector("#balance")!.textContent =
    profile.balance.toLocaleString();
  refreshAccount();
  const active = profile.creatures.find((c) => c.id === profile!.active);
  const level = heroLevel(profile);
  const frames = `${profile.classId}:${profile.nickname}:${level}:${active?.id}:${active?.level}:${active?.evolved}:${active?.species}:${active?.nickname}:${active?.moves.join(",")}`;
  if (profile.classId && frames !== frameKey) {
    frameKey = frames;
    document.querySelector("#pet-abilities")!.innerHTML =
      companionBarMarkup(profile);
    tooltips?.refresh();
    document.querySelector("#companion-card")!.innerHTML =
      playerFrameMarkup(profile);
  }
  refreshActionBar();
  if (knownLevel && level > knownLevel) levelUp(level, knownLevel);
  knownLevel = level;
  if (active && knownXp && knownXp.id === active.id) {
    const gained =
      active.level > knownXp.level
        ? active.xp + xpForLevel(knownXp.level) - knownXp.xp
        : active.xp - knownXp.xp;
    if (gained > 0) world.floatSelf(`+${gained} XP`, "xp");
  }
  knownXp = active
    ? { id: active.id, xp: active.xp, level: active.level }
    : undefined;
  const xp = document.querySelector<HTMLElement>("#xp-bar");
  if (xp && active) {
    const needed = xpForLevel(active.level);
    xp.querySelector<HTMLElement>(".xp-fill")!.style.width =
      `${active.level >= 20 ? 100 : Math.min(100, (active.xp / needed) * 100)}%`;
    xp.querySelector(".xp-text")!.textContent =
      active.level >= 20
        ? `${companionName()} · Level 20 · Max level`
        : `${companionName()} · Level ${active.level} · ${active.xp} / ${needed} XP`;
  }
  xp?.classList.toggle("hidden", !active);
  refreshCombatControls();
  refreshQuest();
  if (
    activePanel &&
    !["appearance", "settings", "credits", "map", "ledger"].includes(
      activePanel,
    )
  )
    renderPanel(false);
}
function levelUp(level: number, previous: number) {
  const learned = heroClass(profile?.classId).abilities.filter(
    (a) => abilityUnlocked(a, level) && !abilityUnlocked(a, previous),
  );
  const banner = document.querySelector<HTMLElement>("#level-banner")!;
  banner.innerHTML = `<span class="eyebrow">YOU HAVE REACHED</span><strong>Level ${level}</strong>${learned.map((a) => `<small>New ability: <b>${esc(a.name)}</b> · press ${heroClass(profile?.classId).abilities.indexOf(a) + 1}</small>`).join("")}`;
  banner.classList.remove("hidden", "show");
  void banner.offsetWidth;
  banner.classList.add("show");
  window.setTimeout(() => banner.classList.add("hidden"), 4200);
  audio.play("level");
  world.celebrate();
}
function refreshQuest() {
  if (!profile) return;
  document.querySelector("#quest-tracker")!.innerHTML = storyTracker(profile);
}
function nearestPlace() {
  const self = snapshot?.players.find((player) => player.id === profile?.id);
  if (!self) return undefined;
  return places()
    .map((place) => ({
      ...place,
      name: text(place, "name"),
      distance: Math.hypot(
        number(place, "x") - self.x,
        number(place, "z") - self.z,
      ),
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}
function refreshWorld() {
  if (!snapshot || !profile) return;
  refreshActionBar();
  document.querySelector("#presence")!.textContent =
    `${snapshot.players.length} explorer${snapshot.players.length === 1 ? "" : "s"} online`;
  const self = snapshot.players.find((player) => player.id === profile!.id);
  const place = nearestPlace();
  const biomeKey = self ? biomeAt(self.x, self.z) : "town";
  audio.setBiome(biomeKey);
  drawMinimap(
    document.querySelector<HTMLCanvasElement>("#minimap")!,
    snapshot,
    profile.id,
    profile,
  );
  const quest = currentQuest(profile);
  const destination = quest && questDestination(profile, quest);
  const direction = document.querySelector("#story-direction");
  if (direction && destination && self)
    direction.textContent = directionLabel(self, destination);
  const habitat = HABITATS.find((h) => self && distance(self, h) < 15);
  const biome = BIOMES[biomeKey].name;
  const locationName = habitat?.name ?? biome;
  const locationLabel = document.querySelector<HTMLElement>("#location-name")!;
  updateMarkup(
    locationLabel,
    `${esc(locationName)}<small>${habitat ? (habitat.kind === "pokemon" ? "WILD POKÉMON HABITAT" : "MONSTER TERRITORY") : biome === "Hearthwick" ? "SAFE HAVEN" : "WILDERNESS"}</small>`,
  );
  if (locationLabel.title !== locationName) locationLabel.title = locationName;
  updateMarkup(
    document.querySelector("#interaction")!,
    place && place.distance < interactionRadius(text(place, "id"))
      ? `<button data-action="interact"><kbd>${esc(settings.keybinds.interact.replace("Key", ""))}</kbd><span>${esc(place.name)}<small>INTERACT</small></span></button>`
      : "",
  );
  const activeDuel = snapshot.duels.find(
    (duel) =>
      (duel.a === profile!.id || duel.b === profile!.id) &&
      duel.state === "active",
  );
  if (activeDuel && activeDuel.id !== lastActiveDuel) {
    lastActiveDuel = activeDuel.id;
    target = activeDuel.a === profile.id ? activeDuel.b : activeDuel.a;
    world.setTarget(target);
    cooldowns = [0, 0, 0, 0, 0, 0];
    if (activePanel) closePanel();
  } else if (!activeDuel) lastActiveDuel = null;
  const wild = snapshot.wilds.find((wild) => wild.id === target && wild.hp > 0);
  const player = snapshot.players.find((player) => player.id === target);
  const card = document.querySelector("#target-card")!;
  const shown = wild ?? player;
  card.classList.toggle("hidden", !shown);
  if (shown) {
    const key = `${targetKey(shown, !!activeDuel)}:${profile.inventory.bait ?? 0}`;
    if (key !== targetFrame) {
      targetFrame = key;
      card.className = `target-card unit-frame ${wild ? (findSpecies(wild.species).companion ? "neutral" : "hostile") : "friendly"} ${wild?.boss ? "boss" : wild?.elite ? "elite" : ""}`;
      card.innerHTML = targetFrameMarkup(shown, profile, !!activeDuel);
    }
  } else targetFrame = "";
  const catchButton = document.querySelector<HTMLButtonElement>(
    '[data-action="tame"]',
  );
  if (catchButton) {
    catchButton.disabled = !wild || !findSpecies(wild.species).companion;
    catchButton.title = catchButton.disabled
      ? "Select a wild Pokémon. Hostile monsters cannot be captured."
      : "Weaken this Pokémon, then use a capsule.";
  }
  const duel = snapshot.duels.find(
    (duel) =>
      (duel.a === profile!.id || duel.b === profile!.id) &&
      duel.state !== "finished",
  );
  if (duel?.state === "invite" && duel.id !== lastInvitation) {
    lastInvitation = duel.id;
    if (activePanel && duel.b === profile.id) closePanel();
  }
  const banner = document.querySelector("#duel-banner")!;
  banner.classList.toggle("hidden", !duel);
  if (duel)
    updateMarkup(
      banner,
      duel.state === "active"
        ? `<strong>${duel.arena ? "Arena duel" : "Friendly duel"} in progress</strong><span>Level 10 · 180 health · ${Math.max(0, Math.ceil((duel.expires - snapshot.time) / 1000))}s remaining.</span>${button("Surrender", "surrender", "text-button")}`
        : duel.b === profile.id
          ? `<strong>A friendly challenge awaits</strong><span>Accept to duel here at level 10. Your adventure health stays safe.</span>${button("Accept", `duelAccept:${duel.id}`, "primary")}${button("Decline", `duelReject:${duel.id}`, "secondary")}`
          : `<strong>Challenge sent</strong><span>Waiting for your fellow explorer.</span>${button("Cancel invitation", `duelCancel:${duel.id}`, "text-button")}`,
    );
  refreshCombatControls();
  if (activePanel === "map") updateMapPosition();
  if (activePanel === "explorers" && Date.now() - lastExplorersAt > 1000) {
    lastExplorersAt = Date.now();
    const roster = document.querySelector("#explorer-list");
    if (roster)
      updateMarkup(roster, explorerRows(snapshot.players, profile.id));
  }
  if (activePanel === "arena") {
    const queueButton = document.querySelector<HTMLButtonElement>(
      '[data-action="queue"]',
    );
    if (queueButton)
      queueButton.textContent = snapshot.queue.includes(profile.id)
        ? "Leave arena queue"
        : "Join arena queue";
  }
}
function attack(slot: number, quiet = false) {
  if (activePanel || !playing || !profile || !snapshot || !connected) return;
  if (Date.now() - lastCastAt < 120) return;
  const ability = heroClass(profile.classId).abilities[slot];
  const self = snapshot.players.find((player) => player.id === profile!.id);
  if (!ability) return;
  if (!target && self && ability.power > 0 && !ability.aoeSelf) {
    const nearest = snapshot.wilds
      .filter(
        (w) =>
          w.hp > 0 &&
          distance(self, w) <= ability.range &&
          !findSpecies(w.species).companion,
      )
      .sort((a, b) => distance(self, a) - distance(self, b))[0];
    if (nearest) selectTarget(nearest.id);
  }
  const opponent =
    snapshot.wilds.find((w) => w.id === target) ??
    snapshot.players.find((p) => p.id === target);
  const now = Date.now();
  const reason = abilityAvailability(
    ability,
    self,
    opponent,
    cooldowns[slot] ?? 0,
    now,
    !!lastActiveDuel,
    serverNow(),
    gcdUntil,
  );
  if (reason !== "Ready") {
    const wait = Math.max(
      (cooldowns[slot] ?? 0) - now,
      ability.offGcd ? 0 : gcdUntil - now,
    );
    if ((reason === "Recharging" || reason === "Casting") && wait < 400)
      queuedAbility = { slot, target, until: now + wait + 250 };
    if (quiet || reason === "Recharging" || reason === "Casting") return;
    combatError(
      reason === "Move closer" && self && opponent
        ? `Move ${Math.ceil(distance(self, opponent) - ability.range)}m closer · ${ability.name} reaches ${ability.range}m`
        : reason === "Path is blocked"
          ? "Path blocked · Move around the obstacle for a clear view"
          : reason,
    );
    return;
  }
  queuedAbility = undefined;
  lastCastAt = now;
  lastAttackSent = now;
  if (!ability.offGcd) gcdUntil = now + GCD_MS;
  world.predictAbility(ability.id);
  send("attack", {
    target:
      ["heal", "guard", "evasion"].includes(ability.effect ?? "") ||
      ability.aoeSelf
        ? profile.id
        : target || profile.id,
    slot,
  });
}
/** Server time estimated from the latest snapshot. */
function serverNow() {
  return (snapshot?.time ?? Date.now()) + (Date.now() - snapshotAt);
}
function refreshCombatControls() {
  updateCompanionBar(
    document.querySelector("#pet-abilities")!,
    snapshot?.players.find((p) => p.id === profile?.id),
    serverNow(),
  );
  if (!profile || !snapshot) return;
  const self = snapshot.players.find((player) => player.id === profile!.id);
  const opponent =
    snapshot.wilds.find((w) => w.id === target && w.hp > 0) ??
    snapshot.players.find((p) => p.id === target);
  const now = Date.now(),
    server = serverNow(),
    duel = !!lastActiveDuel;
  const bar = document.querySelector<HTMLElement>("#cast-bar");
  const cast = self?.cast;
  if (bar) {
    const charging = !!cast && !cast.released && cast.releasesAt > server;
    const long = charging && cast.releasesAt - cast.startedAt >= 350;
    bar.classList.toggle("hidden", !long);
    if (long) {
      bar.style.setProperty(
        "--cast-progress",
        String(
          Math.min(
            1,
            (server - cast.startedAt) / (cast.releasesAt - cast.startedAt),
          ),
        ),
      );
      bar.querySelector(".cast-name")!.textContent =
        ABILITIES[cast.ability]?.name ?? "Casting";
      bar.querySelector(".cast-time")!.textContent =
        `${Math.max(0, (cast.releasesAt - server) / 1000).toFixed(1)}`;
    }
  }
  const dash = document.querySelector<HTMLButtonElement>(
    '[data-action="dash"]',
  );
  if (dash) {
    const remaining = Math.max(0, (self?.cooldowns?.dash ?? 0) - snapshot.time);
    updateSlot(dash, {
      remaining: remaining / 1000,
      duration: DASH.cooldown / 1000,
      gcd: false,
      reason: (self?.hp ?? 0) > 0 ? "Ready" : "You need healing",
      highlight: false,
    });
    dash.disabled = remaining > 0 || (self?.hp ?? 0) <= 0;
  }
  if (queuedAbility) {
    const queued = queuedAbility;
    if (
      queued.until < now ||
      queued.target !== target ||
      activePanel ||
      !connected ||
      !playing
    )
      queuedAbility = undefined;
    else attack(queued.slot, true);
  }
  const abilities = heroClass(profile.classId).abilities;
  document
    .querySelectorAll<HTMLButtonElement>(".ability[data-slot]")
    .forEach((button) => {
      const slot = Number(button.dataset.slot),
        ability = abilities[slot];
      if (!ability) return;
      const cooldown = Math.max(0, ((cooldowns[slot] ?? 0) - now) / 1000);
      const global = ability.offGcd ? 0 : Math.max(0, (gcdUntil - now) / 1000);
      const reason = abilityAvailability(
        ability,
        self,
        opponent,
        cooldowns[slot] ?? 0,
        now,
        duel,
        server,
        gcdUntil,
      );
      updateSlot(button, {
        remaining: Math.max(cooldown, global),
        duration: cooldown > global ? ability.cooldown : GCD_MS / 1000,
        gcd: cooldown <= global,
        reason,
        highlight: abilityHighlighted(ability, self, opponent, server),
      });
    });
  const catchButton = document.querySelector<HTMLButtonElement>(
    '[data-action="tame"]',
  );
  if (catchButton) {
    const wild = snapshot.wilds.find((w) => w.id === target && w.hp > 0);
    catchButton.disabled = !wild || !findSpecies(wild.species).companion;
    catchButton.classList.toggle(
      "highlight",
      !!wild &&
        !!findSpecies(wild.species).companion &&
        wild.hp / wild.maxHp <= 0.75,
    );
  }
  updatePlayerFrame(
    document.querySelector("#companion-card")!,
    profile,
    self,
    duel,
    server,
  );
  const card = document.querySelector("#target-card")!;
  if (opponent && !card.classList.contains("hidden"))
    updateTargetFrame(card, opponent, self, snapshot.players, server);
  document
    .querySelector("#screen-fx")
    ?.classList.toggle(
      "low-health",
      !!self && self.hp > 0 && self.hp / Math.max(1, self.maxHp) < 0.3,
    );
  const defeated = !!self && self.hp <= 0 && !duel;
  document.body.classList.toggle("defeated", defeated);
  document
    .querySelector("#defeat-banner")
    ?.classList.toggle("hidden", !defeated);
  if (activePanel === "settings" && now - lastDiagnosticsAt > 1000) {
    lastDiagnosticsAt = now;
    updatePerformance(
      document.querySelector("#modal-root")!,
      now - snapshotAt,
      connected,
    );
  }
  const status = document.querySelector("#combat-status")!;
  const warning = castWarning(opponent, server);
  status.classList.toggle("incoming-attack", !!warning);
  const guard = (self?.guardUntil ?? 0) > server;
  status.classList.toggle("guard-active", guard);
  const text = defeated
    ? "DEFEATED · Walk to the Springhouse to heal"
    : guard
      ? "GUARD ACTIVE · Incoming damage reduced"
      : combatHint && combatHint.until > now
        ? combatHint.text
        : warning
          ? warning
          : opponent && self
            ? "species" in opponent && !!findSpecies(opponent.species).companion
              ? captureGuidance(self, opponent, profile.inventory.capsule ?? 0)
              : self.autoTarget === opponent.id
                ? `ATTACKING · ${Math.round(distance(self, opponent))}m`
                : `${Math.round(distance(self, opponent))}m · T or right-click to auto attack`
            : "Tab to target an enemy · 1–6 to fight";
  if (status.textContent !== text) status.textContent = text;
}
function interact() {
  const place = nearestPlace();
  if (!place || place.distance > interactionRadius(text(place, "id"))) {
    notify("Move closer to a town service or landmark to interact.");
    return;
  }
  const id = text(place, "id");
  send("interact", { place: id });
  if (id.startsWith("waystone-")) openPanel("map");
  else if (/heal|clinic|spring/.test(id)) send("heal");
  else if (/shop|market/.test(id)) openPanel("shop");
  else if (/team|stable|sanctuary|ranch/.test(id)) openPanel("collection");
  else if (/arena/.test(id)) openPanel("arena");
  else if (text(place, "kind") === "quest") openPanel("quests");
}

const panelNames: Record<Panel, [string, string]> = {
  explorers: ["Island explorers", "ADVENTURE TOGETHER"],
  appearance: ["Character", "YOUR ADVENTURER"],
  pokedex: ["Pokédex", "YOUR POKÉDEX"],
  collection: ["Pokémon team", "YOUR COMPANIONS"],
  inventory: ["Inventory", "YOUR SATCHEL"],
  shop: ["Mira’s field supply", "MIRA’S FIELD SUPPLY"],
  quests: ["Quest journal", "EXPEDITION JOURNAL"],
  map: ["World map", "YOUR ISLAND GUIDE"],
  arena: ["Sunstone arena", "SUNSTONE ARENA"],
  settings: ["Settings", "YOUR PREFERENCES"],
  credits: ["Field notes & credits", "FIELD NOTES & CREDITS"],
  ledger: ["Your PD", "YOUR POKEMON DOLLARS"],
  wop: [`${WOP.symbol} wallet`, "WORLD OF POKÉMON TOKEN"],
};
function openPanel(panel: Panel) {
  audio.play(
    panel === "quests" || panel === "map"
      ? "page"
      : panel === "inventory"
        ? "bag"
        : "open",
  );
  lastFocus = document.activeElement as HTMLElement;
  activePanel = panel;
  renderPanel();
  if (panel === "wop") void loadWop();
  if (panel === "ledger")
    void loadRecords("/api/ledger", (data) => {
      latestTransactions = data;
    });
  if (panel === "arena") {
    void loadRecords("/api/matches", (data) => {
      latestMatches = data;
    });
    void loadRecords("/api/leaderboard", (data) => {
      latestLeaderboard = data;
    });
  }
}
async function loadRecords(path: string, setter: (value: unknown[]) => void) {
  try {
    const result = await api(path);
    setter(
      Array.isArray(result) ? result : result.entries || result.matches || [],
    );
    if (activePanel && activePanel !== "appearance") renderPanel(false);
  } catch (error) {
    notify(
      error instanceof Error ? error.message : "Could not load records.",
      "error",
    );
  }
}
function closePanel() {
  appearanceEditor?.dispose();
  appearanceEditor = undefined;
  if (activePanel) audio.play("close");
  updateMarkup(document.querySelector("#modal-root")!, "");
  activePanel = null;
  lastFocus?.focus();
  if (playing && profile?.creatures.length) world.setPlaying(true);
}
function panelBody(panel: Panel): string {
  switch (panel) {
    case "explorers":
      return explorersPanel(
        snapshot?.players ?? [],
        profile?.id ?? "",
        room?.roomId ?? "",
      );
    case "appearance":
      return profile
        ? `<p class="studio-location-note">Save your new look while resting in Hearthwick, outside combat.</p><div id="character-editor"></div>`
        : empty(
            "Begin your adventure",
            "Your character studio will be available in town.",
          );
    case "pokedex":
      return pokedexPanel(profile);
    case "settings":
      return settingsPanel();
    case "credits":
      return creditsPanel();
    case "collection":
      return collectionPanel();
    case "inventory":
      return inventoryPanel();
    case "shop":
      return shopPanel();
    case "quests":
      return questsPanel();
    case "map":
      return mapPanel();
    case "arena":
      return arenaPanel();
    case "ledger":
      return ledgerPanel();
    case "wop":
      return wopPanel(profile, wopStatus, wopLoading, currency);
  }
}
function renderPanel(focus = true) {
  if (!activePanel) return;
  appearanceEditor?.dispose();
  appearanceEditor = undefined;
  const panel = activePanel;
  const content = panelBody(panel);
  const root = document.querySelector("#modal-root")!;
  const restore = preservePanel(root);
  updateMarkup(
    root,
    `<div class="modal-backdrop"><section class="panel panel-${panel}" role="dialog" data-menu-open="true" aria-modal="true" aria-labelledby="panel-title"><header class="panel-header"><div><span class="eyebrow">${panelNames[panel][1]}</span><h2 id="panel-title">${panelNames[panel][0]}</h2></div>${button(icon("close"), "close", "icon-button close-button")}</header>${playing ? adventureNavigation(panel) : ""}<div class="panel-body">${content}</div><footer class="panel-footer"><span>${playing ? "The shared world keeps moving while you browse." : "A small island. An extraordinary adventure."}</span><span><kbd>ESC</kbd> BACK TO ${playing ? "THE ISLAND" : "THE VIEW"}</span></footer></section></div>`,
  );
  root.querySelector(".close-button")?.setAttribute("aria-label", "Close menu");
  if (focus) (root.querySelector("button") as HTMLElement)?.focus();
  else restore();

  if (panel === "appearance" && profile)
    appearanceEditor = mountCharacterCreator(
      root.querySelector("#character-editor")!,
      {
        appearance: normalizeAppearance(profile.appearance),
        classId: profile.classId ?? "knight",
        nickname: profile.nickname,
        editing: true,
        onChange: () => {},
      },
    );
  if (panel === "map") updateMapPosition();
  if (panel === "wop") updateWopPreview(wopStatus);
}
function locationNote(id: string) {
  const place = places().find((entry) => entry.id === id);
  return `<div class="notice">${icon("compass")}<span>Visit <strong>${esc(place?.name || "Hearthwick")}</strong> to use this service.${place ? ` <span class="subtle">${esc(place.description)}</span>` : ""}</span>${button("View map", "panel:map", "text-button")}</div>`;
}
function empty(title: string, description: string) {
  return `<div class="empty-state">${icon("leaf")}<h3>${title}</h3><p>${description}</p></div>`;
}
function collectionPanel() {
  if (!profile)
    return empty(
      "Your companions are waiting.",
      "Begin your adventure to meet your first friend.",
    );
  const inTeam = profile.creatures.filter((creature) =>
    profile!.team.includes(creature.id),
  );
  const storage = profile.creatures.filter(
    (creature) => !profile!.team.includes(creature.id),
  );
  return `${locationNote("stable")}<div class="section-heading"><h3>Traveling together <span>${inTeam.length}/3</span></h3><p>One companion by your side. Three friends on your team.</p></div><div class="creature-grid">${profile.team
    .map((id) => profile!.creatures.find((creature) => creature.id === id))
    .filter((creature): creature is Creature => !!creature)
    .map(creatureCard)
    .join(
      "",
    )}${inTeam.length < 3 ? `<div class="empty-slot">${icon("team")}<span>A friend belongs here</span><small>Tame creatures to grow your team.</small></div>` : ""}</div><div class="section-heading"><h3>At the lodge <span>${storage.length}</span></h3><p>Your full collection, safe and sound.</p></div><div class="creature-grid">${storage.map(creatureCard).join("") || '<p class="subtle">No companions in storage yet. Seek Bulbasaur, Charmander and Squirtle in their natural habitats.</p>'}</div>`;
}
function creatureCard(creature: Creature) {
  const entry = findSpecies(creature.species);
  const team = profile!.team.includes(creature.id);
  const active = profile!.active === creature.id;
  const evolutions = POKEMON[creature.species]?.evolutions ?? [];
  return `<article class="creature-card"><div class="creature-card-top">${portrait(creature.species, creature.evolved)}<span class="tag">${active ? "DEPLOYED" : team ? "IN YOUR TEAM" : "AT THE LODGE"}</span></div><span class="eyebrow">${esc(POKEMON[creature.species]?.types.join(" / ") ?? entry.element)} · LEVEL ${creature.level} · ${esc(creature.trait)}</span><h3>${esc(creatureName(creature))}</h3><p>${esc(entry.description)}</p>${health(creature.hp, creature.maxHp)}<div class="card-stats"><span>${creature.hp}/${creature.maxHp} HP</span><span>${creature.xp} XP</span></div><div class="card-actions">${team ? button(active ? "Recall" : "Deploy", `deploy:${active ? "" : creature.id}`, "secondary compact") + button("Store", `store:${creature.id}`, "secondary compact") + (profile!.team.indexOf(creature.id) > 0 ? button("Move first", `reorder:${creature.id}`, "text-button") : "") : button("Add to team", `add-team:${creature.id}`, "secondary compact", profile!.team.length >= 3)}${evolutions.map((evolution) => button(`Evolve to ${POKEMON[evolution.species].name} · 90 ${currency}`, `evolve:${creature.id}:${evolution.species}`, "text-button", creature.level < evolution.level || (!!evolution.item && !(profile!.inventory[evolution.item] > 0)))).join("")}</div>${pokemonStatsMarkup(creature)}<div class="pet-name-field"><label for="pet-name-${creature.id}">Companion name</label><div><input id="pet-name-${creature.id}" value="${esc(creature.nickname || "")}" placeholder="${esc(entry.name)}" maxlength="18" autocomplete="off"/>${button("Save name", `rename-pet:${creature.id}`, "secondary compact")}</div></div><div class="move-chips">${creature.moves.map((id) => `<span title="${esc(findAbility(id).description)}">${esc(findAbility(id).name)}</span>`).join("")}</div>${evolutions.map((evolution) => `<small class="subtle">Level ${evolution.level}${evolution.item ? ` · ${evolution.item.replaceAll("-", " ")}` : ""}${evolution.location ? ` · In the ${evolution.location}` : " · At the lodge"}</small>`).join("")}</article>`;
}
function inventoryPanel() {
  if (!profile)
    return empty(
      "Travel light. Dream big.",
      "Your supplies appear here after you start.",
    );
  const inventory = Object.entries(profile.inventory).filter(
    ([, quantity]) => quantity > 0,
  );
  return `<div class="notice">${icon("bag")}<span>Healing items affect your deployed companion. Capsules require a selected wild target.</span>${button("Visit shop", "panel:shop", "text-button")}</div><div class="item-grid">${
    inventory
      .map(([id, quantity]) => {
        const entry = findItem(id);
        return `<article class="item-card">${glyph(id.includes("potion") ? "tide" : id === "capsule" || id === "prism" ? "spirit" : "leaf")}<div><span class="eyebrow">IN YOUR SATCHEL · ${quantity}</span><h3>${esc(entry.name)}</h3><p>${esc(entry.description)}</p></div>${button(id === "capsule" || id === "prism" ? "Tame target" : "Use item", `use:${id}`, "secondary compact")}</article>`;
      })
      .join("") ||
    empty(
      "A lighter satchel.",
      "Pick up fresh supplies from Mira’s shop in town.",
    )
  }</div>`;
}
function shopPanel() {
  return `${locationNote("shop")}<div class="shop-balance">Good preparation goes a long way.<span>${icon("coin")} ${profile?.balance.toLocaleString() || 0} ${esc(currency)}</span></div><div class="item-grid">${items()
    .map(
      (entry) =>
        `<article class="item-card">${glyph(text(entry, "effect").includes("heal") ? "tide" : text(entry, "effect") === "tame" ? "spirit" : "leaf")}<div><span class="eyebrow">${esc(entry.effect)}</span><h3>${esc(entry.name)}</h3><p>${esc(entry.description)}</p><small class="subtle">In satchel: ${profile?.inventory[text(entry, "id")] || 0}</small></div>${button(`${number(entry, "price")} ${currency} ${icon("arrow")}`, `buy:${esc(entry.id)}`, "secondary compact", !profile || profile.balance < number(entry, "price"))}</article>`,
    )
    .join("")}</div>`;
}
function questsPanel() {
  return profile
    ? storyJournal(
        profile,
        snapshot?.players.find((p) => p.id === profile?.id),
      )
    : "";
}
function mapPanel() {
  return worldMap(profile, snapshot?.time);
}
function updateMapPosition() {
  const peers = document.querySelector("#map-explorers");
  if (peers && snapshot)
    updateMarkup(peers, explorerMapPins(snapshot.players, profile?.id ?? ""));
  const marker = document.querySelector<HTMLElement>("#map-player");
  const self = snapshot?.players.find((player) => player.id === profile?.id);
  if (marker && self) {
    const point = mapPoint(self.x, self.z);
    marker.style.left = `${point.x}%`;
    marker.style.top = `${point.y}%`;
  }
}
function arenaPanel() {
  const peers =
    snapshot?.players.filter((player) => player.id !== profile?.id) || [];
  const queued = snapshot?.queue.includes(profile?.id || "");
  const self = snapshot?.players.find((p) => p.id === profile?.id);
  const arena = PLACES.find((p) => p.id === "arena")!;
  const atArena = self && distance(self, arena) <= 18;
  return `<p class="subtle">${atArena ? "You can join the arena queue here." : "Visit Sunstone Arena for queued matches. Direct challenges work anywhere."}</p><div class="arena-intro"><div>${icon("arena")}<h3>A fair field. A friendly challenge.</h3><p>Trainers fight at level 10 with 180 health and all class abilities. Challenge a nearby explorer anywhere on the island; direct duels start where you stand. Companions rest during duels. Both explorers must agree. The match ends on defeat, surrender, timeout, or disconnect.</p></div>${button(queued ? "Leave arena queue" : "Join arena queue", "queue", "primary", !profile || (!queued && (!atArena || !!self?.duelId || !!self?.inCombat)))}</div><div class="social-presets"><span class="eyebrow">SAY A LITTLE SOMETHING</span>${["hello", "cheer", "thanks", "ready"].map((value) => button(value[0].toUpperCase() + value.slice(1), `emote:${value}`, "secondary compact")).join("")}</div>${trainingPanel()}<div class="section-heading"><h3>Fellow explorers</h3><span>${peers.length} on this island</span></div><div class="peer-list">${peers.map((player) => `<div class="peer-row">${icon("team")}<div><strong>${esc(player.nickname)}</strong><small>${player.duelId ? "In a duel" : (self && duelReach(self, player)) || "Ready for a challenge"}</small></div>${button("Invite to duel", `duel:${esc(player.id)}`, "secondary compact", !!player.duelId || !!self?.duelId || !!self?.inCombat || !!player.inCombat || !self || !!duelReach(self, player))}</div>`).join("") || '<p class="subtle">The next explorer is just around the corner. Invite a friend to join this server in a separate browser.</p>'}</div><div class="two-columns"><div><div class="section-heading"><h3>Your recent matches</h3></div>${
    latestMatches
      .slice(0, 8)
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        return `<div class="record-row"><span>${esc(row.opponent || "Explorer")}<small>${esc(new Date(String(row.createdAt)).toLocaleDateString())}</small></span><strong>${esc(row.result)}</strong></div>`;
      })
      .join("") || '<p class="subtle">Your first rivalry is still to come.</p>'
  }</div><div><div class="section-heading"><h3>Island leaderboard</h3></div>${
    latestLeaderboard
      .slice(0, 8)
      .map((raw, i) => {
        const row = raw as Record<string, unknown>;
        return `<div class="record-row"><span><small>#${i + 1}</small> ${esc(row.nickname)}</span><strong>${esc(row.wins)} W · ${esc(row.losses)} L</strong></div>`;
      })
      .join("") ||
    '<p class="subtle">A fresh page in the island record book.</p>'
  }</div></div>`;
}
function ledgerPanel() {
  return `<div class="wallet-summary">${icon("coin")}<span>${profile?.balance.toLocaleString() || 0}<small>${esc(currency)} AVAILABLE</small></span></div><p class="subtle">${esc(currency)} is earned through your adventures. Wallet explorers holding ${WOP.minHolding.toLocaleString("en-US")} ${WOP.symbol} can convert it to ${WOP.symbol}.</p>${button(`${icon("wallet")} Open ${WOP.symbol} wallet`, "panel:wop", "secondary compact")}<div class="section-heading"><h3>Recent transactions</h3></div>${
    latestTransactions
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        return `<div class="record-row"><span>${esc(String(row.reason).replace(/[_:-]/g, " "))}<small>${esc(new Date(String(row.createdAt)).toLocaleString())}</small></span><strong class="${Number(row.amount) > 0 ? "positive" : ""}">${Number(row.amount) > 0 ? "+" : ""}${esc(row.amount)} ${esc(currency)}</strong></div>`;
      })
      .join("") ||
    empty(
      "A fresh start.",
      "Your first earnings and purchases will appear here.",
    )
  }`;
}
function settingsPanel() {
  const range = (
    key:
      | "master"
      | "music"
      | "ambience"
      | "effects"
      | "interface"
      | "creatures"
      | "sensitivity"
      | "scale",
    label: string,
    min: number,
    max: number,
    step: number,
  ) =>
    `<label class="setting-row"><span>${label}</span><input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${settings[key]}"/><output>${Math.round(settings[key] * 100)}%</output></label>`;
  const toggle = (
    key: "mute" | "backgroundAudio" | "reducedMotion" | "cameraShake",
    label: string,
    detail: string,
  ) =>
    `<label class="setting-row"><span>${label}<small>${detail}</small></span><input type="checkbox" data-setting="${key}" ${settings[key] ? "checked" : ""}/></label>`;
  return `<div class="settings-columns"><div><h3>Sound & atmosphere</h3>${range("master", "Master volume", 0, 1, 0.05)}${range("music", "Island music", 0, 1, 0.05)}${range("ambience", "Nature & environment", 0, 1, 0.05)}${range("effects", "Combat & footsteps", 0, 1, 0.05)}${range("creatures", "Creature voices", 0, 1, 0.05)}${range("interface", "Interface & rewards", 0, 1, 0.05)}${toggle("mute", "Mute all sound", "You can always follow visual cues.")}${toggle("backgroundAudio", "Sound in background", "Keep audio playing when you switch tabs.")}<p class="subtle">Music follows the region and combat. Nature gets quieter at night; nearby water and fires have their own sound.</p><h3>Comfort & display</h3><label class="setting-row"><span>Visual quality</span><select data-setting="quality">${["low", "medium", "high"].map((value) => `<option ${settings.quality === value ? "selected" : ""} value="${value}">${value[0].toUpperCase() + value.slice(1)}</option>`).join("")}</select></label>${range("scale", "Interface scale", 0.85, 1.25, 0.05)}${toggle("reducedMotion", "Reduced motion", "Reduce movement in the interface and world.")} ${toggle("cameraShake", "Camera shake", "Gentle impact feedback during combat.")}</div><div><h3>Camera & controls</h3>${range("sensitivity", "Camera sensitivity", 0.3, 2, 0.1)}<p class="subtle">Click a binding and press a new key. Menus capture your input. The shared world does not pause.</p><div class="keybind-list">${Object.entries(
    settings.keybinds,
  )
    .map(
      ([action, code]) =>
        `<div class="setting-row"><span>${action[0].toUpperCase() + action.slice(1)}</span>${button(esc(code.replace("Key", "").replace("Left", "")), `rebind:${action}`, "keybinding")}</div>`,
    )
    .join(
      "",
    )}</div><p class="subtle">Drag / Q / R: orbit camera · Scroll: zoom<br />1–6: abilities · T / right-click: auto attack · Tab / Shift+Tab: cycle targets · Esc: clear target · Space: dash · Alt: jump<br />Ctrl+1–4: companion moves · Shift+1–3: switch Pokémon · G: attack · H: follow<br />C: team · P: Pokédex · B: bag · J: journal · M: map</p>${button("Reset preferences", "reset-settings", "secondary compact")}${performanceMarkup()}</div></div>`;
}
function creditsPanel() {
  return `<div class="credits-lead">${icon("leaf")}<h3>Leave a little room<br />for wonder.</h3><p>A fantasy adventure with Pokémon companions, built around friendship, exploration, and a shared island.</p></div><div class="two-columns"><div><h3>Art & world</h3><p>Original island composition, interface, visual effects, and creature identities.</p><p>Modular player characters, hairstyles, clothing and animations by Quaternius (CC0). Weapons and village characters by Kay Lousberg (KayKit Adventurers, CC0). <a href="/legal/CHARACTER_CREDITS.txt" target="_blank" rel="noreferrer">Character sources and modifications</a>. <a href="/character-studio.html" target="_blank" rel="noreferrer">Preview the character studio</a>. Wildlife and scenery by Quaternius: Ultimate Monsters, Ultimate Modular Men, Stylized Nature MegaKit, Medieval Village MegaKit, Medieval Village, Fantasy Props MegaKit, Ultimate Stylized Nature and Pirate Kit. Additional nature and castle props by Kenney. Licensed CC0. Local asset details and license copies are included in the project’s asset manifest.</p></div><div><h3>Sound & technology</h3><p>Music by RandomMind and troubadour. Nature recordings by Thimras, LokiF, RandomMind, AntumDeluge and Kresiek The Furry. Effects by Kenney, rubberduck, artisticdude, bart, Fantozzi/qubodup and Peludo/RNAn. All sourced under CC0, edited and mixed for the game. Creature voices are fantasy effects, not official Pokémon cries. <a href="/legal/AUDIO_CREDITS.txt" target="_blank" rel="noreferrer">Full audio credits and sources</a>. <a href="/sound-studio.html" target="_blank" rel="noreferrer">Visit the sound studio</a>.</p><p>Rendered with Babylon.js. Multiplayer powered by Colyseus. Built with TypeScript and Vite.</p><p>The working title and in-game currency are configurable. Pokémon models and characters belong to Nintendo, Creatures Inc. and GAME FREAK inc. Model source: Pokémon 3D API. These assets are not covered by the CC0 environment license.</p><p><a href="/legal/SOFTWARE_LICENSES.txt" target="_blank" rel="noreferrer">Software license notices</a> · <a href="/inspect.html" target="_blank" rel="noreferrer">Creature atelier</a> · <a href="/world-tour.html" target="_blank" rel="noreferrer">Explore the regions</a></p></div></div><div class="notice">${icon("journal")}<span><strong>Your first field notes</strong><br />Choose a starter. Visit the expedition board. Head out toward the meadow. Press Tab to target an enemy, T or right-click to auto attack and 1–6 for class abilities; G sends your companion; weaken it, then press F to attempt taming.</span></div>`;
}

let binding: string | null = null;
async function handleAction(action: string) {
  void audio.start();
  audio.play("ui");
  const [name, ...parts] = action.split(":");
  const value = parts.join(":");
  switch (name) {
    case "dex-reward":
      send("dexReward", { count: Number(value) });
      break;
    case "petmove":
      send("petMove", { slot: Number(value), ...(target ? { target } : {}) });
      break;
    case "swap":
      send("swap", { slot: Number(value) });
      break;
    case "start":
      await connect("guest");
      break;
    case "reconnect":
      await connect(isGuest(profile) ? "guest" : "wallet");
      break;
    case "wallet":
      await connect("wallet", value as WalletKind);
      break;
    case "wallet-continue":
      await connect("wallet");
      break;
    case "wallet-signout":
      localStorage.removeItem(STORE.wallet);
      localStorage.removeItem(STORE.address);
      refreshEntry();
      break;
    case "wallet-link":
      await linkWallet(value as WalletKind);
      break;
    case "wop-convert":
      await convertWop();
      break;
    case "panel":
      document.querySelector("#caught-card")?.remove();
      openPanel(value as Panel);
      break;
    case "close":
      closePanel();
      break;
    case "appearance-save": {
      if (!appearanceEditor) break;
      const nickname = cleanDisplayName(appearanceEditor.nickname);
      if (!validDisplayName(nickname)) {
        notify(
          "Use 2–18 letters, numbers, spaces, apostrophes or hyphens for your name.",
          "error",
        );
        break;
      }
      send("appearance", { appearance: appearanceEditor.appearance, nickname });
      break;
    }
    case "rename-pet": {
      const field = document.getElementById(
        `pet-name-${value}`,
      ) as HTMLInputElement | null;
      if (!field) break;
      const nickname = cleanDisplayName(field.value);
      if (nickname && !validDisplayName(nickname, 1)) {
        notify(
          "Use up to 18 letters, numbers, spaces, apostrophes or hyphens.",
          "error",
        );
        break;
      }
      send("renamePet", { creature: value, nickname });
      break;
    }
    case "class-select":
      if (CLASS_IDS.includes(value as ClassId))
        selectedClass = value as ClassId;
      characterCreator?.setClass(selectedClass);
      break;
    case "class-confirm":
      if (profile?.creatures.length)
        send("class", { classId: selectedClass, appearance: draftAppearance });
      else {
        classChosen = true;
        starterScreen();
      }
      break;
    case "pet":
      send("pet", { mode: value, ...(value === "attack" ? { target } : {}) });
      break;
    case "travel":
      send("travel", { destination: value });
      closePanel();
      break;
    case "starter-select":
      selectedStarter = value;
      starterScreen();
      break;
    case "starter-back":
      classChosen = false;
      starterScreen();
      break;
    case "starter-confirm":
      send("starter", {
        species: selectedStarter,
        classId: selectedClass,
        appearance: draftAppearance,
      });
      break;
    case "ability":
      attack(Number(value));
      break;
    case "tame":
      send("tame", { target, item: "capsule" });
      break;
    case "clear-target":
      selectTarget(null);
      break;
    case "interact":
      interact();
      break;
    case "buy":
      send("buy", { item: value, quantity: 1 });
      break;
    case "use":
      if (value === "capsule" || value === "prism") {
        send("tame", { target, item: value });
        closePanel();
      } else send("use", { item: value });
      break;
    case "accept-quest":
      send("acceptQuest", { quest: value });
      break;
    case "claim":
      send("claim", { quest: value });
      break;
    case "deploy":
      send("deploy", { id: value || null });
      break;
    case "add-team":
      send("team", { ids: [...(profile?.team || []), value] });
      break;
    case "store":
      send("team", { ids: profile?.team.filter((id) => id !== value) });
      break;
    case "reorder":
      send("team", {
        ids: [value, ...(profile?.team.filter((id) => id !== value) || [])],
      });
      break;
    case "evolve":
      send("evolve", {
        id: parts[0],
        ...(parts[1] ? { species: parts[1] } : {}),
      });
      break;
    case "practice-reset":
      send("practiceReset");
      break;
    case "practice-target":
      if (TRAINING_TARGETS.some((t) => t.id === value)) {
        selectTarget(value);
        closePanel();
      }
      break;
    case "duel":
      send("duel", { target: value });
      closePanel();
      break;
    case "duelAccept":
    case "duelReject":
    case "duelCancel":
      send(name, { id: value });
      break;
    case "emote":
      send("emote", { value });
      break;
    case "surrender":
      send("surrender");
      break;
    case "queue":
      send("queue", { join: !snapshot?.queue.includes(profile?.id || "") });
      break;
    case "new-guest":
      localStorage.removeItem(STORE.guest);
      document.querySelector("#connection")!.classList.add("hidden");
      refreshEntry();
      await connect("guest");
      break;
    case "greet-companion": {
      const self = snapshot?.players.find((p) => p.id === profile?.id);
      if (
        !self?.companion ||
        self.hp <= 0 ||
        (self.pet?.hp ?? 1) <= 0 ||
        self.inCombat ||
        self.duelId
      ) {
        combatError(
          "Greet your companion while resting safely outside combat.",
        );
        break;
      }
      send("emote", { value: "hello" });
      break;
    }
    case "invite-friend":
      if (room) {
        const invitation = islandInvite(location.origin, room.roomId);
        try {
          await navigator.clipboard.writeText(invitation);
          notify(
            "Invitation link copied. Your friend can choose their explorer and join this island.",
          );
        } catch {
          const output = document.querySelector("#invite-fallback");
          if (output)
            output.textContent = `Copy this invitation: ${invitation}`;
        }
      }
      break;
    case "copy-room":
      if (room) {
        try {
          await navigator.clipboard.writeText(room.roomId);
          notify("Island code copied. Share it with a friend on this server.");
        } catch {
          notify(`Your island code is ${room.roomId}.`);
        }
      }
      break;
    case "place": {
      const place = places().find((entry) => entry.id === value);
      document.querySelector("#map-notes")!.innerHTML =
        `${icon("compass")}<p><strong>${esc(place?.name)}</strong><br />${esc(place?.description)}<br /><small>Coordinates: ${esc(place?.x)}, ${esc(place?.z)}</small></p>`;
      break;
    }
    case "dash":
      world.dash();
      break;
    case "rebind":
      binding = value;
      notify(`Press a key for ${value}. Escape cancels.`);
      break;
    case "reset-settings":
      settings = structuredClone(defaults);
      saveSettings();
      renderPanel();
      break;
  }
}
app.addEventListener("click", (event) => {
  const target = (event.target as Element).closest<HTMLButtonElement>(
    "[data-action]",
  );
  if (target && !target.disabled) void handleAction(target.dataset.action!);
  if ((event.target as HTMLElement).classList.contains("modal-backdrop"))
    closePanel();
});
app.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement;
  const key = input.dataset.setting as keyof Settings;
  if (!key) return;
  const value =
    input.type === "checkbox"
      ? input.checked
      : input.type === "range"
        ? Number(input.value)
        : input.value;
  (settings as unknown as Record<string, unknown>)[key] = value;
  if (input.type === "range")
    input.parentElement!.querySelector("output")!.value =
      `${Math.round(Number(value) * 100)}%`;
  saveSettings();
  void audio.start();
});
window.addEventListener(
  "keydown",
  (event) => {
    if (chat?.open) {
      if (
        event.target !== chat.input &&
        ["Escape", "Enter"].includes(event.key)
      ) {
        event.preventDefault();
        chat.close();
      }
      return;
    }
    if (
      event.key === "Enter" &&
      playing &&
      !activePanel &&
      !binding &&
      !(event.target as HTMLElement).matches("input,select,textarea,button")
    ) {
      event.preventDefault();
      chat?.show();
      return;
    }
    if (binding) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key !== "Escape") {
        const reserved = [
          "Escape",
          "Tab",
          "Space",
          "Digit1",
          "Digit2",
          "Digit3",
          "Digit4",
          "Digit5",
          "Digit6",
          "KeyT",
          "KeyG",
          "KeyH",
          "KeyC",
          "KeyB",
          "KeyJ",
          "KeyM",
        ];
        if (
          reserved.includes(event.code) ||
          Object.entries(settings.keybinds).some(
            ([key, code]) => key !== binding && code === event.code,
          )
        ) {
          notify("That key is already in use. Choose another.", "error");
          return;
        }
        settings.keybinds[binding] = event.code;
        saveSettings();
      }
      binding = null;
      renderPanel();
      return;
    }
    if (
      !activePanel &&
      playing &&
      profile?.classId &&
      !(event.target as HTMLElement).matches("input,select,textarea") &&
      ["KeyG", "KeyH"].includes(event.code)
    ) {
      send("pet", {
        mode: event.code === "KeyG" ? "attack" : "passive",
        ...(event.code === "KeyG" ? { target } : {}),
      });
      return;
    }
    if (event.key === "Escape") {
      if (activePanel) closePanel();
      else if (playing && target) selectTarget(null);
      else if (playing) openPanel("settings");
      return;
    }
    if (activePanel && event.key === "Tab") {
      const elements = [
        ...document.querySelectorAll<HTMLElement>(
          '[role="dialog"] :is(button, input, select, a[href], summary):not([disabled])',
        ),
      ].filter(
        (element) =>
          element.tabIndex >= 0 && element.getClientRects().length > 0,
      );
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (
      activePanel ||
      !playing ||
      (event.target as HTMLElement).matches("input,select,textarea") ||
      event.repeat
    )
      return;
    if ((event.ctrlKey || event.shiftKey) && /^Digit[1-4]$/.test(event.code)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const slot = Number(event.code.slice(-1)) - 1;
      if (event.ctrlKey)
        send("petMove", { slot, ...(target ? { target } : {}) });
      else if (slot < 3) send("swap", { slot });
      return;
    }
    const panelKey: Record<string, Panel> = {
      KeyP: "pokedex",
      KeyC: "collection",
      KeyB: "inventory",
      KeyJ: "quests",
      KeyM: "map",
    };
    if (panelKey[event.code]) {
      event.preventDefault();
      openPanel(panelKey[event.code]);
    }
  },
  true,
);
window.addEventListener("beforeunload", () => {
  audio.dispose();
  world?.dispose();
  void room?.leave();
});

document.title = `${title} — ${BRAND.subtitle}`;
shell();
saveSettings();
const interfaceReady = prepareInterface();
void interfaceReady.catch(failLoading);
void startup
  .track("scene", "world", "Island lighting & first frame", () =>
    createWorld(canvas, {
      onTarget: selectTarget,
      onMove(dx, dz, sprint, yaw) {
        if (!connected || activePanel || !profile?.creatures.length) return;
        room?.send("command", { kind: "move", dx, dz, sprint, yaw });
      },
      onInteract: interact,
      onAbility: attack,
      onDash: (dx, dz) => {
        if (connected && playing && !activePanel) send("dash", { dx, dz });
      },
      onStep: (point, landing, sprint) => audio.step(point, landing, sprint),
      onJump: () => audio.play("jump"),
      onListener: (point, alpha) => audio.setListener(point, alpha),
      onImpact: (event) => audio.playImpact(event),
      onAutoAttack(id) {
        selectTarget(id);
        if (connected && playing && !activePanel) {
          lastAttackSent = Date.now();
          send("autoattack", { target: id });
        }
      },
      onTame() {
        send("tame", { target, item: "capsule" });
      },
      onBoundary() {
        if (Date.now() - lastBoundaryNote < 6000) return;
        lastBoundaryNote = Date.now();
        notify(GUEST_LIMIT_MESSAGE);
      },
    }),
  )
  .then(async (instance) => {
    world = instance;
    await interfaceReady;
    saveSettings();
    finishLoading();
    refreshEntry(true);
    document.querySelector("#loading-status")!.innerHTML =
      '<span class="live-dot"></span> Your island is ready';
    if (sessionStorage.getItem(STORE.resume) && stored(STORE.wallet)) {
      sessionStorage.removeItem(STORE.resume);
      void connect("wallet");
    }
  })
  .catch((error) => {
    world?.dispose();
    world = undefined!;
    failLoading();
    document.querySelector("#loading-status")!.textContent =
      "The island could not load. Refresh to try again.";
    notify(
      error instanceof Error
        ? error.message
        : "3D rendering is unavailable in this browser.",
      "error",
    );
  });
setInterval(refreshCombatControls, 80);

document.addEventListener("input", (event) => {
  if ((event.target as HTMLElement).id === "wop-pd")
    updateWopPreview(wopStatus);
});
document.addEventListener("keydown", (event) => {
  if ((event.target as HTMLElement).id === "wop-pd" && event.key === "Enter") {
    event.preventDefault();
    void convertWop();
  }
});
document.addEventListener("change", (event) => {
  const element = event.target as HTMLSelectElement;
  if (element.dataset.learnCreature)
    send("learn", {
      creature: element.dataset.learnCreature,
      slot: Number(element.dataset.learnSlot),
      move: element.value,
    });
});
