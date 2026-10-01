export function mountBrandActions(root: HTMLElement, social = false) {
  const address = (import.meta.env.VITE_WOP_CA ?? "").trim();
  root.innerHTML = `${social ? '<a class="brand-social" href="https://x.com/Play_WoP" target="_blank" rel="noopener noreferrer" aria-label="Follow World of Pokémon on X (opens in a new tab)">Follow on X</a>' : ""}<div class="brand-contract"><button type="button" class="brand-ca" data-copy-wop disabled>COPY $WOP CA</button><span class="brand-copy-status" role="status"></span></div>`;
  const button = root.querySelector<HTMLButtonElement>("[data-copy-wop]")!;
  const status = root.querySelector<HTMLElement>(".brand-copy-status")!;
  button.disabled = !address;
  button.title = address || "Contract address coming soon";
  status.textContent = address ? "Solana contract address" : "CA coming soon";
  button.addEventListener("click", async () => {
    if (!address) return;
    button.disabled = true;
    try {
      await navigator.clipboard.writeText(address);
      status.textContent = "$WOP CA copied";
    } catch {
      status.textContent = `Copy manually: ${address}`;
    } finally {
      button.disabled = false;
    }
  });
}
