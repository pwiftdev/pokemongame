import { DEFAULT_APPEARANCE } from "../../../packages/shared/appearance";
import { CLASS_IDS, type ClassId } from "../../../packages/shared/classes";
import { mountCharacterCreator } from "./ui/character-creator";
import "./style.css";
import "./interface.css";
const host = document.querySelector<HTMLElement>("#studio")!;
const creator = mountCharacterCreator(host, {
  appearance: DEFAULT_APPEARANCE,
  classId: "knight",
  nickname: "Your adventurer",
  onChange: () => {},
});
host.querySelector(".creator-footer")!.innerHTML =
  '<p>Preview your adventurer. Create and save your character in the game.</p><a class="primary" href="/">Enter the world</a>';
host.addEventListener("click", (event) => {
  const action = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-action]",
  )?.dataset.action;
  const id = action?.split(":")[1] as ClassId;
  if (CLASS_IDS.includes(id)) creator.setClass(id);
});
window.addEventListener("pagehide", () => creator.dispose(), { once: true });

Object.defineProperty(window, "__characterStudioMetrics", {
  get: () => creator.metrics,
});
