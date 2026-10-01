import { duelReach } from "../../../../packages/shared/duel-rules";
import { BIOMES } from "../../../../packages/shared/data";
import { biomeAt, distance } from "../../../../packages/shared/rules";
import { POKEMON } from "../../../../packages/shared/pokemon";
import type { PlayerView } from "../../../../packages/shared/types";
import { escape as esc } from "./icons";

export function invitedIsland(search: string) {
  const code = new URLSearchParams(search).get("island") ?? "";
  return /^[A-Za-z0-9_-]{1,24}$/.test(code) ? code : "";
}
export function islandInvite(origin: string, room: string) {
  const url = new URL("/", origin);
  url.searchParams.set("island", room);
  return url.toString();
}
export function explorerRows(players: PlayerView[], selfId: string) {
  const self = players.find((p) => p.id === selfId);
  return [...players]
    .sort(
      (a, b) =>
        Number(b.id === selfId) - Number(a.id === selfId) ||
        a.nickname.localeCompare(b.nickname),
    )
    .map((p) => {
      const status =
        p.hp <= 0
          ? "Needs healing"
          : p.duelId
            ? "Dueling"
            : p.inCombat
              ? "In combat"
              : "Exploring";
      return `<article class="explorer-row" data-explorer="${esc(p.id)}"><div><strong>${esc(p.nickname)}${p.id === selfId ? " · You" : ""}</strong><small>${esc(BIOMES[biomeAt(p.x, p.z)].name)} · ${self && p.id !== selfId ? `${Math.round(distance(self, p))}m away · ` : ""}${status}</small><small>${esc(p.companionName || POKEMON[p.companion ?? ""]?.name || "No companion")} · Level ${p.companionLevel}</small></div><div><span>${Math.ceil(p.hp)} / ${p.maxHp} HP</span><progress aria-label="${esc(p.nickname)} health" value="${Math.max(0, p.hp)}" max="${Math.max(1, p.maxHp)}"></progress>${p.id !== selfId ? `<button class="secondary compact" data-action="duel:${esc(p.id)}" ${!self || self.duelId || p.duelId || self.inCombat || p.inCombat || self.hp <= 0 || p.hp <= 0 || duelReach(self, p) ? "disabled" : ""}>Challenge</button>` : ""}</div></article>`;
    })
    .join("");
}
export function explorersPanel(
  players: PlayerView[],
  selfId: string,
  room: string,
) {
  return `<div class="expedition-invite"><h3>Adventure together</h3><p>Send a friend your invitation link, or share island code <strong>${esc(room)}</strong>.</p><div><button class="primary" data-action="invite-friend">Copy invitation link</button><button class="secondary" data-action="copy-room">Copy island code</button><button class="secondary" data-action="panel:arena">Duels & training</button><button class="secondary" data-action="panel:map">Find explorers on the map</button></div><p id="invite-fallback" role="status"></p></div><div id="explorer-list">${explorerRows(players, selfId)}</div><p class="subtle">Meet at a waystone before setting out. Help attack the same monster to share encounter rewards. An island invitation does not grant access to anyone’s saved character.</p>`;
}
