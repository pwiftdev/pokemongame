import { createWorld } from "./world";
import { REGIONS } from "../../../packages/shared/regions";
const noop = () => {};
const world = await createWorld(document.querySelector("canvas")!, {
  onTarget: noop,
  onMove: noop,
  onInteract: noop,
  onDash: noop,
  onAbility: noop,
  onTame: noop,
});
const views = [
  { x: 0, z: -27, radius: 40, beta: 1.1 },
  { x: -67, z: -4, radius: 48, beta: 1.02 },
  { x: 88, z: 3, radius: 49, beta: 1.02, alpha: -2.5 },
  { x: 38, z: 74, radius: 48, beta: 1.02, alpha: -2.25 },
  { x: -210, z: -16, radius: 65, beta: 1.05 },
  { x: 205, z: 19, radius: 52, beta: 1.02 },
  { x: 23, z: 223, radius: 65, beta: 1.04 },
  { x: 8, z: -185, radius: 60, beta: 1.04, alpha: -2 },
];
world.setSnapshot(
  {
    time: 300000,
    roomId: "world-tour",
    queue: [],
    duels: [],
    players: [],
    wilds: [],
  },
  "tour",
);
world.setPlaying(true);
world.setSettings({ quality: "high", cameraShake: false });
const nav = document.querySelector("nav")!;
function visit(index: number) {
  const r = REGIONS[index],
    view = views[index];
  if (!r || !view) return;
  world.setOverview(view, view.radius);
  document.querySelector("h1")!.textContent = r.name;
  document.querySelector("p")!.textContent = r.subtitle;
  nav
    .querySelectorAll("button")
    .forEach((b, i) => b.setAttribute("aria-pressed", String(i === index)));
}
REGIONS.forEach((r, i) => {
  const button = document.createElement("button");
  button.textContent = r.name;
  button.onclick = () => visit(i);
  nav.append(button);
});
visit(0);
Object.assign(window, {
  __worldTour: {
    ready: true,
    visit,
    setQuality: (quality: string) => world.setSettings({ quality }),
  },
});
window.addEventListener("pagehide", () => world.dispose(), { once: true });
