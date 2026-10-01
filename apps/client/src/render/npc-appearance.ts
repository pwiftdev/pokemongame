import {
  DEFAULT_APPEARANCE,
  type Appearance,
} from "../../../../packages/shared/appearance";
import type { ClassId } from "../../../../packages/shared/classes";
export type NpcRole =
  | "ranger"
  | "scholar"
  | "healer"
  | "merchant"
  | "captain"
  | "keeper"
  | "marshal";
const uniforms: Record<
  NpcRole,
  { classId: ClassId; armed: boolean; appearance: Partial<Appearance> }
> = {
  ranger: {
    classId: "rogue",
    armed: true,
    appearance: {
      race: "elf",
      skin: 1,
      outfit: "ranger",
      outfitColor: 0,
      hairStyle: "swept",
      hairColor: 2,
    },
  },
  scholar: {
    classId: "mage",
    armed: false,
    appearance: {
      race: "elf",
      body: "feminine",
      outfit: "traveler",
      outfitColor: 3,
      hairStyle: "long",
      hairColor: 8,
      shoulders: false,
    },
  },
  healer: {
    classId: "mage",
    armed: false,
    appearance: {
      body: "feminine",
      skin: 4,
      outfit: "traveler",
      outfitColor: 5,
      hairStyle: "buns",
      hairColor: 0,
      shoulders: false,
    },
  },
  merchant: {
    classId: "rogue",
    armed: false,
    appearance: {
      body: "feminine",
      skin: 1,
      outfit: "traveler",
      outfitColor: 2,
      hairStyle: "parted",
      hairColor: 6,
      shoulders: false,
    },
  },
  captain: {
    classId: "knight",
    armed: true,
    appearance: {
      body: "feminine",
      skin: 3,
      outfit: "ranger",
      outfitColor: 1,
      hairStyle: "cropped",
      hairColor: 7,
    },
  },
  keeper: {
    classId: "barbarian",
    armed: false,
    appearance: {
      race: "dwarf",
      skin: 2,
      outfit: "traveler",
      outfitColor: 4,
      hairStyle: "bald",
      facialHair: "full",
      hairColor: 2,
      shoulders: false,
    },
  },
  marshal: {
    classId: "knight",
    armed: true,
    appearance: {
      race: "orc",
      skin: 3,
      outfit: "ranger",
      outfitColor: 7,
      hairStyle: "cropped",
      hairColor: 0,
    },
  },
};
export function npcAppearance(role: NpcRole) {
  const preset = uniforms[role];
  return {
    ...preset,
    appearance: { ...DEFAULT_APPEARANCE, ...preset.appearance },
  };
}
