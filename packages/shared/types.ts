import type { Appearance } from "./appearance";
import type { HeroCast, AttackShape, DashState } from "./combat";
import type { ClassId } from "./classes";
import type { AuraView, Outcome } from "./combat-rules";
import type { Stats } from "./pokemon";
export type Element = "leaf" | "flame" | "tide" | "stone" | "spark" | "spirit";
export type Biome =
  | "town"
  | "meadow"
  | "forest"
  | "ruins"
  | "desert"
  | "marsh"
  | "tundra"
  | "highlands";
export interface Creature {
  id: string;
  species: string;
  nickname: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  evolved: boolean;
  trait: string;
  moves: string[];
  nature?: string;
  ivs?: Stats;
  shiny?: boolean;
  dataVersion?: number;
}
export interface Profile {
  /** Solana wallet address; absent for guest accounts. */
  wallet?: string;
  appearance?: Appearance;
  classId?: ClassId;
  heroHp?: number;
  waystones?: string[];
  id: string;
  nickname: string;
  balance: number;
  creatures: Creature[];
  team: string[];
  active: string | null;
  inventory: Record<string, number>;
  quests: Record<string, number>;
  claimed: string[];
  discoveries: string[];
  wins: number;
  losses: number;
  pokedex?: { seen: string[]; caught: string[]; rewards: number[] };
}
export interface PlayerView {
  practice?: import("./training").PracticeView;
  appearance?: Appearance;
  companionName?: string;
  cast?: HeroCast;
  level?: number;
  resource?: number;
  resourceMax?: number;
  combo?: number;
  gcdUntil?: number;
  /** Auto-attack target and the time of the next swing. */
  autoTarget?: string;
  swingAt?: number;
  inCombat?: boolean;
  auras?: AuraView[];
  dash?: DashState;
  classId?: ClassId;
  petTarget?: string;
  petMode?: "assist" | "passive";
  pet?: {
    x: number;
    z: number;
    yaw: number;
    moving: boolean;
    hp: number;
    maxHp: number;
    cooldowns: Record<string, number>;
    cast?: HeroCast;
    shiny?: boolean;
  };
  id: string;
  nickname: string;
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
  companion: string | null;
  companionLevel: number;
  companionEvolved: boolean;
  hp: number;
  maxHp: number;
  emote?: string;
  duelId?: string;
  cooldowns?: Record<string, number>;
  guardUntil?: number;
  stunUntil?: number;
  slowUntil?: number;
  burnUntil?: number;
}
export interface WildView {
  shiny?: boolean;
  activity?: import("./pokemon-habitats").PokemonActivity;
  id: string;
  species: string;
  x: number;
  z: number;
  level: number;
  hp: number;
  maxHp: number;
  state: "idle" | "roam" | "alert" | "chase" | "attack" | "retreat" | "defeat";
  elite: boolean;
  boss: boolean;
  phase: number;
  cast?: AttackShape;
  target?: string;
  respawnAt?: number;
  auras?: AuraView[];
  /** Share of the top threat held by each player, 0–100. */
  threat?: Record<string, number>;
  evading?: boolean;
}
export interface DuelView {
  arena?: boolean;
  id: string;
  a: string;
  b: string;
  state: "invite" | "active" | "finished";
  winner?: string;
  expires: number;
}
export interface WorldSnapshot {
  conditions?: ReturnType<typeof import("./pokemon-habitats").worldConditions>;
  time: number;
  players: PlayerView[];
  wilds: WildView[];
  duels: DuelView[];
  queue: string[];
  roomId: string;
}
export interface GameEvent {
  capture?: {
    success: boolean;
    shakes: number;
    duration: number;
    species: string;
    shiny: boolean;
    creatureId?: string;
  };
  evolution?: { from: string; to: string };
  x?: number;
  z?: number;
  actor?: "hero" | "companion";
  type: string;
  message: string;
  target?: string;
  source?: string;
  amount?: number;
  ability?: string;
  outcome?: Outcome;
  /** An automatic weapon swing rather than an ability. */
  auto?: boolean;
  heal?: boolean;
}
export interface LedgerEntry {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}
export interface MatchEntry {
  id: string;
  opponent: string;
  result: string;
  createdAt: string;
}
export type Command = {
  kind: string;
  requestId?: string;
  [key: string]: unknown;
};
