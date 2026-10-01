import { createPokemonEffects } from "./pokemon-effects";
import { createPokemonMoments } from "./pokemon-moments";
import { createFlameMaterial } from "./fire";
import { projectileDuration } from "./combat-motion";
import { createEffectPool } from "./effect-pool";
import { createCombatPrimitives } from "./combat-primitives";
import { createEffectMaterials } from "./effect-materials";
import { createSpellShape } from "./spell-shapes";
import {
  Mesh,
  Color3,
  FresnelParameters,
  StandardMaterial,
  MeshBuilder,
  Vector3,
  type Scene,
} from "@babylonjs/core";
import { ABILITIES } from "../../../../packages/shared/data";
import { RANGED_ELEMENTS } from "../../../../packages/shared/combat-rules";
import type { Element, GameEvent } from "../../../../packages/shared/types";

export function createCombatEffects(
  scene: Scene,
  onImpact: (event: GameEvent) => void = () => {},
) {
  const pool = createEffectPool();
  const { track } = pool;
  const flameMaterial = createFlameMaterial(scene);
  const meteorMaterial = new StandardMaterial("heated meteor rock", scene);
  meteorMaterial.diffuseColor = Color3.FromHexString("#633b27");
  meteorMaterial.emissiveColor = new Color3(0.2, 0.045, 0.005);
  meteorMaterial.specularColor = new Color3(0.25, 0.1, 0.025);
  let effectTime = 0;
  const charges = new Map<string, { ring: Mesh; orb: Mesh }>();
  const colors: Record<Element, string> = {
    leaf: "#a6ec65",
    flame: "#ff9b49",
    tide: "#70e9ff",
    stone: "#efcf86",
    spark: "#fff16b",
    spirit: "#d6a3ff",
  };
  const materials = createEffectMaterials(scene);
  const material = materials.get;
  const primitives = createCombatPrimitives(scene, materials, track, onImpact);
  const { ring, glow, burst, text, impact, status } = primitives;
  const pokemon = createPokemonEffects(scene, pool, materials, primitives);
  const moments = createPokemonMoments(scene, pool, materials, primitives);
  function weaponStrike(
    event: GameEvent,
    from: Vector3,
    to: Vector3,
    color: string,
    delay: number,
    follow?: () => Vector3 | undefined,
    light = false,
  ) {
    const heavy = ["cleave", "crush", "execute"].includes(event.ability ?? "");
    const radius = Math.min(
      heavy ? 3 : 2.3,
      Math.max(1.2, Vector3.Distance(from, to)),
    );
    const paths = [0.7, 1].map((r) =>
      Array.from({ length: 28 }, (_, i) => {
        const a = -1.45 + (i / 27) * 2.9;
        const taper = Math.sin((i / 27) * Math.PI);
        return new Vector3(
          Math.sin(a) * radius * (r === 1 ? r : 1 - taper * 0.26),
          0.9 + Math.sin(a) * (heavy ? 0.15 : 0.5),
          Math.cos(a) * radius * (r === 1 ? r : 1 - taper * 0.26),
        );
      }),
    );
    const arc = MeshBuilder.CreateRibbon(
      "weapon slash",
      { pathArray: paths, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    arc.position.copyFrom(from);
    arc.material = material(heavy ? "#ffd69a" : "#e7f6ff");
    if (light) arc.scaling.setAll(0.8);
    const yaw = Math.atan2(to.x - from.x, to.z - from.z);
    let landed = false;
    track(
      arc,
      heavy ? 0.28 : 0.2,
      (t) => {
        arc.rotation.y = yaw + (t - 0.5) * 1.8;
        arc.visibility = Math.sin(t * Math.PI) * (light ? 0.45 : 0.75);
        if (t >= 0.2 && !landed) {
          landed = true;
          const point = follow?.() ?? to;
          impact(point, event, color);
          if (heavy) ring(point, "#ffd69a", 3.5, 0.5);
          const effect = ABILITIES[event.ability ?? ""]?.effect;
          if (effect) status(point, effect, color);
        }
      },
      undefined,
      Math.max(0, delay - 0.04),
    );
  }
  /** Run a callback after a delay using the shared effect lifetime. */
  function later(delay: number, callback: () => void) {
    const marker = MeshBuilder.CreateSphere(
      "effect timer",
      { diameter: 0.05, segments: 2 },
      scene,
    );
    marker.visibility = 0;
    let done = false;
    track(
      marker,
      0.01,
      () => {
        if (done) return;
        done = true;
        callback();
      },
      undefined,
      delay,
    );
  }
  function spin(
    event: GameEvent,
    from: Vector3,
    radius: number,
    delay: number,
  ) {
    const color = event.ability === "whirlwind" ? "#ffcf8a" : "#f4e7b8";
    later(Math.max(0, delay - 0.05), () => {
      ring(from, color, radius * 2.2, 0.45);
      const path = (r: number) =>
        Array.from({ length: 41 }, (_, i) => {
          const a = (i / 40) * Math.PI * 2;
          return new Vector3(Math.sin(a) * r, 0.9, Math.cos(a) * r);
        });
      const blade = MeshBuilder.CreateRibbon(
        "weapon slash",
        {
          pathArray: [path(radius * 0.55), path(radius * 0.85)],
          sideOrientation: Mesh.DOUBLESIDE,
        },
        scene,
      );
      blade.position.copyFrom(from);
      blade.material = material(color);
      track(blade, 0.32, (t) => {
        blade.rotation.y = -t * Math.PI * 2;
        blade.visibility = Math.sin(t * Math.PI) * 0.7;
      });
    });
  }
  function shout(from: Vector3, to: Vector3) {
    for (let i = 0; i < 3; i++)
      later(i * 0.09, () => ring(from, "#f2c36b", 3 + i * 1.6, 0.4));
    later(0.18, () => {
      glow(to.add(new Vector3(0, 2.4, 0)), "#ffb347", 1.4, 0.6);
      burst(to.add(new Vector3(0, 1.6, 0)), "#ffb347", 8);
    });
  }
  function interrupt(position: Vector3) {
    ring(position, "#c7a4ff", 3.2, 0.45);
    glow(position.add(new Vector3(0, 1.4, 0)), "#e2cdff", 2.6, 0.3);
    burst(position.add(new Vector3(0, 1.2, 0)), "#c7a4ff", 14);
  }
  function frostNova(
    event: GameEvent,
    to: Vector3,
    delay: number,
    follow?: () => Vector3 | undefined,
  ) {
    const center = to.clone();
    const seed = MeshBuilder.CreateSphere(
      "frost seed",
      { diameter: 0.12, segments: 6 },
      scene,
    );
    seed.visibility = 0;
    let landed = false;
    track(
      seed,
      0.1,
      () => {
        if (landed) return;
        landed = true;
        center.copyFrom(follow?.() ?? to);
        impact(center, event, "#8eeaff");
        ring(center, "#8eeaff", 5, 0.65);
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const shard = MeshBuilder.CreateCylinder(
            "frost crystal",
            {
              diameterTop: 0,
              diameterBottom: 0.32,
              height: 1.3,
              tessellation: 4,
            },
            scene,
          );
          shard.material = material(i % 2 ? "#beeaff" : "#64a8dc");
          shard.position
            .copyFrom(center)
            .addInPlace(
              new Vector3(Math.sin(angle) * 1.3, 0.25, Math.cos(angle) * 1.3),
            );
          shard.rotation.z = Math.cos(angle) * 0.4;
          track(shard, 0.75, (t) => {
            shard.scaling.y = Math.min(1, t * 8);
            shard.visibility = Math.min(1, (1 - t) * 3);
          });
        }
      },
      undefined,
      delay,
    );
  }
  function cast(
    event: GameEvent,
    from: Vector3,
    to: Vector3,
    element: Element,
    follow?: () => Vector3 | undefined,
    windup = 0,
    size = 1,
  ) {
    if (pokemon.cast(event, from, to, size)) {
      if (event.type === "impact") onImpact(event);
      return;
    }
    const ability = ABILITIES[event.ability ?? ""];
    const color = colors[ability?.element ?? element];
    const rangedAuto =
      event.type === "hit" && event.auto && RANGED_ELEMENTS.includes(element);
    if ((event.type === "hit" || event.type === "impact") && !rangedAuto) {
      const point = () => follow?.() ?? to;
      if (windup > 0) later(windup, () => impact(point(), event, color));
      else impact(to, event, color);
      return;
    }
    if (["guard", "heal", "evasion"].includes(ability?.effect ?? "")) {
      ring(to, color, 3, 0.9);
      const bubble = MeshBuilder.CreateSphere(
        "protective aura",
        { diameter: 2.5, segments: 20 },
        scene,
      );

      const shell = new StandardMaterial("barrier rim", scene);
      shell.diffuseColor = Color3.FromHexString(color);
      shell.emissiveColor = shell.diffuseColor.scale(0.45);
      shell.specularColor = Color3.Black();
      shell.disableLighting = true;
      shell.alpha = 0.16;
      shell.backFaceCulling = false;
      shell.opacityFresnelParameters = new FresnelParameters({
        leftColor: Color3.White(),
        rightColor: Color3.Black(),
        power: 2,
      });
      bubble.material = shell;
      track(
        bubble,
        ability.effect === "guard" ? 4 : ability.effect === "evasion" ? 5 : 1,
        (t) => {
          bubble.position
            .copyFrom(follow?.() ?? to)
            .addInPlace(new Vector3(0, 0.9, 0));
          bubble.visibility = 1 - t;
          bubble.scaling.setAll(1 + Math.sin(t * 12) * 0.04);
        },
        () => shell.dispose(),
      );
      burst(to.add(new Vector3(0, 0.5, 0)), color, 8);
      return;
    }
    if (ability?.aoeSelf) {
      spin(event, from, ability.aoe ?? 4, windup);
      return;
    }
    if (ability?.effect === "taunt") {
      shout(from, to);
      return;
    }
    if (ability?.interrupt && ability.range > 6) {
      later(windup, () => interrupt(follow?.() ?? to));
      return;
    }
    if (
      event.actor === "hero" &&
      ability &&
      ability.power > 0 &&
      ability.range <= 5
    ) {
      weaponStrike(event, from, to, color, windup, follow);
      return;
    }
    if (event.ability === "frostbolt") {
      ring(from, color, 1.5, 0.35);
      frostNova(event, to, windup + 0.15, follow);
      return;
    }
    const meteor = event.ability === "meteor";
    const origin = (meteor ? to.add(new Vector3(-3, 9, -2)) : from).add(
        new Vector3(0, 0.9, 0),
      ),
      destination = to.add(new Vector3(0, 0.8, 0));
    const duration = projectileDuration(
      event.ability,
      Vector3.Distance(from, to),
    );
    const elementType = ability?.element ?? element;
    const bolt = meteor
      ? MeshBuilder.CreateIcoSphere(
          "meteor core",
          { radius: 0.38, subdivisions: 2 },
          scene,
        )
      : createSpellShape(scene, elementType);
    bolt.material = meteor ? meteorMaterial : material(color);
    if (elementType === "flame") {
      if (!meteor) bolt.scaling.scaleInPlace(0.55);
      const flame = MeshBuilder.CreatePlane(
        "spell flame",
        { width: meteor ? 1.15 : 0.6, height: meteor ? 2.1 : 0.9 },
        scene,
      );
      flame.billboardMode = Mesh.BILLBOARDMODE_ALL;
      flame.material = flameMaterial;
      track(
        flame,
        duration,
        (t) => {
          flame.position.copyFrom(Vector3.Lerp(origin, destination, t));
          flame.position.y += meteor ? 0.65 : 0.2;
          flame.visibility = Math.min(1, t * 12);
        },
        undefined,
        windup,
      );
    }

    glow(from.add(new Vector3(0, 1.2, 0)), color, 1.5, Math.max(0.2, windup));
    let impacted = false;
    track(
      bolt,
      duration,
      (t) => {
        const currentTarget = follow?.();
        if (currentTarget)
          destination
            .copyFrom(currentTarget)
            .addInPlace(new Vector3(0, 0.8, 0));
        bolt.position.copyFrom(Vector3.Lerp(origin, destination, t));
        bolt.position.y +=
          Math.sin(t * Math.PI) * (elementType === "stone" ? 1.2 : 0.35);
        bolt.rotation.y = t * 12;
        if (t >= 1 && !impacted) {
          impacted = true;
          const point = follow?.() ?? to;
          impact(point, event, color);
          if (meteor) {
            ring(point, color, 5, 0.7);
            burst(point, color, 20);
          }
          if (
            ability?.effect === "slow" ||
            ability?.effect === "stun" ||
            ability?.effect === "burn"
          )
            status(point, ability.effect, color);
        }
      },
      undefined,
      windup,
    );
    for (let i = 0; i < 8; i++) {
      const trail = MeshBuilder.CreatePlane(
        "element trail",
        { size: elementType === "flame" ? (meteor ? 0.6 : 0.35) : 0.7 },
        scene,
      );
      trail.billboardMode = Mesh.BILLBOARDMODE_ALL;
      trail.material = material(
        i % 2 ? color : elementType === "flame" ? "#ff5d20" : "#fff7d3",
        "glow",
      );
      track(
        trail,
        duration + 0.07 * i,
        (t) => {
          const progress = Math.max(
            0,
            Math.min(1, (t * (duration + 0.07 * i) - 0.04 * i) / duration),
          );
          trail.position.copyFrom(Vector3.Lerp(origin, destination, progress));
          trail.position.y +=
            Math.sin(progress * Math.PI) *
            (elementType === "stone" ? 1.2 : 0.35);
          if (elementType === "leaf" || elementType === "spirit") {
            trail.position.x += Math.sin(progress * 20 + i) * 0.2;
            trail.position.y += Math.cos(progress * 20 + i) * 0.2;
          }
          if (elementType === "spark")
            trail.position.x += Math.sin(progress * 50 + i) * 0.3;
          trail.scaling.setAll((1 - i / 8) * (1 - t * 0.6));
          trail.visibility = progress < 1 ? 0.8 : 0;
        },
        undefined,
        windup,
      );
    }
    ring(from, color, 1, 0.3);
  }
  return {
    captureSequence: moments.capture,
    evolve: moments.evolve,
    cast,
    interrupt,
    /** An automatic weapon swing: a light slash and the impact once the blade connects. */
    swing(
      event: GameEvent,
      from: Vector3,
      to: Vector3,
      follow: () => Vector3 | undefined,
      delay: number,
    ) {
      weaponStrike(event, from, to, "#f4f1e4", delay, follow, true);
    },
    charge(
      id: string,
      position: Vector3,
      ability: string | undefined,
      progress: number,
    ) {
      let charge = charges.get(id);
      if (!ability) {
        if (charge) {
          charge.ring.dispose();
          charge.orb.dispose();
          charges.delete(id);
        }
        return;
      }
      if (!charge) {
        const rune = MeshBuilder.CreateTorus(
          "casting rune",
          { diameter: 1.8, thickness: 0.045, tessellation: 32 },
          scene,
        );
        const orb = MeshBuilder.CreateIcoSphere(
          "gathering spell",
          { radius: 0.24, subdivisions: 1 },
          scene,
        );
        rune.isPickable = orb.isPickable = false;
        charge = { ring: rune, orb };
        charges.set(id, charge);
      }
      const color = colors[ABILITIES[ability]?.element ?? "spirit"];
      charge.ring.material = charge.orb.material = material(color);
      charge.ring.position
        .copyFrom(position)
        .addInPlace(new Vector3(0, 0.15, 0));
      charge.ring.scaling.setAll(0.7 + progress * 0.5);
      charge.ring.rotation.y = effectTime * 3;
      charge.orb.position
        .copyFrom(position)
        .addInPlace(
          new Vector3(0.45, 1.5 + Math.sin(effectTime * 9) * 0.08, 0),
        );
      charge.orb.scaling.setAll(0.3 + progress * 1.2);
      charge.orb.rotation.y = effectTime * 6;
    },
    dash(position: Vector3, classId: string) {
      const color =
        classId === "mage"
          ? "#af99ff"
          : classId === "rogue"
            ? "#97d9dc"
            : "#ffd296";
      ring(position, color, 2.8, 0.28);
      burst(position.add(new Vector3(0, 0.6, 0)), color, 10);
    },
    levelUp(position: Vector3) {
      for (let i = 0; i < 3; i++)
        later(i * 0.16, () => ring(position, "#f8da89", 3 + i * 1.4, 0.8));
      glow(position.add(new Vector3(0, 1.2, 0)), "#fff0b8", 4, 0.9);
      burst(position.add(new Vector3(0, 1, 0)), "#f8da89", 26);
    },
    capture(position: Vector3, success: boolean) {
      ring(position, success ? "#f8da89" : "#e4a88b", 3, 1);
      burst(position.add(new Vector3(0, 1, 0)), "#f8da89", 20);
      text(
        position,
        success ? "BEFRIENDED" : "ESCAPED",
        success ? "#f8da89" : "#ffffff",
      );
    },
    update(dt: number, reduced: boolean) {
      effectTime += dt;
      flameMaterial.setFloat("time", effectTime);
      flameMaterial.setFloat("opacity", reduced ? 0.3 : 1);
      pool.update(dt, reduced);
    },
    get activeNames() {
      return pool.activeNames;
    },
    get count() {
      return pool.count;
    },
    dispose() {
      for (const charge of charges.values()) {
        charge.ring.dispose();
        charge.orb.dispose();
      }
      charges.clear();
      pool.dispose();
      materials.dispose();
      flameMaterial.dispose();
      meteorMaterial.dispose();
    },
  };
}
