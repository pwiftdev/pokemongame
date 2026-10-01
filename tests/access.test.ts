import { describe, expect, it } from "vitest";
import { guestCanReach, guestStep, isGuest } from "../packages/shared/access";
import { cleanChat, CHAT } from "../packages/shared/chat";
import { WORLD } from "../packages/shared/data";
import { REGIONS } from "../packages/shared/regions";

describe("guest regions", () => {
  it("allows Hearthwick and Sunpetal Meadows only", () => {
    const at = (id: string) => REGIONS.find((r) => r.id === id)!;
    expect(guestCanReach(WORLD.spawn.x, WORLD.spawn.z)).toBe(true);
    expect(guestCanReach(at("meadow").x, at("meadow").z)).toBe(true);
    for (const id of ["forest", "ruins", "desert", "marsh", "tundra"])
      expect(guestCanReach(at(id).x, at(id).z)).toBe(false);
  });
  it("slides along the border instead of crossing it", () => {
    const from = { x: 11.5, z: 20 };
    expect(guestStep(from, { x: 12.5, z: 21 })).toEqual({ x: 11.5, z: 21 });
    expect(guestStep(from, { x: 11, z: 21 })).toEqual({ x: 11, z: 21 });
  });
  it("lets a guest who is already outside walk back", () => {
    expect(guestStep({ x: 60, z: 30 }, { x: 59, z: 30 })).toEqual({
      x: 59,
      z: 30,
    });
  });
  it("treats accounts without a wallet as guests", () => {
    expect(isGuest({})).toBe(true);
    expect(isGuest({ wallet: "abc" })).toBe(false);
  });
});

describe("chat", () => {
  it("normalizes whitespace and hidden characters", () => {
    expect(cleanChat("  hello​ \n  there\u0007 ")).toEqual({
      ok: true,
      text: "hello there",
    });
  });
  it("rejects empty, long, link and address messages", () => {
    expect(cleanChat("   ").ok).toBe(false);
    expect(cleanChat("a".repeat(CHAT.maxLength + 1)).ok).toBe(false);
    expect(cleanChat("free tokens at https://scam.example").ok).toBe(false);
    expect(cleanChat("go to claim-wop.xyz now").ok).toBe(false);
    expect(
      cleanChat("CA: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU").ok,
    ).toBe(false);
    expect(cleanChat("gg, nice duel!").ok).toBe(true);
  });
});
