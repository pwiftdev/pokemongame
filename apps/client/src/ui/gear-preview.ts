import type { Profile } from "../../../../packages/shared/types";
import type { GearState } from "../../../../packages/shared/gear";
import { loadAvatarLibrary } from "../render/avatar";
import { createAnimationMixer } from "../render/animation-mixer";
import { armedIdle } from "../render/equipment";
import { createAvatarStage } from "./avatar-stage";
export function mountGearPreview(
  host: HTMLElement,
  profile: Profile,
  equipped: GearState["equipped"],
) {
  const stage = createAvatarStage(host.querySelector("canvas")!);
  let disposed = false;
  let library: Awaited<ReturnType<typeof loadAvatarLibrary>> | undefined;
  let actor:
    | ReturnType<Awaited<ReturnType<typeof loadAvatarLibrary>>["create"]>
    | undefined;
  let mixer: ReturnType<typeof createAnimationMixer> | undefined;
  void loadAvatarLibrary(stage.scene)
    .then(async (loaded) => {
      if (disposed) {
        loaded.dispose();
        return;
      }
      library = loaded;
      actor = library.create(
        "gear-preview",
        profile.classId ?? "knight",
        profile.appearance,
        true,
        equipped,
      );
      mixer = createAnimationMixer(stage.scene, actor.animations);
      mixer.play(armedIdle(profile.classId ?? "knight"));
      stage.camera.target.y = actor.height * 0.51;
      stage.camera.radius = actor.height * 1.9;
      await stage.scene.whenReadyAsync();
      if (disposed) return;
      host.dataset.ready = "true";
      host.querySelector(".gear-preview-status")!.textContent =
        "Drag to rotate · Scroll to zoom";
    })
    .catch(() => {
      if (!disposed)
        host.querySelector(".gear-preview-status")!.textContent =
          "Preview unavailable. Reopen Gear to retry.";
    });
  return {
    dispose() {
      disposed = true;
      mixer?.dispose();
      actor?.dispose();
      library?.dispose();
      stage.dispose();
    },
  };
}
