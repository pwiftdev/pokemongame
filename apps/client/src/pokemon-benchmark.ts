import { createWorld } from "./world";
import { POKEMON } from "../../../packages/shared/pokemon";
import type { WorldSnapshot } from "../../../packages/shared/types";

const noop = () => {};
const world = await createWorld(document.querySelector("canvas")!, {
  onTarget: noop,
  onMove: noop,
  onInteract: noop,
  onDash: noop,
  onAbility: noop,
  onTame: noop,
});
const species = Object.values(POKEMON).slice(0, 30),
  center = { x: 0, z: -10 };
const snapshot: WorldSnapshot = {
  time: Date.now(),
  roomId: "render-fixture",
  queue: [],
  duels: [],
  players: [],
  wilds: species.map((p, i) => ({
    id: `benchmark-${i}`,
    species: p.id,
    x: center.x + ((i % 6) - 2.5) * 2.5,
    z: center.z + (Math.floor(i / 6) - 2) * 2.6,
    level: 8,
    hp: 100,
    maxHp: 100,
    state: "roam",
    elite: false,
    boss: false,
    phase: 1,
  })),
};
world.setSnapshot(snapshot, "benchmark");
world.setPlaying(true);
world.setOverview(center, 29);
world.setSettings({ quality: "high", cameraShake: false });
const positions = snapshot.wilds.map((w) => ({ x: w.x, z: w.z }));
const interval = setInterval(() => {
  snapshot.time = Date.now();
  snapshot.wilds.forEach((w, i) => {
    w.x = positions[i].x + Math.sin(Date.now() / 1600 + i) * 0.35;
    w.z = positions[i].z + Math.cos(Date.now() / 1600 + i) * 0.35;
  });
  world.setSnapshot(snapshot, "benchmark");
}, 100);
document.querySelector("#status")!.textContent =
  "30 Pokémon · production island renderer · 1440 × 900";
Object.assign(window, {
  __pokemonBenchmark: {
    ready: true,
    setQuality: (quality: string) => world.setSettings({ quality }),
  },
});
window.addEventListener(
  "pagehide",
  () => {
    clearInterval(interval);
    world.dispose();
  },
  { once: true },
);
