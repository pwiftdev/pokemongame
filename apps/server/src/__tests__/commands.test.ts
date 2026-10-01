import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { commandSchema, RateLimit } from "../commands.js";

describe("untrusted command boundary", () => {
  it("bounds limiter storage without evicting live counters", () => {
    const limiter = new RateLimit(2, 1000, 2);
    expect(limiter.allow("a", 100)).toBe(true);
    expect(limiter.allow("b", 100)).toBe(true);
    expect(limiter.allow("c", 100)).toBe(false);
    expect(limiter.allow("a", 101)).toBe(true);
    expect(limiter.allow("a", 102)).toBe(false);
    expect(limiter.allow("c", 1100)).toBe(true);
  });
  it("rejects client currency, teleport, NaN, oversized movement, foreign fields and malformed IDs", () => {
    for (const command of [
      { kind: "balance", amount: 1000 },
      { kind: "move", dx: 100, dz: 0, sprint: false, yaw: 0 },
      { kind: "move", dx: NaN, dz: 0, sprint: false, yaw: 0 },
      { kind: "move", dx: 0, dz: 0, sprint: false, yaw: 0, x: 100 },
      { kind: "buy", requestId: randomUUID(), item: "capsule", quantity: -1 },
      { kind: "team", requestId: randomUUID(), ids: ["fake"] },
      { kind: "attack", requestId: randomUUID(), target: "sprig-1", slot: 6 },
      { kind: "starter", requestId: "replay", species: "spriglet" },
    ])
      expect(commandSchema.safeParse(command).success).toBe(false);
  });
  it("accepts a bounded valid movement and requires mutation request identifiers", () => {
    expect(
      commandSchema.safeParse({
        kind: "move",
        dx: 0.5,
        dz: -1,
        sprint: true,
        yaw: 2,
      }).success,
    ).toBe(true);
    expect(
      commandSchema.safeParse({
        kind: "buy",
        requestId: randomUUID(),
        item: "capsule",
        quantity: 2,
      }).success,
    ).toBe(true);
    expect(
      commandSchema.safeParse({ kind: "buy", item: "capsule", quantity: 2 })
        .success,
    ).toBe(false);
  });
  it("rate-limits independently per identity and resets after the configured window", () => {
    const limiter = new RateLimit(2, 1000);
    expect(limiter.allow("a", 100)).toBe(true);
    expect(limiter.allow("a", 101)).toBe(true);
    expect(limiter.allow("a", 102)).toBe(false);
    expect(limiter.allow("b", 102)).toBe(true);
    expect(limiter.allow("a", 1100)).toBe(true);
    limiter.remove("a");
    expect(limiter.allow("a", 1101)).toBe(true);
  });
});
