import { ABILITIES } from "../../../../packages/shared/data";
import type { GameEvent } from "../../../../packages/shared/types";
import { escape as esc } from "./icons";

export interface LogContext {
  selfId: string;
  /** Display name of a creature or player. */
  name: (id?: string) => string;
  companion: string;
}
const capitalize = (text: string) => text[0]?.toUpperCase() + text.slice(1);
const avoidance: Record<string, string> = {
  miss: "misses",
  dodge: "is dodged by",
  parry: "is parried by",
  evade: "is evaded by",
  immune: "fails against",
};

/** One readable line for a combat event that involves you, or undefined. */
export function describeEvent(
  event: GameEvent,
  ctx: LogContext,
): [text: string, kind: string] | undefined {
  const me = ctx.selfId,
    { source, target } = event,
    amount = event.amount ?? 0,
    outcome = event.outcome ?? "hit";
  const who = (id?: string) => (id === me ? "you" : ctx.name(id));
  const verb = outcome === "crit" ? "crits" : "hits";
  const extra =
    outcome === "block" ? " (partly blocked)" : outcome === "crit" ? "!" : ".";
  const abilityName = ABILITIES[event.ability ?? ""]?.name;
  switch (event.type) {
    case "swing":
    case "impact": {
      if (source !== me) return;
      const what =
        event.type === "swing"
          ? `Your ${event.message}`
          : `Your ${abilityName ?? "attack"}`;
      if (avoidance[outcome])
        return [`${what} ${avoidance[outcome]} ${who(target)}.`, "avoid"];
      return [
        `${what} ${verb} ${who(target)} for ${amount}${extra}`,
        event.type === "swing" ? "out-auto" : "out",
      ];
    }
    case "attack": {
      if (source !== me) return;
      if (event.heal && amount)
        return [`Your ${abilityName} heals you for ${amount}.`, "heal"];
      if (event.actor === "companion" && amount)
        return [
          `${ctx.companion}'s ${abilityName ?? "attack"} ${verb} ${who(target)} for ${amount}${extra}`,
          "pet",
        ];
      return;
    }
    case "hit": {
      if (target !== me) return;
      const attack = event.message.split(" · ")[0];
      if (avoidance[outcome])
        return [`${capitalize(attack)} ${avoidance[outcome]} you.`, "avoid"];
      return [`${capitalize(attack)} ${verb} you for ${amount}${extra}`, "in"];
    }
    case "dot":
      if (source !== me && target !== me) return;
      return [
        `${capitalize(who(target))} ${target === me ? "suffer" : "suffers"} ${amount} damage from ${source === me ? "your" : `${ctx.name(source)}'s`} ${abilityName ?? event.message}.`,
        target === me ? "in" : "out",
      ];
    case "interrupt":
      if (source !== me) return;
      return [
        `You interrupt ${ctx.name(target)}: ${event.message.replace("Interrupted ", "")}.`,
        "interrupt",
      ];
    case "aggro":
      if (target !== me) return;
      return [`${ctx.name(source)} attacks you!`, "warn"];
    case "heal":
      return [
        `${ctx.name(source)} casts ${event.message}, healing ${amount}.`,
        "enemy-heal",
      ];
    case "defeat":
      return target === me
        ? ["You have been defeated.", "warn"]
        : [`${ctx.name(target)} dies.`, "death"];
    case "reward":
      return [event.message, "reward"];
    case "boss-telegraph":
    case "boss-phase":
      return [event.message, "warn"];
    case "cast-cancel":
      return source === me
        ? ["Your cast was interrupted.", "avoid"]
        : undefined;
  }
  return undefined;
}

export function createCombatLog(root: HTMLElement) {
  const lines: string[] = [];
  let fade = 0;
  function render() {
    root.innerHTML = lines.join("");
    root.scrollTop = root.scrollHeight;
    root.classList.add("active");
    window.clearTimeout(fade);
    fade = window.setTimeout(() => root.classList.remove("active"), 9000);
  }
  return {
    record(event: GameEvent, ctx: LogContext) {
      const line = describeEvent(event, ctx);
      if (!line) return;
      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      lines.push(
        `<p class="${line[1]}"><time>${time}</time>${esc(line[0])}</p>`,
      );
      if (lines.length > 60) lines.shift();
      render();
    },
  };
}
