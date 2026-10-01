export const CAMP_SITES = [
  [-187, -17, 0.5],
  [-23, 231, 2.5],
  [181, -5, 1.8],
];
export const TOWN_TORCHES = [
  [-6, -24],
  [6, -24],
  [-6, -33],
  [6, -33],
  [-19, -11],
  [23, -3],
  [31, 4],
];
export const FIRE_SOURCES = [
  ...TOWN_TORCHES,
  ...CAMP_SITES.map(([x, z]) => [x + 4, z + 3, 0.6]),
];
export const WATERFALL = {
  cliff: { x: 102, z: -14 },
  top: { x: 93, z: -9 },
  bottom: { x: 91, z: -6 },
};
