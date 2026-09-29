/** One shared hover tooltip for any element with a data-tooltip key. */
export function installTooltips(
  root: HTMLElement,
  render: (key: string) => string,
) {
  const tip = document.createElement("div");
  tip.className = "game-tooltip hidden";
  tip.setAttribute("role", "tooltip");
  root.append(tip);
  let anchor: HTMLElement | null = null;
  const place = () => {
    if (!anchor) return;
    const box = anchor.getBoundingClientRect(),
      size = tip.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(
        innerWidth - size.width - 8,
        box.left + box.width / 2 - size.width / 2,
      ),
    );
    const above = box.top - size.height - 10;
    tip.style.left = `${left}px`;
    tip.style.top = `${above > 8 ? above : box.bottom + 10}px`;
  };
  const hide = () => {
    anchor = null;
    tip.classList.add("hidden");
  };
  root.addEventListener("pointerover", (event) => {
    const next = (event.target as Element).closest<HTMLElement>(
      "[data-tooltip]",
    );
    if (next === anchor) return;
    if (!next) return hide();
    const markup = render(next.dataset.tooltip!);
    if (!markup) return hide();
    anchor = next;
    tip.innerHTML = markup;
    tip.classList.remove("hidden");
    place();
  });
  root.addEventListener("pointerleave", hide);
  return {
    /** Re-render the open tooltip, for example when a slot unlocks. */
    refresh() {
      if (!anchor) return;
      if (!anchor.isConnected) return hide();
      tip.innerHTML = render(anchor.dataset.tooltip!);
      place();
    },
    hide,
  };
}
