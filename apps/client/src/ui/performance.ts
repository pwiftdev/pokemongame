export function frameSummary(samples: number[]) {
  const sorted = samples
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
  };
}
export function performanceMarkup() {
  return '<details class="performance-panel" data-detail="performance"><summary>Performance & connection</summary><p id="performance-readout">Collecting samples…</p><p class="subtle">High frame times mean less smooth movement. Try Low graphics if frames regularly exceed 33 ms. A stale world update can indicate a connection or server delay.</p></details>';
}
export function updatePerformance(
  root: Element,
  snapshotAge: number,
  connected: boolean,
) {
  if (!root.querySelector('details[data-detail="performance"][open]')) return;
  const output = root.querySelector("#performance-readout");
  const metrics = (
    window as unknown as {
      __islandMetrics?: {
        fps: number;
        frameMs: number[];
        drawCalls: number;
        activeMeshes: number;
      };
    }
  ).__islandMetrics;
  if (!output || !metrics) return;
  const samples = frameSummary(metrics.frameMs);
  output.textContent = `${Math.round(metrics.fps)} FPS · Frame median ${samples.p50.toFixed(1)} ms · Slow frames (95th percentile) ${samples.p95.toFixed(1)} ms · ${metrics.drawCalls} draw calls · ${metrics.activeMeshes} visible meshes · ${connected ? `Last world update ${Math.max(0, Math.round(snapshotAge))} ms ago` : "Reconnecting"}`;
}
