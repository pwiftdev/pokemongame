import { Matrix, Vector3, type Camera, type Scene } from "@babylonjs/core";
import type { Difficulty } from "../../../../packages/shared/combat-rules";
import { escape as esc } from "../ui/icons";

export interface PlateData {
  name: string;
  level: number;
  difficulty: Difficulty;
  hp: number;
  maxHp: number;
  /** hostile monsters, neutral wild Pokémon */
  reaction: "hostile" | "neutral";
  rank: "normal" | "elite" | "boss";
  targeted: boolean;
  /** This creature is attacking you. */
  aggro: boolean;
  evading: boolean;
  cast?: { name: string; progress: number; interruptible: boolean };
}
export type FloatKind =
  | "damage"
  | "auto"
  | "pet"
  | "incoming"
  | "heal"
  | "dot"
  | "avoid"
  | "interrupt"
  | "alert"
  | "shatter"
  | "xp"
  | "coin";
interface Plate {
  root: HTMLElement;
  name: HTMLElement;
  fill: HTMLElement;
  cast: HTMLElement;
  castFill: HTMLElement;
  castName: HTMLElement;
  anchor: Vector3;
  key: string;
  visible: boolean;
}
interface Floater {
  element: HTMLElement;
  anchor: Vector3;
  age: number;
  life: number;
  drift: number;
}

/** Screen-space nameplates and floating combat text anchored to world positions. */
export function createCombatOverlay(
  canvas: HTMLCanvasElement,
  scene: Scene,
  select: (id: string, attack: boolean) => void,
) {
  const layer = document.createElement("div");
  layer.className = "world-overlay";
  canvas.after(layer);
  const pick = (event: MouseEvent) => {
    const id = (event.target as Element).closest<HTMLElement>(".plate")?.dataset
      .id;
    if (!id) return;
    event.preventDefault();
    select(id, event.button === 2);
  };
  layer.addEventListener("click", pick);
  layer.addEventListener("contextmenu", pick);
  const plates = new Map<string, Plate>();
  const floaters: Floater[] = [];
  const projected = new Vector3();
  let camera: Camera | undefined;
  let lastFloatSide = 1;
  function project(position: Vector3) {
    if (!camera) return undefined;
    const engine = scene.getEngine();
    const width = engine.getRenderWidth(),
      height = engine.getRenderHeight();
    Vector3.ProjectToRef(
      position,
      Matrix.IdentityReadOnly,
      scene.getTransformMatrix(),
      camera.viewport.toGlobal(width, height),
      projected,
    );
    if (projected.z <= 0 || projected.z >= 1) return undefined;
    const scale = canvas.clientWidth / width;
    return {
      x: projected.x * scale,
      y: projected.y * scale,
      depth: Vector3.Distance(camera.globalPosition, position),
    };
  }
  function createPlate(id: string): Plate {
    const root = document.createElement("div");
    root.className = "plate";
    root.dataset.id = id;
    root.innerHTML =
      '<div class="plate-name"></div><div class="plate-hp"><span></span></div><div class="plate-cast"><span></span><em></em></div><b class="plate-aggro">!</b>';
    layer.append(root);
    return {
      root,
      name: root.querySelector(".plate-name")!,
      fill: root.querySelector(".plate-hp > span")!,
      cast: root.querySelector(".plate-cast")!,
      castFill: root.querySelector(".plate-cast > span")!,
      castName: root.querySelector(".plate-cast > em")!,
      anchor: new Vector3(),
      key: "",
      visible: false,
    };
  }
  return {
    setCamera(value: Camera) {
      camera = value;
    },
    /** Create, update or hide (data undefined) the nameplate for an entity. */
    plate(
      id: string,
      anchor: Vector3 | undefined,
      data: PlateData | undefined,
    ) {
      let plate = plates.get(id);
      if (!data || !anchor) {
        if (plate?.visible) {
          plate.visible = false;
          plate.root.classList.add("hidden");
        }
        return;
      }
      plate ??= createPlate(id);
      plates.set(id, plate);
      plate.anchor.copyFrom(anchor);
      plate.visible = true;
      const key = `${data.reaction} ${data.rank} ${data.targeted ? "targeted" : ""} ${data.aggro ? "aggro" : ""} ${data.evading ? "evading" : ""} ${data.cast ? "casting" : ""} ${data.cast?.interruptible ? "interruptible" : ""}`;
      if (key !== plate.key) {
        plate.key = key;
        plate.root.className = `plate ${key}`;
      }
      const name = `<b class="plate-level ${data.difficulty}">${data.rank === "boss" ? "??" : data.level}${data.rank === "elite" ? "+" : ""}</b>${esc(data.name)}`;
      if (plate.name.dataset.markup !== name) {
        plate.name.dataset.markup = name;
        plate.name.innerHTML = name;
      }
      plate.fill.style.width = `${Math.max(0, Math.min(1, data.hp / Math.max(1, data.maxHp))) * 100}%`;
      if (data.cast) {
        plate.castFill.style.width = `${data.cast.progress * 100}%`;
        if (plate.castName.textContent !== data.cast.name)
          plate.castName.textContent = data.cast.name;
      }
    },
    remove(id: string) {
      plates.get(id)?.root.remove();
      plates.delete(id);
    },
    /** Floating combat text rising from a world position. */
    float(
      position: Vector3,
      text: string,
      kind: FloatKind,
      options: { crit?: boolean; small?: boolean } = {},
    ) {
      if (floaters.length > 48) {
        floaters.shift()!.element.remove();
      }
      const element = document.createElement("div");
      element.className = `float ${kind}${options.crit ? " crit" : ""}${options.small ? " small" : ""}`;
      element.innerHTML = `<span>${esc(text)}</span>`;
      layer.append(element);
      lastFloatSide *= -1;
      floaters.push({
        element,
        anchor: position.clone(),
        age: 0,
        life: options.crit ? 1.35 : kind === "alert" ? 0.9 : 1.1,
        drift:
          kind === "incoming" || kind === "heal"
            ? lastFloatSide * (26 + Math.random() * 16)
            : (Math.random() - 0.5) * 36,
      });
    },
    update(dt: number) {
      for (const plate of plates.values()) {
        if (!plate.visible) continue;
        const point = project(plate.anchor);
        const hidden = !point || point.depth > 42;
        plate.root.classList.toggle("hidden", hidden);
        if (!point || hidden) continue;
        const scale = Math.max(
          0.72,
          Math.min(1.05, 16 / Math.max(1, point.depth)),
        );
        plate.root.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
        plate.root.style.zIndex = String(1000 - Math.round(point.depth * 10));
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const floater = floaters[i];
        floater.age += dt;
        const point = project(floater.anchor);
        if (floater.age >= floater.life || !point) {
          if (floater.age >= floater.life) {
            floater.element.remove();
            floaters.splice(i, 1);
          } else floater.element.style.opacity = "0";
          continue;
        }
        const t = floater.age / floater.life;
        const rise = 46 * (1 - (1 - t) ** 2);
        floater.element.style.opacity = t > 0.7 ? String((1 - t) / 0.3) : "1";
        floater.element.style.transform = `translate3d(${(point.x + floater.drift * t).toFixed(1)}px, ${(point.y - rise).toFixed(1)}px, 0) translate(-50%, -100%)`;
      }
    },
    get floatCount() {
      return floaters.length;
    },
    dispose() {
      layer.remove();
      plates.clear();
      floaters.length = 0;
    },
  };
}
export type CombatOverlay = ReturnType<typeof createCombatOverlay>;
