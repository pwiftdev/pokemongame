import {
  currentQuest,
  questAccepted,
  questProgress,
} from "../../../../packages/shared/story";
import type { Profile } from "../../../../packages/shared/types";

const hints: Record<string, string> = {
  "first-friend":
    "Collect your allowance, then visit the expedition board beside the town road.",
  "story-ranger":
    "Follow the western road. Press E beside Rowan to speak with him.",
  "story-orchard":
    "Tab selects a monster. T starts attacking; 1–6 use your abilities. G sends your companion.",
  "story-satchel":
    "Look beside the orchard fence. Press E by the satchel, then return to Rowan.",
  "story-catch":
    "Select a wild Pokémon. Use bait or weaken it below 75% HP, press H to call your companion back, then F to catch.",
  "story-warden":
    "Return through Hearthwick and take the eastern road to Lanternwood.",
  "story-roots":
    "Watch the marked ground. Move out before an attack lands; Space dodges.",
  "story-wards":
    "Inspect each ward with E. The map marker moves to the next inscription.",
  "story-beacon":
    "Follow the northern road to the beacon. Press E to rekindle it.",
  "story-storm":
    "Heal and prepare supplies first. Invite another explorer; everyone who helps shares the victory.",
};
export function adventureHint(profile: Profile) {
  const quest = currentQuest(profile);
  if (!quest)
    return "Open regional expeditions in your journal for new field studies.";
  if (questProgress(profile, quest) >= quest.goal)
    return quest.giver
      ? "Objective complete. Return to the marked quest giver to collect your reward."
      : hints[quest.id];
  if (!questAccepted(profile, quest))
    return "Visit the marked quest giver and accept this chapter before heading out.";
  return hints[quest.id] ?? quest.description;
}
export function directionLabel(
  from: { x: number; z: number },
  to: { x: number; z: number },
) {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  if (distance < 9) return "Nearby · Approach the marker";
  const index =
    (Math.round(Math.atan2(to.x - from.x, to.z - from.z) / (Math.PI / 4)) + 8) %
    8;
  return `${Math.round(distance)}m ${["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][index]} · Follow the roads`;
}
