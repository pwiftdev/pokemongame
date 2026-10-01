export const ASSET_GROUPS = [
  "engine",
  "world",
  "pokemon",
  "characters",
  "interface",
] as const;
export type AssetGroup = (typeof ASSET_GROUPS)[number];
export type AssetTask = {
  id: string;
  group: AssetGroup;
  label: string;
  state: "loading" | "ready" | "failed";
};
export function createStartupProgress() {
  const tasks = new Map<string, AssetTask>();
  const listeners = new Set<() => void>();
  let active = false;
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    get active() {
      return active;
    },
    get tasks() {
      return [...tasks.values()];
    },
    begin() {
      tasks.clear();
      active = true;
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async track<T>(
      id: string,
      group: AssetGroup,
      label: string,
      work: () => Promise<T>,
    ): Promise<T> {
      if (!active) return work();
      const task: AssetTask = { id, group, label, state: "loading" };
      tasks.set(id, task);
      notify();
      try {
        const value = await work();
        task.state = "ready";
        notify();
        return value;
      } catch (error) {
        task.state = "failed";
        notify();
        throw error;
      }
    },
    finish() {
      if ([...tasks.values()].some((task) => task.state !== "ready"))
        throw new Error("The island is still loading.");
      active = false;
      notify();
    },
  };
}
export const startup = createStartupProgress();
export function modelGroup(url: string): AssetGroup {
  if (/\/(pokemon|monsters)\//.test(url)) return "pokemon";
  if (/\/(characters|heroes|trainers)\//.test(url)) return "characters";
  return "world";
}
