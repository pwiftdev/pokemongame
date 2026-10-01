import { armedIdle } from "../render/equipment";
import { createAvatarStage } from "./avatar-stage";
import {
  BEARD_IDS,
  FACE_IDS,
  HAIR_COLORS,
  HAIR_IDS,
  EYE_COLORS,
  OUTFIT_COLORS,
  RACES,
  normalizeAppearance,
  type Appearance,
} from "../../../../packages/shared/appearance";
import { CLASSES, type ClassId } from "../../../../packages/shared/classes";
import { loadAvatarLibrary } from "../render/avatar";
import { createAnimationMixer } from "../render/animation-mixer";
import { creatorMarkup, paletteMarkup } from "./creator-markup";
import "../character-creator.css";
export interface CreatorOptions {
  appearance: Appearance;
  classId: ClassId;
  nickname: string;
  editing?: boolean;
  hasCompanion?: boolean;
  onChange: (appearance: Appearance) => void;
}
export function mountCharacterCreator(
  host: HTMLElement,
  options: CreatorOptions,
) {
  let appearance = normalizeAppearance(options.appearance),
    classId = options.classId,
    disposed = false,
    generation = 0;
  let library: Awaited<ReturnType<typeof loadAvatarLibrary>> | undefined;
  let actor:
    | ReturnType<Awaited<ReturnType<typeof loadAvatarLibrary>>["create"]>
    | undefined;
  let mixer: ReturnType<typeof createAnimationMixer> | undefined;
  let frame = "body";
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let skinRace = "";
  host.innerHTML = creatorMarkup({ ...options, appearance, classId });
  const canvas = host.querySelector<HTMLCanvasElement>("canvas")!;
  const stage = createAvatarStage(canvas);
  const { scene, camera } = stage;
  function focus() {
    const height = actor?.height ?? 1.9;
    camera.target.set(0, frame === "face" ? height - 0.21 : height * 0.51, 0);
    camera.radius = frame === "face" ? 1.15 : height * 1.8;
  }
  function preview() {
    if (!library || disposed) return;
    clearTimeout(previewTimer);
    const previousHeight = actor?.height;
    mixer?.dispose();
    actor?.dispose();
    actor = library.create("preview", classId, appearance);
    mixer = createAnimationMixer(scene, actor.animations);
    mixer.play(armedIdle(classId));
    if (previousHeight !== actor.height) focus();
    host.querySelector(".creator-preview-status")!.textContent = "";
    host.querySelector(".creator-preview")!.setAttribute("data-ready", "true");
  }
  function refresh() {
    host.querySelector("#race-description")!.textContent =
      RACES[appearance.race].description;
    host.querySelector("#class-description")!.textContent =
      CLASSES[classId].description;
    host.querySelector("#creator-subtitle")!.textContent =
      `${RACES[appearance.race].name} · ${CLASSES[classId].name}`;
    if (skinRace !== appearance.race) {
      host.querySelector("#skin-palette")!.innerHTML = paletteMarkup(
        appearance,
        "skin",
        "Skin tone",
        RACES[appearance.race].skin,
      );
      skinRace = appearance.race;
    }
    host
      .querySelectorAll<HTMLElement>("[data-race]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.race === appearance.race),
        ),
      );
    host
      .querySelectorAll<HTMLElement>("[data-action^='class-select:']")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.action === `class-select:${classId}`),
        ),
      );
    host
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-look]")
      .forEach((input) => {
        const value = appearance[input.dataset.look as keyof Appearance];
        if (input instanceof HTMLInputElement && input.type === "checkbox")
          input.checked = Boolean(value);
        else input.value = String(value);
        const output = host.querySelector(
          `[data-value="${input.dataset.look}"]`,
        );
        if (output) output.textContent = `${Math.round(Number(value) * 100)}%`;
      });
    host.querySelectorAll<HTMLElement>("[data-swatch]").forEach((b) => {
      const [key, n] = b.dataset.swatch!.split(":");
      b.setAttribute(
        "aria-pressed",
        String(appearance[key as keyof Appearance] === Number(n)),
      );
    });
    options.onChange({ ...appearance });
    clearTimeout(previewTimer);
    previewTimer = setTimeout(preview, 80);
  }
  host.addEventListener("input", input);
  host.addEventListener("click", click);
  host.addEventListener("keydown", keydown);
  function keydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (!target.matches("[data-tab]")) return;
    const tabs = [...host.querySelectorAll<HTMLButtonElement>("[data-tab]")];
    const index = tabs.indexOf(target as HTMLButtonElement);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index + tabs.length - 1) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    tabs[next].click();
    tabs[next].focus();
  }
  function input(event: Event) {
    const field = event.target as HTMLInputElement;
    if (field.id === "creator-nickname")
      host.querySelector(".creator-name strong")!.textContent =
        field.value || options.nickname;
    if (!field.dataset.look) return;
    const value =
      field.type === "checkbox"
        ? field.checked
        : field.type === "range"
          ? Number(field.value)
          : field.value;
    appearance = normalizeAppearance({
      ...appearance,
      [field.dataset.look]: value,
    });
    refresh();
  }
  function click(event: Event) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button",
    );
    if (!button) return;
    const { race, swatch, tab, view, turn } = button.dataset;
    if (tab) {
      host
        .querySelectorAll<HTMLElement>("[data-section]")
        .forEach((s) => (s.hidden = s.dataset.section !== tab));
      host.querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => {
        b.setAttribute("aria-selected", String(b.dataset.tab === tab));
        b.tabIndex = b.dataset.tab === tab ? 0 : -1;
      });
      return;
    }
    if (view) {
      frame = view;
      focus();
      host
        .querySelectorAll<HTMLElement>("[data-view]")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.view === view)),
        );
      return;
    }
    if (turn) {
      camera.alpha += (Number(turn) * Math.PI) / 4;
      return;
    }
    if (race)
      appearance = normalizeAppearance({
        ...appearance,
        race: race as Appearance["race"],
      });
    else if (swatch) {
      const [key, n] = swatch.split(":");
      appearance = normalizeAppearance({ ...appearance, [key]: Number(n) });
    } else if (button.hasAttribute("data-reset"))
      appearance = normalizeAppearance(options.appearance);
    else if (button.hasAttribute("data-random")) {
      const pick = <T>(a: readonly T[]) =>
        a[Math.floor(Math.random() * a.length)];
      appearance = {
        ...appearance,
        skin: Math.floor(Math.random() * 8),
        hairStyle: pick(HAIR_IDS),
        hairColor: Math.floor(Math.random() * HAIR_COLORS.length),
        eyeColor: Math.floor(Math.random() * EYE_COLORS.length),
        face: pick(FACE_IDS),
        facialHair: pick(BEARD_IDS),
        outfitColor: Math.floor(Math.random() * OUTFIT_COLORS.length),
        jaw: Math.round((Math.random() * 2 - 1) * 10) / 10,
        nose: Math.round((Math.random() * 2 - 1) * 10) / 10,
      };
    } else return;
    refresh();
  }
  refresh();
  const version = ++generation;
  void loadAvatarLibrary(scene)
    .then((value) => {
      if (disposed || version !== generation) {
        value.dispose();
        return;
      }
      library = value;
      preview();
    })
    .catch((error) => {
      console.warn("Character preview unavailable", error);
      if (!disposed)
        host.querySelector(".creator-preview-status")!.textContent =
          "The preview could not load. Your choices are still available; reopen the studio to retry.";
    });
  return {
    get metrics() {
      return {
        meshes: scene.meshes.length,
        materials: scene.materials.length,
        textures: scene.textures.length,
        skeletons: scene.skeletons.length,
        animations: scene.animationGroups.length,
        animatables: scene.animatables.length,
      };
    },
    setClass(value: ClassId) {
      classId = value;
      refresh();
    },
    get appearance() {
      return { ...appearance };
    },
    get nickname() {
      return (
        host.querySelector<HTMLInputElement>("#creator-nickname")?.value ??
        options.nickname
      );
    },
    dispose() {
      clearTimeout(previewTimer);
      disposed = true;
      generation++;
      host.removeEventListener("input", input);
      host.removeEventListener("click", click);
      host.removeEventListener("keydown", keydown);
      mixer?.dispose();
      actor?.dispose();
      library?.dispose();
      stage.dispose();
    },
  };
}
