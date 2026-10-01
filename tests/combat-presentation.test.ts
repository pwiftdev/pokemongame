import { describe, expect, it } from "vitest";
import { ABILITIES } from "../packages/shared/data";
import type { PlayerView, WildView } from "../packages/shared/types";
import { abilityAvailability } from "../apps/client/src/ui/combat";
import { creatureCast, castHits } from "../apps/server/src/boss";
import { turnTowards } from "../apps/client/src/render/camera-presentation";
const self: PlayerView = {
  id: "self",
  nickname: "Explorer",
  x: -12,
  z: -5,
  yaw: 0,
  moving: false,
  companion: "spriglet",
  companionLevel: 1,
  companionEvolved: false,
  hp: 90,
  maxHp: 90,
};
const target: WildView = {
  id: "wild",
  species: "spriglet",
  x: -14,
  z: -3,
  hp: 90,
  maxHp: 90,
  level: 1,
  state: "idle",
  elite: false,
  boss: false,
  phase: 1,
};
const attack = ABILITIES["leaf-tap"];
describe("combat readability and command eligibility", () => {
  it("prevents fake casts while recharging, defeated, out of range or in town", () => {
    expect(abilityAvailability(attack, self, target, 0, 100, false)).toBe(
      "Ready",
    );
    expect(abilityAvailability(attack, self, target, 200, 100, false)).toBe(
      "Recharging",
    );
    expect(
      abilityAvailability(attack, { ...self, hp: 0 }, target, 0, 100, false),
    ).toBe("You need healing");
    expect(
      abilityAvailability(attack, self, { ...target, x: -50 }, 0, 100, false),
    ).toBe("Move closer");
    expect(
      abilityAvailability(
        attack,
        { ...self, x: 0, z: -32 },
        target,
        0,
        100,
        false,
      ),
    ).toBe("Leave the safe haven to battle");
    expect(
      abilityAvailability(
        attack,
        self,
        { ...self, id: "stranger" },
        0,
        100,
        false,
      ),
    ).toBe("Challenge this trainer to a duel");
  });
  it("supports defensive actions without a target and avoids wasting a full-health heal", () => {
    const guard = Object.values(ABILITIES).find((a) => a.effect === "guard")!;
    expect(abilityAvailability(guard, self, undefined, 0, 100, false)).toBe(
      "Ready",
    );
    expect(
      abilityAvailability(ABILITIES.bloom, self, undefined, 0, 100, false),
    ).toBe("Already at full health");
    expect(
      abilityAvailability(
        ABILITIES.bloom,
        { ...self, hp: 20 },
        undefined,
        0,
        100,
        false,
      ),
    ).toBe("Ready");
  });
  it("prevents attacking from a waystone sanctuary while allowing recovery", () => {
    const camp = { ...self, x: 0, z: 210, hp: 20 };
    expect(
      abilityAvailability(
        attack,
        camp,
        { ...target, x: 2, z: 218 },
        0,
        100,
        false,
      ),
    ).toBe("Leave the safe haven to battle");
    expect(
      abilityAvailability(ABILITIES.bloom, camp, undefined, 0, 100, false),
    ).toBe("Ready");
  });
  it("gives a stationary telegraph, resolves only after windup, and can be dodged", () => {
    const center = { x: -12, z: -5 };
    const cast = creatureCast("leaf-tap", center, 1000);
    center.x += 5;
    expect(castHits(cast, { x: -12, z: -5 }, 1379)).toBe(false);
    expect(castHits(cast, { x: -12, z: -5 }, 1380)).toBe(true);
    expect(castHits(cast, center, 1380)).toBe(false);
  });
  it("turns along the shortest arc through the angle wrap", () => {
    expect(turnTowards(Math.PI - 0.1, -Math.PI + 0.1, 0.016)).toBeGreaterThan(
      Math.PI - 0.1,
    );
    expect(turnTowards(0, Math.PI / 2, 0)).toBe(0);
  });
});
