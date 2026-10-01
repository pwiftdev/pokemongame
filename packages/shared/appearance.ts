export const RACE_IDS = ["human", "elf", "dwarf", "orc"] as const;
export type RaceId = (typeof RACE_IDS)[number];
export const BODY_IDS = ["masculine", "feminine"] as const;
export const HAIR_IDS = [
  "bald",
  "cropped",
  "swept",
  "parted",
  "long",
  "buns",
] as const;
export const BEARD_IDS = ["none", "short", "full"] as const;
export const FACE_IDS = ["balanced", "soft", "angular", "strong"] as const;
export const OUTFIT_IDS = ["ranger", "traveler"] as const;
export const BROW_IDS = ["natural", "bold", "slender"] as const;
export const RACES: Record<
  RaceId,
  {
    name: string;
    description: string;
    height: number;
    width: number;
    skin: string[];
  }
> = {
  human: {
    name: "Human",
    description: "Curious wayfarers, at home wherever the road leads.",
    height: 1.9,
    width: 1,
    skin: [
      "#f1d6bc",
      "#e8bd9b",
      "#d7a17c",
      "#bb825b",
      "#9c6746",
      "#7a4d36",
      "#583a2c",
      "#3b2922",
    ],
  },
  elf: {
    name: "Elf",
    description: "Long-eared guardians of the ancient island forests.",
    height: 2.06,
    width: 0.93,
    skin: [
      "#efdac9",
      "#dbc5b5",
      "#c3b1ce",
      "#a393bf",
      "#8b9eaf",
      "#75968b",
      "#9b7359",
      "#5b485f",
    ],
  },
  dwarf: {
    name: "Dwarf",
    description: "Stout explorers with a love of craft and wild places.",
    height: 1.48,
    width: 1.2,
    skin: [
      "#efd1b6",
      "#dfb18c",
      "#ca916e",
      "#ad7851",
      "#8d5e42",
      "#70492f",
      "#54392c",
      "#3b2922",
    ],
  },
  orc: {
    name: "Orc",
    description: "Broad-shouldered wanderers with powerful features and tusks.",
    height: 2.04,
    width: 1.16,
    skin: [
      "#a8b97c",
      "#8ba56b",
      "#708b53",
      "#587745",
      "#476340",
      "#657d73",
      "#927b55",
      "#655241",
    ],
  },
};
export const HAIR_COLORS = [
  "#221c1b",
  "#493125",
  "#775038",
  "#aa7145",
  "#d1aa65",
  "#e4d3a9",
  "#bd643d",
  "#a9b0bb",
  "#e3e5e4",
  "#6c607e",
];
export const EYE_COLORS = [
  "#64422b",
  "#b6873e",
  "#607b3c",
  "#448aa1",
  "#617caf",
  "#8071a0",
  "#c4b96d",
  "#8a999a",
];
export const OUTFIT_COLORS = [
  "#b9c5aa",
  "#718aa1",
  "#b27b70",
  "#a69ac3",
  "#d0b271",
  "#86afa9",
  "#9d9b9c",
  "#5c6572",
];
export interface Appearance {
  race: RaceId;
  body: (typeof BODY_IDS)[number];
  skin: number;
  hairStyle: (typeof HAIR_IDS)[number];
  hairColor: number;
  eyeColor: number;
  facialHair: (typeof BEARD_IDS)[number];
  face: (typeof FACE_IDS)[number];
  brow: (typeof BROW_IDS)[number];
  height: number;
  jaw: number;
  nose: number;
  ears: number;
  outfit: (typeof OUTFIT_IDS)[number];
  outfitColor: number;
  shoulders: boolean;
}
export const DEFAULT_APPEARANCE: Appearance = {
  race: "human",
  body: "masculine",
  skin: 2,
  hairStyle: "parted",
  hairColor: 1,
  eyeColor: 0,
  facialHair: "none",
  face: "balanced",
  brow: "natural",
  height: 1,
  jaw: 0,
  nose: 0,
  ears: 0.5,
  outfit: "ranger",
  outfitColor: 0,
  shoulders: true,
};
export function normalizeAppearance(
  value?: Partial<Appearance> | null,
): Appearance {
  const result = { ...DEFAULT_APPEARANCE };
  if (!value || typeof value !== "object") return result;
  const choices = {
    race: RACE_IDS,
    body: BODY_IDS,
    hairStyle: HAIR_IDS,
    facialHair: BEARD_IDS,
    face: FACE_IDS,
    brow: BROW_IDS,
    outfit: OUTFIT_IDS,
  };
  for (const key of Object.keys(choices) as (keyof typeof choices)[]) {
    const candidate = value[key];
    if (candidate && (choices[key] as readonly string[]).includes(candidate))
      Object.assign(result, { [key]: candidate });
  }
  for (const [key, count] of [
    ["skin", 8],
    ["hairColor", HAIR_COLORS.length],
    ["eyeColor", EYE_COLORS.length],
    ["outfitColor", OUTFIT_COLORS.length],
  ] as const) {
    const n = value[key];
    if (typeof n === "number" && Number.isInteger(n) && n >= 0 && n < count)
      result[key] = n;
  }
  for (const [key, min, max] of [
    ["height", 0.9, 1.1],
    ["jaw", -1, 1],
    ["nose", -1, 1],
    ["ears", 0, 1],
  ] as const) {
    const n = value[key];
    if (typeof n === "number" && Number.isFinite(n))
      result[key] = Math.max(min, Math.min(max, n));
  }
  if (typeof value.shoulders === "boolean") result.shoulders = value.shoulders;
  return result;
}
export function appearanceKey(value?: Partial<Appearance>) {
  return JSON.stringify(normalizeAppearance(value));
}
export function cleanDisplayName(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}
export function validDisplayName(value: string, minimum = 2) {
  return (
    value.length >= minimum &&
    value.length <= 18 &&
    /^[\p{L}\p{M}\p{N} '\-]+$/u.test(value)
  );
}

export function validAppearance(value: unknown): value is Appearance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const normalized = normalizeAppearance(value);
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === Object.keys(normalized).length &&
    Object.entries(normalized).every(
      ([key, expected]) => record[key] === expected,
    )
  );
}
