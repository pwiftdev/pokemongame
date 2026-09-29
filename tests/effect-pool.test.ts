import { describe, expect, it, vi } from "vitest";
import { Mesh, NullEngine, Scene } from "@babylonjs/core";
import { createEffectPool } from "../apps/client/src/render/effect-pool";

describe("combat effect lifetime", () => {
  it("waits for windup, lands once and releases expired resources", () => {
    const engine = new NullEngine(),
      scene = new Scene(engine),
      pool = createEffectPool();
    const mesh = new Mesh("bolt", scene),
      update = vi.fn(),
      cleanup = vi.fn();
    pool.track(mesh, 0.2, update, cleanup, 0.3);
    expect(mesh.isEnabled()).toBe(false);
    pool.update(0.2, false);
    expect(update).not.toHaveBeenCalled();
    pool.update(0.15, false);
    expect(mesh.isEnabled()).toBe(true);
    pool.update(0.3, false);
    expect(update.mock.calls.filter(([t]) => t === 1)).toHaveLength(1);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(mesh.isDisposed()).toBe(true);
    pool.dispose();
    expect(cleanup).toHaveBeenCalledOnce();
    engine.dispose();
  });
  it("caps particles and disposes even delayed effects when leaving the scene", () => {
    const engine = new NullEngine(),
      scene = new Scene(engine),
      pool = createEffectPool(2);
    const cleanup = vi.fn();
    for (let i = 0; i < 5; i++)
      pool.track(new Mesh(`effect${i}`, scene), 1, () => {}, cleanup, 10);
    pool.update(0.1, false);
    expect(pool.count).toBe(2);
    expect(cleanup).toHaveBeenCalledTimes(3);
    pool.dispose();
    expect(pool.count).toBe(0);
    expect(cleanup).toHaveBeenCalledTimes(5);
    expect(scene.meshes).toHaveLength(0);
    engine.dispose();
  });
});
