import type { loadScenery } from "./scenery";
import { terrainHeight } from "../../../../packages/shared/rules";
type Scenery = Awaited<ReturnType<typeof loadScenery>>;
export function buildRegionalLandmarks(scenery: Scenery) {
  const place = scenery.place;
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6,
      x = -213 + Math.cos(angle) * 20,
      z = 55 + Math.sin(angle) * 20;
    place("Corner_ExteriorWide_Brick", x, z, 5 + (i % 3) * 2, angle);
    if (i % 3 === 0)
      place("DoorFrame_Round_Brick", x, z, 9, angle + Math.PI / 2);
    place(
      "Sandstone",
      x + 3,
      z - 3,
      2.5,
      angle,
      terrainHeight(x + 3, z - 3) - 1,
    );
  }
  for (let i = 0; i < 4; i++) {
    place(
      "TwistedTree_1",
      211 + Math.cos((i * Math.PI) / 2) * 14,
      61 + Math.sin((i * Math.PI) / 2) * 14,
      20 + i * 2,
      i,
    );
    for (let j = 0; j < 7; j++)
      place(
        "Mushroom_Common",
        208 + i * 3 + Math.sin(j) * 5,
        61 + Math.cos(j) * 8,
        1 + j * 0.16,
        j,
        undefined,
        true,
      );
  }
  for (let i = 0; i < 7; i++) {
    place(
      "Rock_Medium_3",
      -43 + i * 14,
      247 + Math.abs(i - 3) * 3,
      19 + Math.abs(i - 3) * 5,
      i,
    );
    place("SnowPine", -42 + i * 14, 237, 10 + (i % 3) * 3, i);
  }
  for (const x of [-7, 7]) {
    place("DoorFrame_Round_Brick", x, 235, 11);
    place("Corner_ExteriorWide_Brick", x * 2.4, 235, 15);
  }
  place("Mill", -33, -183, 15, Math.PI / 2);
  for (let i = 0; i < 12; i++)
    place("Prop_WoodenFence_Single", -26 + i * 3, -204, 1.3);
  for (const [x, z] of [
    [-34, -213],
    [33, -210],
    [31, -175],
  ]) {
    place("Stall_Empty", x, z, 4);
    place("FarmCrate_Apple", x, z + 1, 1);
    place("Prop_Wagon", x + 5, z - 2, 3, 0.6);
    place("Barrel", x - 2, z + 2, 1.3);
  }
}
