import { PLACES } from "../../../../packages/shared/data";
import {
  QUESTS,
  currentQuest,
  questAccepted,
  questDestination,
  questProgress,
  questUnlocked,
} from "../../../../packages/shared/story";
import type { Profile } from "../../../../packages/shared/types";
import { escape as esc } from "./icons";

export function storyTracker(profile: Profile) {
  const q = currentQuest(profile);
  if (!q)
    return '<span class="eyebrow">CHAPTER ONE COMPLETE</span><strong>The wards are singing again.</strong><small>Find regional expeditions at the Hearthwick board.</small>';
  const destination = questDestination(profile, q);
  const ready = questProgress(profile, q) >= q.goal;
  const step = !questAccepted(profile, q)
    ? "Accept quest"
    : ready
      ? "Turn in quest"
      : `${questProgress(profile, q)} / ${q.goal}`;
  return `<span class="eyebrow">THE FADING WARDS · CHAPTER ONE</span><button class="tracked-quest" data-action="panel:quests"><span class="quest-diamond"></span><div><strong>${esc(q.name)}</strong><small>${esc(step)} · ${esc(destination?.name ?? "Open your journal")}</small></div></button><div class="story-direction" id="story-direction"></div>`;
}
export function storyJournal(
  profile: Profile,
  position?: { x: number; z: number },
) {
  const completed = QUESTS.filter(
    (q) => !q.side && profile.claimed.includes(q.id),
  ).length;
  const main = currentQuest(profile);
  const ordered = [...QUESTS].sort((a, b) => {
    const rank = (q: typeof a) =>
      q === main
        ? 0
        : profile.claimed.includes(q.id)
          ? 3
          : questUnlocked(profile, q)
            ? 1
            : 2;
    return rank(a) - rank(b);
  });
  return `<div class="journal-summary"><span>The Fading Wards · ${completed} / 10 chapters</span><p>The orchard has fallen silent. Follow Rowan’s field notes through Lanternwood to the broken seal at Tideglass.</p></div><div class="quest-list">${ordered
    .map((q) => {
      const done = profile.claimed.includes(q.id);
      const unlocked = questUnlocked(profile, q);
      const accepted = questAccepted(profile, q);
      const progress = questProgress(profile, q);
      const ready = accepted && progress >= q.goal;
      const location = PLACES.find(
        (p) => p.id === (ready ? (q.turnIn ?? q.giver) : q.giver),
      );
      const nearby =
        !q.giver ||
        !!(
          location &&
          position &&
          Math.hypot(position.x - location.x, position.z - location.z) <= 9
        );
      const enabled = !done && unlocked && nearby && (!accepted || ready);
      const label = done
        ? "Completed"
        : !unlocked
          ? "Locked"
          : !nearby && (!accepted || ready)
            ? `Visit ${location?.name}`
            : !accepted
              ? "Accept quest"
              : ready
                ? "Complete quest"
                : "In progress";
      const destination = questDestination(profile, q);
      const dialogue =
        unlocked && !done && (q === main || q.side)
          ? `<blockquote class="quest-dialogue"><span>${esc(PLACES.find((p) => p.id === q.giver)?.name ?? "Expedition Captain Iona")}</span>${esc(q.dialogue ?? "Your companion is ready. Collect your allowance, then read the expedition board’s first assignment.")}</blockquote>`
          : "";
      const supplies = Object.entries(q.supplies ?? {})
        .map(
          ([id, count]) =>
            `${count} ${id === "bait" ? "Sweetseed bait" : id === "potion" ? "tonics" : id}`,
        )
        .join(" · ");
      return `<article class="quest-row ${done ? "completed" : ""} ${q === main ? "current-chapter" : ""}"><div class="quest-status">${done ? "✓" : q.side ? "+" : QUESTS.filter((entry) => !entry.side).indexOf(q) + 1}</div><div><span class="eyebrow">${done ? "COMPLETED" : q.side ? "REGIONAL EXPEDITION" : q === main ? "CURRENT CHAPTER" : "NEXT CHAPTER"}</span><h3>${esc(q.name)}</h3>${dialogue}<p>${esc(q.description)}</p><small>${done ? esc(q.completion ?? "Your expedition begins.") : !unlocked ? "Complete the previous chapter to unlock." : `${accepted ? `${progress} / ${q.goal}` : "Not accepted"}${destination ? ` · ${esc(destination.name)}` : ""}`}</small>${supplies ? `<small class="quest-supplies">Field kit on acceptance: ${esc(supplies)}</small>` : ""}</div><div class="quest-reward"><strong>${q.reward} PD</strong><small>${q.xp ?? 0} companion XP</small><button class="${enabled ? "primary" : "secondary"} compact" data-action="${!accepted ? "accept-quest" : "claim"}:${q.id}" ${enabled ? "" : "disabled"}>${esc(label)}</button></div></article>`;
    })
    .join("")}</div>`;
}
