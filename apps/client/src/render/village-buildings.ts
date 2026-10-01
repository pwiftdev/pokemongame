export type BuildingPart = {
  model: string;
  x: number;
  y: number;
  z: number;
  angle: number;
};
export const VILLAGE_BUILDINGS = [
  {
    name: "Springhouse",
    width: 6,
    depth: 4,
    floors: 1,
    roof: "Roof_RoundTiles_6x4",
    angle: 0,
    stone: true,
    balcony: false,
    awning: true,
  },
  {
    name: "Mira's shop",
    width: 4,
    depth: 4,
    floors: 2,
    roof: "Roof_RoundTiles_4x4",
    angle: 0,
    stone: false,
    balcony: true,
    awning: false,
  },
  {
    name: "Companion lodge",
    width: 4,
    depth: 6,
    floors: 1,
    roof: "Roof_RoundTiles_4x6",
    angle: Math.PI / 2,
    stone: false,
    balcony: false,
    awning: true,
  },
  {
    name: "Watchhouse",
    width: 4,
    depth: 4,
    floors: 2,
    roof: "Roof_Tower_RoundTiles",
    angle: -Math.PI / 2,
    stone: true,
    balcony: false,
    awning: false,
  },
  {
    name: "Wayfarer's cottage",
    width: 6,
    depth: 4,
    floors: 1,
    roof: "Roof_RoundTiles_6x4",
    angle: Math.PI / 2,
    stone: false,
    balcony: false,
    awning: false,
  },
] as const;
export function buildingParts(index: number) {
  const definition = VILLAGE_BUILDINGS[index % VILLAGE_BUILDINGS.length];
  const parts: BuildingPart[] = [];
  const add = (model: string, x: number, y: number, z: number, angle = 0) =>
    parts.push({ model, x, y, z, angle });
  for (let floor = 0; floor < definition.floors; floor++)
    for (let side = 0; side < 4; side++) {
      const width = side % 2 ? definition.depth : definition.width;
      const depth = side % 2 ? definition.width : definition.depth;
      const angle = (side * Math.PI) / 2;
      for (let column = 0; column < width / 2; column++) {
        const offset = -width / 2 + 1 + column * 2;
        const x = offset * Math.cos(angle) + (depth / 2) * Math.sin(angle);
        const z = -offset * Math.sin(angle) + (depth / 2) * Math.cos(angle);
        const door =
          floor === 0 &&
          side === 0 &&
          column === Math.floor((width / 2 - 1) / 2);
        const window = door || column % 2 === 0 || side === 0;
        const stone = definition.stone && floor === 0;
        add(
          door
            ? stone
              ? "Wall_UnevenBrick_Door_Round"
              : "Wall_Plaster_Door_Round"
            : window
              ? stone
                ? "Wall_UnevenBrick_Window_Wide_Flat"
                : "Wall_Plaster_Window_Wide_Flat"
              : stone
                ? "Wall_UnevenBrick_Straight"
                : "Wall_Plaster_Straight",
          x,
          floor * 3,
          z,
          angle,
        );
        if (door) {
          add("Door_1_Round", x - 0.52, 0, z);
          add(
            stone ? "DoorFrame_Round_Brick" : "DoorFrame_Round_WoodDark",
            x,
            0,
            z,
          );
        } else if (window) {
          add("Window_Wide_Flat1", x, floor * 3, z, angle);
          if (!stone)
            add("WindowShutters_Wide_Flat_Open", x, floor * 3, z, angle);
        }
      }
    }
  const roofY = definition.floors * 3;
  add(
    definition.roof,
    0,
    roofY,
    definition.roof === "Roof_RoundTiles_6x4" ? -2 : 0,
  );
  if (definition.roof !== "Roof_Tower_RoundTiles") {
    const gable =
      definition.width === 4 ? "Roof_Front_Brick4" : "Roof_Front_Brick6";
    add(gable, 0, roofY, definition.depth / 2);
    add(gable, 0, roofY, -definition.depth / 2, Math.PI);
    add(
      index % 2 ? "Prop_Chimney2" : "Prop_Chimney",
      definition.width / 2 - 1.3,
      roofY + 0.5,
      -0.7,
    );
  }
  if (definition.balcony) {
    add("Floor_WoodDark", -1, 3, definition.depth / 2 + 1);
    add("Floor_WoodDark", 1, 3, definition.depth / 2 + 1);
    add("Balcony_Simple_Corner", -1, 3, definition.depth / 2 + 1, Math.PI / 2);
    add("Balcony_Simple_Corner", 1, 3, definition.depth / 2 + 1, Math.PI);
    add("Prop_Support", -1.8, 0, definition.depth / 2);
    add("Prop_Support", 1.8, 0, definition.depth / 2);
  }
  if (definition.awning) {
    add("Roof_Wooden_2x1", -1, 2.35, definition.depth / 2 + 0.05);
  }
  if (!definition.stone)
    add(
      "Prop_Vine1",
      -definition.width / 2 + 0.3,
      0,
      definition.depth / 2 + 0.05,
    );
  return { definition, parts };
}
