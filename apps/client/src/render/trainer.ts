import type { GearState } from "../../../../packages/shared/gear";
import {
  AnimationGroupMask,
  AnimationGroupMaskMode,
  type Scene,
} from "@babylonjs/core";
import { type ClassId } from "../../../../packages/shared/classes";
import {
  DEFAULT_APPEARANCE,
  type Appearance,
} from "../../../../packages/shared/appearance";
import { loadAvatarLibrary } from "./avatar";
import { createAnimationMixer } from "./animation-mixer";
import { combatMotion } from "./combat-motion";
import { armedIdle } from "./equipment";

export async function loadTrainers(scene: Scene) {
  const avatars = await loadAvatarLibrary(scene);
  return {
    create(
      id: string,
      _self: boolean,
      classId: ClassId = "knight",
      appearance: Appearance = DEFAULT_APPEARANCE,
      armed = true,
      gear: GearState["equipped"] = {},
    ) {
      const actor = avatars.create(id, classId, appearance, armed, gear);
      const idle = armed ? armedIdle(classId) : "Idle";
      const lowerBody = (name: string) =>
        /:(hips|root|.*leg[.]|foot[.]|toes[.]|pelvis|thigh_|calf_|foot_|ball_|kneeIK|heelIK|IK-foot|IK-toe|control-foot|control-heel|control-toe)/.test(
          name,
        );
      const legNames = [
        ...new Set(
          actor.animations.flatMap((group) =>
            group.targetedAnimations
              .map((a) => a.target.name as string)
              .filter(lowerBody),
          ),
        ),
      ];
      const upperMask = new AnimationGroupMask(
        legNames,
        AnimationGroupMaskMode.Exclude,
      );
      upperMask.disabled = true;
      const legGroups = actor.animations
        .filter((group) =>
          /:(Idle|Walking_A|Running_A|Running_B)$/.test(group.name),
        )
        .map((group) => {
          const legs = group.clone(
            `legs:${group.name}`,
            (target) => target,
            false,
          );
          legs.mask = new AnimationGroupMask(legNames);
          legs.removeUnmaskedAnimations();
          return legs;
        });
      for (const group of actor.animations) group.mask = upperMask;
      const legMixer = createAnimationMixer(scene, legGroups);
      const mixer = createAnimationMixer(scene, actor.animations);
      function separateLegs(enabled: boolean) {
        if (upperMask.disabled === !enabled) return;
        upperMask.disabled = !enabled;
        for (const group of actor.animations) group.syncWithMask();
        if (!enabled) legMixer.stop();
      }
      let dashUntil = 0;
      let holdUntil = 0,
        combo = 0,
        previousAttack = 0,
        airborne = false,
        defeated = false;
      function action(
        kind: "attack" | "hit" | "guard" | "defeat" | "dash",
        ability?: string,
      ) {
        const now = performance.now() / 1000;
        if (kind === "hit" && now < holdUntil) return;
        if (kind === "attack" && now - previousAttack > 1.8) combo = 0;
        const motion =
          kind === "attack"
            ? combatMotion(classId, ability, combo++)
            : {
                clip:
                  kind === "dash"
                    ? "Jump_Start"
                    : kind === "hit"
                      ? "Hit_A"
                      : kind === "defeat"
                        ? "Death_A"
                        : "Block",
                duration:
                  kind === "defeat"
                    ? 1.1
                    : kind === "dash"
                      ? 0.24
                      : kind === "hit"
                        ? 0.26
                        : 0.45,
                impact: 0,
              };
        if (kind === "attack") previousAttack = now;
        defeated = kind === "defeat";
        holdUntil = now + motion.duration;
        if (kind === "dash") dashUntil = holdUntil;
        mixer.play(motion.clip, false, motion.duration, true);
        return motion;
      }
      function animate(
        _time: number,
        moving: boolean,
        _reduced: boolean,
        sprint = true,
        speed?: number,
        height = 0,
        verticalSpeed = 0,
        alive = true,
      ) {
        const now = performance.now() / 1000;
        const pace = speed ?? (moving ? (sprint ? 8 : 5.5) : 0);
        const locomotion = !moving
          ? idle
          : pace < 2.3
            ? "Walking_A"
            : sprint
              ? "Running_B"
              : "Running_A";
        separateLegs(moving && height <= 0.02 && alive && now >= dashUntil);
        const stride =
          locomotion === "Running_B"
            ? 0.52
            : locomotion === "Running_A"
              ? 0.66
              : undefined;
        if (moving && height <= 0.02 && alive && now >= dashUntil)
          legMixer.play(locomotion, true, stride);
        if (!alive) {
          if (!defeated) action("defeat");
          return;
        }
        if (defeated) {
          defeated = false;
          holdUntil = 0;
        }
        if (height > 0.02) {
          if (!airborne) mixer.play("Jump_Start", false, 0.22, true);
          else if (verticalSpeed < 1.8) mixer.play("Jump_Idle");
          airborne = true;
          return;
        }
        if (airborne) {
          airborne = false;
          mixer.play("Jump_Land", false, 0.18, true);
          holdUntil = now + (moving ? 0.08 : 0.16);
        }
        if (now < holdUntil) return;
        mixer.play(armed ? idle : locomotion, true, armed ? undefined : stride);
      }
      animate(0, false, false);
      return {
        ...actor,
        animate,
        get legMotion() {
          return legMixer.clip;
        },
        get motion() {
          return mixer.clip;
        },
        /** Mid-way through an attack, dash, hit or landing pose. */
        get busy() {
          return performance.now() / 1000 < holdUntil;
        },
        action,
        cancel() {
          holdUntil = 0;
          mixer.play(idle, true, undefined, true);
        },
        dispose() {
          mixer.dispose();
          legMixer.dispose();
          for (const group of legGroups) group.dispose();
          actor.dispose();
        },
      };
    },
    dispose: () => {
      avatars.dispose();
    },
  };
}
export type TrainerActor = ReturnType<
  Awaited<ReturnType<typeof loadTrainers>>["create"]
>;
