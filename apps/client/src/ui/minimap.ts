import {
  currentQuest,
  questDestination,
} from "../../../../packages/shared/story";
import { PLACES, SPECIES } from "../../../../packages/shared/data";
import {
  REGIONS,
  ROADS,
  regionBiome,
  WORLD_RADIUS,
} from "../../../../packages/shared/regions";
import type { WorldSnapshot, Profile } from "../../../../packages/shared/types";
export function drawMinimap(
  canvas: HTMLCanvasElement,
  snapshot: WorldSnapshot,
  selfId: string,
  profile?: Profile,
) {
  const ctx = canvas.getContext("2d"),
    self = snapshot.players.find((p) => p.id === selfId);
  if (!ctx || !self) return;
  const scale = 1.25,
    c = 90,
    point = (x: number, z: number) => [
      c + (x - self.x) * scale,
      c - (z - self.z) * scale,
    ];
  ctx.clearRect(0, 0, 180, 180);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, 82, 0, Math.PI * 2);
  ctx.clip();
  for (let x = 0; x < 180; x += 6)
    for (let y = 0; y < 180; y += 6) {
      const wx = self.x + (x - c) / scale,
        wz = self.z - (y - c) / scale;
      ctx.fillStyle =
        Math.hypot(wx, wz) > WORLD_RADIUS
          ? "#244856"
          : REGIONS.find((r) => r.id === regionBiome(wx, wz))!.color;
      ctx.fillRect(x, y, 6, 6);
    }
  ctx.strokeStyle = "#dfcea0";
  ctx.lineWidth = 2;
  for (const road of ROADS) {
    ctx.beginPath();
    road.forEach(([x, z], i) => {
      const [px, py] = point(x, z);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.stroke();
  }
  for (const place of PLACES) {
    const [x, y] = point(place.x, place.z);
    ctx.fillStyle = "#fff0b4";
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  for (const w of snapshot.wilds) {
    if (w.hp <= 0) continue;
    const [x, y] = point(w.x, w.z);
    ctx.fillStyle = SPECIES[w.species].companion
      ? "#a3efbf"
      : w.boss
        ? "#ff7160"
        : w.elite
          ? "#f9c864"
          : "#e7ab97";
    ctx.beginPath();
    ctx.arc(x, y, w.boss ? 3 : 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const quest = profile && currentQuest(profile);
  const destination = profile && quest && questDestination(profile, quest);
  if (destination) {
    const [px, py] = point(destination.x, destination.z);
    const dx = px - c,
      dy = py - c,
      d = Math.hypot(dx, dy);
    const ratio = Math.min(1, 72 / Math.max(1, d));
    ctx.fillStyle = "#ffe179";
    ctx.strokeStyle = "#543c22";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const x = c + dx * ratio,
      y = c + dy * ratio;
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 5, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.translate(c, c);
  ctx.rotate(self.yaw);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 4);
  ctx.lineTo(0, 2);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.font = "600 11px system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f9e4b3";
  ctx.fillText("N", 90, 12);
}
