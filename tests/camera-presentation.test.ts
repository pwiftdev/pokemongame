import { describe, expect, it } from "vitest";
import { ArcRotateCamera, NullEngine, Scene, Vector3 } from "@babylonjs/core";
import {
  bodyVisibility,
  followCameraTarget,
  labelPresentation,
  viewDepth,
} from "../apps/client/src/render/camera-presentation";

describe("camera presentation", () => {
  it("follows moving and respawned players without changing orbit angles or the chosen zoom", () => {
    const engine = new NullEngine();
    try {
      const scene = new Scene(engine),
        camera = new ArcRotateCamera(
          "follow",
          -Math.PI / 2,
          1.3,
          15,
          new Vector3(0, 1.7, -32),
          scene,
        );
      camera.getViewMatrix(true);
      const originalTarget = camera.target;
      for (const target of [
        new Vector3(-10, 1.7, -30),
        new Vector3(6, 2, 72),
        new Vector3(0, 1.7, -32),
      ]) {
        for (let frame = 0; frame < 60; frame++) {
          followCameraTarget(camera, target, 1 / 60);
          camera.getViewMatrix(true);
        }
        expect(camera.alpha).toBe(-Math.PI / 2);
        expect(camera.beta).toBe(1.3);
        expect(camera.radius).toBe(15);
      }
      expect(camera.target).toBe(originalTarget);
      expect(
        Vector3.Distance(camera.target, new Vector3(0, 1.7, -32)),
      ).toBeLessThan(0.05);
    } finally {
      engine.dispose();
    }
  });
  it("hides world labels near or behind the camera", () => {
    for (const depth of [-20, 0, 0.2, 3.49])
      expect(labelPresentation(depth, 4.3, 0.8, 1.6).visible).toBe(false);
  });
  it("caps label width on screen and restores its authored scale when distant", () => {
    const near = labelPresentation(4, 4.3, 0.8, 1.6);
    expect(near.visible).toBe(true);
    const fullScreenWidth = 4 * 2 * Math.tan(0.8 / 2) * 1.6;
    expect((near.scale * 4.3) / fullScreenWidth).toBeCloseTo(0.24);
    expect(labelPresentation(40, 4.3, 0.8, 1.6)).toEqual({
      visible: true,
      scale: 1,
    });
  });
  it("fades actor meshes predictably and restores full visibility outside the camera", () => {
    expect(bodyVisibility(0.85, 2.4, 3.8)).toBe(0);
    expect(bodyVisibility(3.1, 2.4, 3.8)).toBeCloseTo(0.5);
    expect(bodyVisibility(15, 2.4, 3.8)).toBe(1);
  });
  it("uses forward depth rather than distance to distinguish labels behind the viewer", () => {
    const camera = new Vector3(0, 2, -5),
      forward = new Vector3(0, 0, 1);
    expect(viewDepth(new Vector3(0, 3, 5), camera, forward)).toBe(10);
    expect(viewDepth(new Vector3(0, 3, -10), camera, forward)).toBe(-5);
  });
});
