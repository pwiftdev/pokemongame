import { Mesh, MeshBuilder, Vector3, type Scene } from "@babylonjs/core";
import type { GameEvent } from "../../../../packages/shared/types";
import type { createEffectPool } from "./effect-pool";
import type { createEffectMaterials } from "./effect-materials";
import type { createCombatPrimitives } from "./combat-primitives";

const PALETTES: Record<string, string> = {
  slash: "#fbe6a5",
  "shield-strike": "#9de2ff",
  bulwark: "#9de2ff",
  rally: "#ffdc75",
  challenge: "#ffb347",
  sweep: "#ffe5a3",
  "shield-charge": "#9de2ff",
  "heroic-throw": "#ffe5a3",
  firebolt: "#ff843e",
  frostbolt: "#8eeaff",
  icelance: "#b9f2ff",
  barrier: "#bc9bff",
  blink: "#bc9bff",
  counterspell: "#dfbaff",
  "arcane-barrage": "#e1a3ff",
  meteor: "#ff7433",
  stab: "#d6f0ff",
  venom: "#a9ef65",
  ambush: "#b89aff",
  eviscerate: "#ff9fae",
  vanish: "#a897d7",
  shadowstep: "#b89aff",
  evasion: "#97d9dc",
  kick: "#e8d9b2",
  "fan-of-knives": "#a9ef65",
  cleave: "#ffd69a",
  crush: "#ffb461",
  execute: "#ff816b",
  ironhide: "#a6b9cb",
  "blood-rush": "#ff8579",
  whirlwind: "#ffcf8a",
  charge: "#ffb461",
  shockwave: "#e8b785",
};
export const classSkillColor = (id: string | undefined, fallback: string) =>
  PALETTES[id ?? ""] ?? fallback;

export function createClassEffects(
  scene: Scene,
  pool: ReturnType<typeof createEffectPool>,
  materials: ReturnType<typeof createEffectMaterials>,
  primitives: ReturnType<typeof createCombatPrimitives>,
) {
  const { ring, burst, glow } = primitives;
  function motes(
    position: Vector3,
    color: string,
    smoke = false,
    follow?: () => Vector3 | undefined,
  ) {
    for (let i = 0; i < 10; i++) {
      const mesh = pool.acquire(`class-mote-${smoke}`, () =>
        MeshBuilder.CreatePlane(
          smoke ? "vanish smoke" : "restoring light",
          { size: smoke ? 1.3 : 0.4 },
          scene,
        ),
      );
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      mesh.material = materials.get(color, "glow");
      pool.track(mesh, smoke ? 0.8 : 1.1, (t) => {
        const center = follow?.() ?? position,
          angle = i * 2.4 + t * 2;
        mesh.position.set(
          center.x + Math.sin(angle) * (0.45 + t),
          center.y + 0.3 + t * 2 + (i % 3) * 0.25,
          center.z + Math.cos(angle) * (0.45 + t),
        );
        mesh.scaling.setAll(smoke ? 0.6 + t * 1.6 : 1 - t * 0.5);
        mesh.visibility = (1 - t) * 0.7;
      });
    }
  }
  function blades(
    position: Vector3,
    color: string,
    radius: number,
    count = 8,
    delay = 0,
  ) {
    for (let i = 0; i < count; i++) {
      const blade = pool.acquire("class-blade", () =>
        MeshBuilder.CreateCylinder(
          "flying blade",
          {
            diameterTop: 0,
            diameterBottom: 0.18,
            height: 0.8,
            tessellation: 4,
          },
          scene,
        ),
      );
      blade.material = materials.get(color);
      const angle = (i / count) * Math.PI * 2;
      blade.rotation.set(Math.PI / 2, angle, 0);
      pool.track(
        blade,
        0.4,
        (t) => {
          blade.position.set(
            position.x + Math.sin(angle) * t * radius,
            position.y + 0.8,
            position.z + Math.cos(angle) * t * radius,
          );
          blade.visibility = 1 - t;
        },
        undefined,
        delay,
      );
    }
  }
  return {
    personal(
      id: string,
      effect: string | undefined,
      position: Vector3,
      follow?: () => Vector3 | undefined,
    ) {
      const color = classSkillColor(id, "#e5dcff");
      if (effect === "stealth" || effect === "heal") {
        motes(position, color, effect === "stealth", follow);
        ring(position, color, 3, 0.7);
        return true;
      }
      if (effect === "evasion") {
        for (let i = 0; i < 3; i++) {
          const arc = pool.acquire("evasion-orbit", () =>
            MeshBuilder.CreateTorus(
              "evasion wake",
              { diameter: 1.8, thickness: 0.035, tessellation: 24 },
              scene,
            ),
          );
          arc.material = materials.get(color);
          pool.track(arc, 5, (t) => {
            arc.position
              .copyFrom(follow?.() ?? position)
              .addInPlace(new Vector3(0, 0.5 + i * 0.4, 0));
            arc.rotation.set(t * 3 + i, t * 5, i * 0.7);
            arc.visibility = Math.min(0.45, (1 - t) * 2);
          });
        }
        return true;
      }
      return false;
    },
    area(id: string, position: Vector3, radius: number, delay: number) {
      if (id !== "fan-of-knives" && id !== "shockwave") return false;
      const color = classSkillColor(id, "#ffffff");
      blades(position, color, radius, id === "shockwave" ? 12 : 8, delay);
      ring(position, color, radius * 1.4, 0.5);
      return true;
    },
    mobility(event: GameEvent, from: Vector3, to: Vector3) {
      const color = classSkillColor(event.ability, "#fbe6a5"),
        charge = (event.movement?.duration ?? 0) > 0;
      ring(from, color, 2.2, 0.35);
      ring(to, color, charge ? 3.3 : 2.2, 0.5);
      burst(to.add(new Vector3(0, 0.6, 0)), color, charge ? 8 : 12);
      const count = Math.min(
        14,
        Math.max(3, Math.ceil(Vector3.Distance(from, to) * 1.4)),
      );
      for (let i = 0; i < count; i++) {
        const wake = pool.acquire("mobility-wake", () =>
          MeshBuilder.CreatePlane("mobility wake", { size: 1.2 }, scene),
        );
        wake.billboardMode = Mesh.BILLBOARDMODE_ALL;
        wake.material = materials.get(color, "glow");
        wake.position
          .copyFrom(Vector3.Lerp(from, to, i / (count - 1)))
          .addInPlace(new Vector3(0, charge ? 0.2 : 0.9, 0));
        pool.track(
          wake,
          0.45,
          (t) => {
            wake.scaling.setAll(1 - t * 0.7);
            wake.visibility = (1 - t) * 0.55;
          },
          undefined,
          charge ? ((i / count) * event.movement!.duration) / 1000 : 0,
        );
      }
      if (!charge) glow(to.add(new Vector3(0, 1, 0)), color, 3, 0.35);
    },
  };
}
