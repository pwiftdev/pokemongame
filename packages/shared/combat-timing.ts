export function castTiming(id: string, range: number) {
  const windup =
    (
      {
        "heroic-throw": 230,
        "arcane-barrage": 350,
        "fan-of-knives": 140,
        shockwave: 320,
        slash: 230,
        "shield-strike": 180,
        stab: 140,
        venom: 230,
        ambush: 280,
        eviscerate: 260,
        cleave: 320,
        crush: 520,
        execute: 380,
        whirlwind: 260,
        sweep: 240,
        firebolt: 550,
        frostbolt: 400,
        meteor: 1200,
        icelance: 120,
      } as Record<string, number>
    )[id] ?? 0;
  const flight =
    id === "meteor"
      ? 460
      : id === "frostbolt"
        ? 150
        : ["firebolt", "icelance", "arcane-barrage", "heroic-throw"].includes(
              id,
            )
          ? Math.max(200, Math.min(500, (range / 28) * 1000))
          : 0;
  return { windup, flight, stationary: ["firebolt", "meteor"].includes(id) };
}
