import type { Biome } from "../../../../packages/shared/types";
export type AudioBus =
  | "music"
  | "ambience"
  | "effects"
  | "interface"
  | "creatures";
export type Point = { x: number; z: number };
export const audioDefaults = {
  master: 0.65,
  music: 0.45,
  ambience: 0.65,
  effects: 0.75,
  interface: 0.55,
  creatures: 0.6,
  mute: false,
  backgroundAudio: false,
};
export type AudioSettings = typeof audioDefaults;
export const tracks: Record<Biome, string> = {
  town: "town",
  meadow: "meadow",
  forest: "forest",
  ruins: "mystery",
  desert: "highlands",
  marsh: "mystery",
  tundra: "winter",
  highlands: "highlands",
};
export const audioUrl = (id: string) => `/assets/audio/${id}.mp3`;
export const variants = (name: string, count = 3) =>
  Array.from({ length: count }, (_, i) => `${name}-${i}`);
export interface Cue {
  files: string[];
  bus: AudioBus;
  volume: number;
  priority: number;
  interval: number;
}
const cue = (
  files: string | string[],
  volume = 0.8,
  priority = 2,
  interval = 0.07,
  bus: AudioBus = "effects",
): Cue => ({
  files: typeof files === "string" ? [files] : files,
  volume,
  priority,
  interval,
  bus,
});
export const cues = {
  victory: cue("victory", 0.75, 6, 2, "interface"),
  defeat: cue("defeat", 0.6, 6, 2, "interface"),
  ui: cue("ui", 0.55, 4, 0.06, "interface"),
  open: cue("open", 0.6, 4, 0.12, "interface"),
  close: cue("close", 0.5, 4, 0.12, "interface"),
  error: cue("error", 0.55, 5, 0.6, "interface"),
  target: cue("target", 0.4, 4, 0.12, "interface"),
  page: cue("page", 0.65, 4, 0.15, "interface"),
  bag: cue("bag", 0.7, 4, 0.15, "interface"),
  coin: cue("coin", 0.7, 4, 0.25, "interface"),
  confirm: cue("confirm", 0.75, 5, 0.35, "interface"),
  reward: cue("reward", 0.85, 5, 0.5, "interface"),
  swing: cue(variants("swing"), 0.7),
  hit: cue(variants("hit"), 0.85),
  heavy: cue(variants("heavy"), 0.95, 3),
  metal: cue(variants("metal"), 0.65),
  shatter: cue(variants("shatter"), 0.8, 3),
  dash: cue("cloth", 0.9),
  equip: cue("equip", 0.6),
  fire: cue("fire-cast", 0.8),
  "fire-hit": cue("fire-impact", 0.9, 3),
  ice: cue("ice", 0.8),
  "ice-cast": cue("ice-cast", 0.7),
  water: cue("water", 0.85),
  leaf: cue("earth", 0.7),
  earth: cue("earth", 0.9),
  spark: cue("spark", 0.7),
  spirit: cue("spirit", 0.7),
  heal: cue("heal", 0.7, 3, 0.2),
  guard: cue("magic", 0.55),
  magic: cue("magic", 0.7),
  "capture-shake": cue("capture-shake", 0.8, 5, 0.15, "interface"),
  "creature-hurt": cue("creature-hurt", 0.5, 1, 0.6, "creatures"),
  "creature-faint": cue("creature-faint", 0.6, 2, 0.7, "creatures"),
  "creature-call": cue(variants("creature-call"), 0.45, 1, 2, "creatures"),
  "creature-roar": cue("creature-roar", 0.75, 4, 1, "creatures"),
  "step-stone": cue(variants("step-stone", 4), 0.42, 1, 0.13),
  "step-grass": cue(variants("step-grass", 4), 0.55, 1, 0.13),
  "step-snow": cue(variants("step-snow", 4), 0.55, 1, 0.13),
  "step-sand": cue(variants("step-sand", 4), 0.65, 1, 0.13),
  "step-water": cue(variants("step-water", 2), 0.5, 1, 0.2),
} satisfies Record<string, Cue>;
export type CueId = keyof typeof cues;
export function normalizeAudio(
  settings: Partial<AudioSettings>,
): AudioSettings {
  const result = { ...audioDefaults };
  for (const key of [
    "master",
    "music",
    "ambience",
    "effects",
    "interface",
    "creatures",
  ] as const) {
    const value = settings[key];
    if (typeof value === "number" && Number.isFinite(value))
      result[key] = Math.max(0, Math.min(1, value));
  }
  for (const key of ["mute", "backgroundAudio"] as const)
    if (typeof settings[key] === "boolean") result[key] = settings[key];
  return result;
}
export function spatialMix(
  listener: Point,
  point?: Point,
  cameraAlpha = -Math.PI / 2,
  radius = 40,
) {
  if (!point) return { volume: 1, pan: 0 };
  const dx = point.x - listener.x,
    dz = point.z - listener.z,
    distance = Math.hypot(dx, dz);
  return {
    volume: Math.max(0, 1 - distance / radius) ** 2,
    pan: Math.max(
      -0.85,
      Math.min(
        0.85,
        (-dx * Math.sin(cameraAlpha) + dz * Math.cos(cameraAlpha)) /
          Math.max(5, distance),
      ),
    ),
  };
}
