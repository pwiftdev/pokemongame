import type { Biome, Profile } from "./types";

export interface Quest {
  id: string;
  name: string;
  description: string;
  key: string;
  goal: number;
  reward: number;
  prerequisite?: string;
  repeatable?: boolean;
  giver?: string;
  turnIn?: string;
  dialogue?: string;
  completion?: string;
  destination?: { x: number; z: number; name: string };
  supplies?: Record<string, number>;
  xp?: number;
  side?: boolean;
}
export const STORY_PLACES: {
  id: string;
  name: string;
  x: number;
  z: number;
  kind: "quest" | "landmark";
  biome: Biome;
  description: string;
  role: "ranger" | "scholar" | "parcel" | "ward";
}[] = [
  {
    id: "ranger",
    name: "Ranger Rowan",
    x: -25,
    z: 8,
    kind: "quest",
    biome: "meadow",
    role: "ranger",
    description:
      "The orchard went quiet when the old wards failed. Help me get the Pokémon home safely.",
  },
  {
    id: "scholar",
    name: "Warden Elara",
    x: 25,
    z: 16,
    kind: "quest",
    biome: "forest",
    role: "scholar",
    description:
      "These wards once kept Stormheart asleep. Something has broken the connection to Tideglass.",
  },
  {
    id: "lost-parcel",
    name: "Rowan’s missing satchel",
    x: -46,
    z: 18,
    kind: "landmark",
    biome: "meadow",
    role: "parcel",
    description:
      "Capsules, field notes, and a torn map of the old ward network.",
  },
  {
    id: "ward-west",
    name: "Rootbound ward",
    x: 46,
    z: 28,
    kind: "landmark",
    biome: "forest",
    role: "ward",
    description:
      "Roots have cracked the ward. A pulse of blue light still points north.",
  },
  {
    id: "ward-east",
    name: "Hollow-tree ward",
    x: 58,
    z: 42,
    kind: "landmark",
    biome: "forest",
    role: "ward",
    description:
      "The ward hums faintly. Its inscription names the Tideglass beacon.",
  },
  {
    id: "tide-beacon",
    name: "Tideglass beacon",
    x: 16,
    z: 58,
    kind: "landmark",
    biome: "ruins",
    role: "ward",
    description:
      "The beacon answers. A deep rumble rolls from Stormheart’s sanctuary.",
  },
];
export const QUESTS: Quest[] = [
  {
    id: "first-friend",
    name: "A friend for the road",
    description:
      "Choose your class and first Pokémon. Open the journal to collect your expedition allowance.",
    key: "starter",
    goal: 1,
    reward: 40,
  },
  {
    id: "story-ranger",
    name: "The silent orchard",
    prerequisite: "first-friend",
    giver: "quest",
    turnIn: "ranger",
    key: "visit:ranger",
    goal: 1,
    reward: 25,
    xp: 60,
    description:
      "Follow the western road to Ranger Rowan at the Sunpetal windmill.",
    dialogue:
      "Rowan’s supply runner never returned. The orchard Pokémon have scattered, and the ward lights went out last night. Find him by the windmill.",
    completion:
      "You made it. Those creatures in the orchard are monsters, not Pokémon. We need to make the grove safe before we bring the little ones back.",
    destination: { x: -30, z: 4, name: "Ranger Rowan · Sunpetal windmill" },
  },
  {
    id: "story-orchard",
    name: "Make a little room",
    prerequisite: "story-ranger",
    giver: "ranger",
    key: "camp:orchard",
    goal: 2,
    reward: 45,
    xp: 100,
    description:
      "Defeat two monsters in the Overgrown Orchard, west of Rowan. Return to him when it is safe.",
    dialogue:
      "Clear two of the monsters nesting among the orchard roots. Your weapon does the fighting; your Pokémon can assist. The road itself is safe.",
    completion:
      "That gives the Pokémon room to return. Now, about my missing supplies…",
    supplies: { potion: 2 },
    destination: { x: -46, z: 12, name: "Overgrown Orchard · 2 monsters" },
  },
  {
    id: "story-satchel",
    name: "The missing field kit",
    prerequisite: "story-orchard",
    giver: "ranger",
    key: "visit:lost-parcel",
    goal: 1,
    reward: 30,
    xp: 80,
    description:
      "Recover Rowan’s satchel at the northern edge of the orchard. Press E beside it, then return to Rowan.",
    dialogue:
      "My satchel is beside the old orchard fence. There should be capsules inside—and a map that explains why the wards matter.",
    completion:
      "The field kit survived. Keep these capsules and bait. Let’s put them to good use.",
    destination: { x: -46, z: 18, name: "Missing satchel · press E" },
  },
  {
    id: "story-catch",
    name: "A home for a wild heart",
    prerequisite: "story-satchel",
    giver: "ranger",
    key: "captures",
    goal: 1,
    reward: 65,
    xp: 160,
    supplies: { capsule: 8, bait: 3 },
    description:
      "Catch a wild Pokémon in a meadow habitat. Press H to stop companion attacks; weaken it below 75% health or use Sweetseed bait, then press F.",
    dialogue:
      "Bulbasaur shelter in Clover Hollow, Squirtle gather at Reedbank Pool, and Charmander warm themselves at the sunlit rocks. Use bait for a peaceful catch. I’ll help your first prepared capsule hold.",
    completion:
      "A new friend, safely home. The satchel map points east. Take it to Warden Elara in Lanternwood.",
    destination: { x: -65, z: 34, name: "Clover Hollow · wild Bulbasaur" },
  },
  {
    id: "story-warden",
    name: "A map of fading lights",
    prerequisite: "story-catch",
    giver: "ranger",
    turnIn: "scholar",
    key: "visit:scholar",
    goal: 1,
    reward: 45,
    xp: 130,
    description:
      "Meet Warden Elara beside the Lanternwood road, east of Hearthwick.",
    dialogue:
      "Elara studies the ward network. Show her what we found. Follow the road through Hearthwick; there is no need to cut through monster dens.",
    completion:
      "Rowan was right. The forest wards and the Tideglass beacon form one seal. Let’s find where it broke.",
    destination: { x: 29, z: 16, name: "Warden Elara · Lanternwood" },
  },
  {
    id: "story-roots",
    name: "Untangle the light",
    prerequisite: "story-warden",
    giver: "scholar",
    key: "camp:roots",
    goal: 2,
    reward: 85,
    xp: 260,
    supplies: { potion: 3 },
    description:
      "Defeat two monsters in the Tangled Roots camp. Report to Elara.",
    dialogue:
      "Clear the two root guardians so I can reconnect the wards. Keep your Pokémon close and use your defensive ability when they strike.",
    completion:
      "The ward sites are safe to approach. Read both inscriptions so we can trace the broken connection.",
    destination: { x: 53, z: 34, name: "Tangled Roots · 2 monsters" },
  },
  {
    id: "story-wards",
    name: "Read the roots",
    prerequisite: "story-roots",
    giver: "scholar",
    key: "forest-wards",
    goal: 2,
    reward: 75,
    xp: 220,
    description:
      "Inspect both forest wards with E: the Rootbound ward and Hollow-tree ward. Each inscription counts once.",
    dialogue:
      "Read both inscriptions. Don’t mistake the monsters guarding the roots for Pokémon—they cannot be caught. Bring me the pattern you find.",
    completion:
      "Both inscriptions point to Tideglass. With the root guardians gone, only the dark beacon stands between us and the restored seal.",
    destination: {
      x: 46,
      z: 28,
      name: "Rootbound ward · then Hollow-tree ward",
    },
  },
  {
    id: "story-beacon",
    name: "Light on the tide",
    prerequisite: "story-wards",
    giver: "scholar",
    key: "visit:tide-beacon",
    goal: 1,
    reward: 100,
    xp: 300,
    description:
      "Follow the north road and rekindle the Tideglass beacon with E. Return to Elara.",
    dialogue:
      "The beacon sits beside the ruined arches. Rekindle it, but keep clear of the sanctuary beyond until you are ready.",
    completion:
      "The beacon is burning again—but Stormheart is awake. The seal will only hold when its storm is spent.",
    destination: { x: 16, z: 58, name: "Tideglass beacon · press E" },
  },
  {
    id: "story-storm",
    name: "The heart of the island",
    prerequisite: "story-beacon",
    giver: "scholar",
    key: "bosses",
    goal: 1,
    reward: 220,
    xp: 450,
    supplies: { potion: 5, rations: 3 },
    description:
      "Help defeat Stormheart in the northern sanctuary. Prepare at the Springhouse and lodge; bring another adventurer for this shared boss.",
    dialogue:
      "Stormheart is too powerful to rush. Train your team, evolve a level-six companion at the lodge, and bring an ally. Dodge the marked ground. Everyone who helps shares the victory.",
    completion:
      "The wards are singing again. Hearthwick and its Pokémon are safe. Beyond these roads, other wardens are waiting for explorers like you.",
    destination: { x: -9, z: 80, name: "Stormheart sanctuary · shared boss" },
  },
  ...(
    [
      ["highlands", "Kingsward Vale", 0, -188],
      ["desert", "Amberfall Expanse", -185, 12],
      ["marsh", "Moonfen", 184, 20],
      ["tundra", "Frostveil Highlands", 0, 210],
    ] as const
  ).map(
    ([biome, name, x, z]): Quest => ({
      id: `survey-${biome}`,
      name: `The ${name} connection`,
      prerequisite: "story-catch",
      giver: "quest",
      key: `visit:waystone-${biome}`,
      goal: 1,
      reward: 100,
      xp: 180,
      side: true,
      description: `Follow the roads to ${name}. Inspect its waystone with E, then report to the expedition board.`,
      dialogue: `The wardens need a reliable route to ${name}. Survey the waystone yourself and record its signal. You can travel back between attuned waystones.`,
      completion: `Another route restored. Our explorers can now follow your field notes.`,
      destination: { x, z, name: `${name} waystone` },
    }),
  ),
];
export function questAccepted(p: Profile, q: Quest) {
  return !q.giver || p.quests[`accepted:${q.id}`] === 1;
}
export function questUnlocked(p: Profile, q: Quest) {
  return !q.prerequisite || p.claimed.includes(q.prerequisite);
}
export function questProgress(p: Profile, q: Quest) {
  return Math.min(q.goal, p.quests[q.giver ? `progress:${q.id}` : q.key] ?? 0);
}
export function currentQuest(p: Profile) {
  return QUESTS.find(
    (q) => !q.side && !p.claimed.includes(q.id) && questUnlocked(p, q),
  );
}
export function recordQuestEvent(p: Profile, key: string, unique?: string) {
  for (const q of QUESTS) {
    if (
      !q.giver ||
      q.key !== key ||
      !questAccepted(p, q) ||
      !questUnlocked(p, q) ||
      p.claimed.includes(q.id)
    )
      continue;
    const stamp = `objective:${q.id}:${unique}`;
    if (unique && p.quests[stamp]) continue;
    if (unique) p.quests[stamp] = 1;
    p.quests[`progress:${q.id}`] = Math.min(q.goal, questProgress(p, q) + 1);
  }
}
export function questDestination(p: Profile, q: Quest) {
  if (!questAccepted(p, q) || questProgress(p, q) >= q.goal) {
    const id = questProgress(p, q) >= q.goal ? (q.turnIn ?? q.giver) : q.giver;
    if (id === "quest")
      return { x: 0, z: -22, name: "Hearthwick expedition board" };
    return STORY_PLACES.find((place) => place.id === id);
  }
  if (q.id === "story-wards" && p.quests[`objective:${q.id}:ward-west`])
    return STORY_PLACES.find((place) => place.id === "ward-east");
  const interaction = q.key.startsWith("visit:")
    ? STORY_PLACES.find((p) => p.id === q.key.slice(6))
    : undefined;
  return interaction ?? q.destination;
}
export function tutorialCapture(p: Profile) {
  const q = QUESTS.find((q) => q.id === "story-catch")!;
  return (
    questAccepted(p, q) &&
    questUnlocked(p, q) &&
    questProgress(p, q) < q.goal &&
    !p.claimed.includes(q.id)
  );
}

export function interactionRadius(id: string) {
  return STORY_PLACES.some((p) => p.id === id && p.kind === "landmark") ? 4 : 9;
}
export function hasStoryInteraction(p: Profile, id: string) {
  return QUESTS.some(
    (q) =>
      questAccepted(p, q) &&
      questUnlocked(p, q) &&
      !p.claimed.includes(q.id) &&
      questProgress(p, q) < q.goal &&
      (q.key === `visit:${id}` ||
        (q.key === "forest-wards" &&
          ["ward-west", "ward-east"].includes(id))) &&
      !p.quests[`objective:${q.id}:${id}`],
  );
}
