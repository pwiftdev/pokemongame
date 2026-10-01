import { AudioMixer } from "./audio/mixer";
import { audioDefaults, cues, tracks, type CueId } from "./audio/catalog";
import { soundscape } from "./audio/soundscape";
import { REGIONS } from "../../../packages/shared/regions";
import type { Biome } from "../../../packages/shared/types";
import "./sound-studio.css";
const root = document.querySelector<HTMLElement>("#studio")!;
let mixer: AudioMixer | undefined;
let biome: Biome = "town",
  battle = false,
  night = false,
  rain = false,
  muted = false;
root.innerHTML = `<a class="back" href="/">← Back to the island</a><header><p class="eyebrow">THE WILDLIGHT ISLES</p><h1>A world worth listening to.</h1><p>Explore the soundtrack, listen to the landscape, and try the sounds of your next adventure.</p><button id="listen">Start listening</button><button id="mute" disabled>Mute</button><p id="status" role="status">Sound starts when you choose to listen.</p></header><section><h2>Across the islands</h2><div class="regions">${REGIONS.map((r) => `<button data-region="${r.id}">${r.name}</button>`).join("")}</div><div class="conditions"><label><input id="night" type="checkbox"/> Nightfall</label><label><input id="rain" type="checkbox"/> Rain</label><label><input id="battle" type="checkbox"/> Battle music</label></div></section><section><h2>Sounds of adventure</h2><div class="effects">${Object.keys(
  cues,
)
  .map((id) => `<button data-cue="${id}">${id.replaceAll("-", " ")}</button>`)
  .join(
    "",
  )}</div></section><footer><p>Music and recordings are shared under CC0. Creature voices are adapted fantasy sounds.</p><a href="/legal/AUDIO_CREDITS.txt">Meet the creators and view source credits</a></footer>`;
function update() {
  if (!mixer) return;
  const region = REGIONS.find((r) => r.id === biome)!;
  const point = { x: region.x, z: region.z };
  mixer.setListener(point, -Math.PI / 2);
  mixer.configure({ ...audioDefaults, mute: muted });
  mixer.setActive(!muted && !document.hidden);
  if (!muted && !document.hidden)
    mixer.update(
      battle ? "combat" : tracks[biome],
      soundscape(biome, point, night, rain),
    );
  root
    .querySelectorAll<HTMLButtonElement>("[data-region]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.region === biome),
      ),
    );
}
root.addEventListener("click", async (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button",
  );
  if (!button) return;
  if (!mixer) {
    try {
      mixer = new AudioMixer(new AudioContext());
      await mixer.context.resume();
    } catch {
      document.querySelector("#status")!.textContent =
        "Audio is unavailable in this browser.";
      return;
    }
    document.querySelector<HTMLButtonElement>("#mute")!.disabled = false;
    document.querySelector("#listen")!.textContent = "Listening";
    document.querySelector("#status")!.textContent =
      "Music follows your region. Effects play when selected.";
  }
  if (button.id === "mute") {
    muted = !muted;
    button.textContent = muted ? "Unmute" : "Mute";
  }
  if (button.dataset.region) biome = button.dataset.region as Biome;
  update();
  if (button.dataset.cue) {
    const id = button.dataset.cue as CueId;
    await Promise.all(
      cues[id].files.map((file) => mixer!.buffers.get(file).catch(() => {})),
    );
    await mixer.play(id);
  }
});
root.addEventListener("change", () => {
  night = document.querySelector<HTMLInputElement>("#night")!.checked;
  rain = document.querySelector<HTMLInputElement>("#rain")!.checked;
  battle = document.querySelector<HTMLInputElement>("#battle")!.checked;
  update();
});
const interval = setInterval(update, 300);
document.addEventListener("visibilitychange", update);
window.addEventListener("beforeunload", () => {
  clearInterval(interval);
  mixer?.dispose();
});
Object.defineProperty(window, "__audioMetrics", { get: () => mixer?.metrics });
