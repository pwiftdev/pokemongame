import {
  BODY_IDS,
  BEARD_IDS,
  BROW_IDS,
  FACE_IDS,
  HAIR_COLORS,
  HAIR_IDS,
  EYE_COLORS,
  OUTFIT_COLORS,
  RACE_IDS,
  RACES,
  type Appearance,
} from "../../../../packages/shared/appearance";
import { CLASS_IDS, CLASSES } from "../../../../packages/shared/classes";
import type { CreatorOptions } from "./character-creator";
import { escape as esc, icon } from "./icons";
import { onboardingSteps } from "./onboarding";
const labels: Record<string, string> = {
  masculine: "Body A",
  feminine: "Body B",
  bald: "Bald",
  cropped: "Close crop",
  swept: "Swept crop",
  parted: "Side part",
  long: "Long",
  buns: "Twin buns",
  none: "Clean shaven",
  short: "Short beard",
  full: "Full beard",
  balanced: "Balanced",
  soft: "Soft",
  angular: "Angular",
  strong: "Strong",
  natural: "Natural",
  bold: "Bold",
  slender: "Slender",
};

export function paletteMarkup(
  appearance: Appearance,
  key: keyof Appearance,
  title: string,
  colors: string[],
) {
  return `<fieldset class="creator-palette"><legend>${title}</legend><div>${colors.map((color, i) => `<button type="button" data-swatch="${key}:${i}" style="--swatch:${color}" aria-label="${title} ${i + 1}" aria-pressed="${appearance[key] === i}"></button>`).join("")}</div></fieldset>`;
}
export function creatorMarkup(options: CreatorOptions) {
  const { appearance, classId } = options;
  const select = (
    key: keyof Appearance,
    title: string,
    values: readonly string[],
  ) =>
    `<label class="creator-field"><span>${title}</span><select data-look="${key}" aria-label="${title}">${values.map((v) => `<option value="${v}" ${appearance[key] === v ? "selected" : ""}>${labels[v] ?? v}</option>`).join("")}</select></label>`;
  const slider = (
    key: keyof Appearance,
    title: string,
    min: number,
    max: number,
    step: number,
  ) =>
    `<label class="creator-field"><span>${title}<output data-value="${key}">${Math.round(Number(appearance[key]) * 100)}%</output></span><input aria-label="${title}" type="range" data-look="${key}" min="${min}" max="${max}" step="${step}" value="${appearance[key]}"/></label>`;
  const swatches = (key: keyof Appearance, title: string, colors: string[]) =>
    paletteMarkup(appearance, key, title, colors);
  return `<div class="character-creator"><header class="creator-header"><div><span class="eyebrow">${options.editing ? "HEARTHWICK CHARACTER STUDIO" : "A NEW ADVENTURER"}</span><h2>${options.editing ? "Your look. Your story." : "Make your mark."}</h2></div>${options.editing ? `<span class="creator-studio-badge">${icon("team")} HEARTHWICK STUDIO</span>` : onboardingSteps(1)}</header><div class="creator-layout"><div class="creator-preview"><canvas aria-label="Live character preview. Drag to rotate and scroll to zoom." tabindex="0"></canvas><div class="creator-preview-tools"><button type="button" data-view="body" aria-pressed="true">Full body</button><button type="button" data-view="face" aria-pressed="false">Face</button><button type="button" data-turn="-1" aria-label="Turn left">↶</button><button type="button" data-turn="1" aria-label="Turn right">↷</button></div><div class="creator-preview-status" role="status">Loading your live preview…</div><div class="creator-name"><strong>${esc(options.nickname)}</strong><span id="creator-subtitle"></span></div><p class="creator-drag-hint">Drag to rotate · Scroll to zoom</p></div><aside class="creator-options"><div class="creator-tabs" role="tablist" aria-label="Appearance categories">${[
    ["heritage", "Heritage"],
    ["features", "Features"],
    ["hair", "Hair"],
    ["style", "Style"],
    ["build", "Build"],
  ]
    .map(
      ([id, title]) =>
        `<button type="button" role="tab" id="creator-tab-${id}" aria-controls="creator-${id}" data-tab="${id}" aria-selected="${id === "heritage"}" tabindex="${id === "heritage" ? 0 : -1}">${title}</button>`,
    )
    .join(
      "",
    )}</div><div role="tabpanel" id="creator-heritage" aria-labelledby="creator-tab-heritage" data-section="heritage"><div class="creator-section-title"><span>01</span><h3>Your heritage</h3></div><div class="creator-races">${RACE_IDS.map((r) => `<button type="button" data-race="${r}" aria-pressed="${appearance.race === r}">${icon({ human: "compass", elf: "leaf", dwarf: "stone", orc: "axe" }[r])}<strong>${RACES[r].name}</strong><span>${r === "human" ? "The wayfarer" : r === "elf" ? "The forest keeper" : r === "dwarf" ? "The trailblazer" : "The wild heart"}</span></button>`).join("")}</div><p id="race-description"></p><div class="creator-section-title"><span>02</span><h3>Your calling</h3></div><div class="creator-classes">${CLASS_IDS.map((id) => `<button type="button" class="class-option" data-action="class-select:${id}" ${options.editing ? "disabled" : ""} aria-pressed="${classId === id}"><img src="/assets/portraits/${CLASSES[id].model}.png" alt=""/><span><strong>${CLASSES[id].name}</strong><small>${{ knight: "Guardian", barbarian: "Brawler", mage: "Spellcaster", rogue: "Skirmisher" }[id]}</small></span></button>`).join("")}</div><p id="class-description"></p></div><div role="tabpanel" id="creator-features" aria-labelledby="creator-tab-features" data-section="features" hidden>${select("body", "Body", BODY_IDS)}${select("face", "Face shape", FACE_IDS)}<div id="skin-palette"></div>${swatches("eyeColor", "Eye color", EYE_COLORS)}</div><div role="tabpanel" id="creator-hair" aria-labelledby="creator-tab-hair" data-section="hair" hidden>${select("hairStyle", "Hairstyle", HAIR_IDS)}${swatches("hairColor", "Hair color", HAIR_COLORS)}${select("facialHair", "Facial hair", BEARD_IDS)}${select("brow", "Eyebrows", BROW_IDS)}</div><div role="tabpanel" id="creator-style" aria-labelledby="creator-tab-style" data-section="style" hidden><label class="creator-field"><span>Outfit</span><select data-look="outfit" aria-label="Outfit"><option value="ranger" ${appearance.outfit === "ranger" ? "selected" : ""}>Pathfinder leathers</option><option value="traveler" ${appearance.outfit === "traveler" ? "selected" : ""}>Wayfarer tunic</option></select></label>${swatches("outfitColor", "Clothing dye", OUTFIT_COLORS)}<label class="creator-check"><input type="checkbox" data-look="shoulders" ${appearance.shoulders ? "checked" : ""}/> Show shoulder armor</label><p class="creator-note">Your look is cosmetic. Your class determines your weapons and abilities.</p>${options.editing ? `<label class="creator-field"><span>Explorer name</span><input id="creator-nickname" aria-label="Explorer name" value="${esc(options.nickname)}" maxlength="18" minlength="2" autocomplete="off"/></label>` : ""}</div><div role="tabpanel" id="creator-build" aria-labelledby="creator-tab-build" data-section="build" hidden>${slider("jaw", "Jaw width", -1, 1, 0.1)}${slider("nose", "Nose profile", -1, 1, 0.1)}${slider("ears", "Ear shape", 0, 1, 0.1)}${slider("height", "Height", 0.9, 1.1, 0.02)}</div><div class="creator-random"><button type="button" data-random>Randomize look</button><button type="button" data-reset>Reset</button></div></aside></div><footer class="creator-footer"><p><strong>Every great adventure starts with you.</strong><br/><small>Change your look anytime at the studio in Hearthwick.</small></p><button class="primary" data-action="${options.editing ? "appearance-save" : "class-confirm"}">${options.editing ? "Save appearance" : options.hasCompanion ? "Enter the world" : "Choose your Pokémon"}${icon("arrow")}</button></footer></div>`;
}
