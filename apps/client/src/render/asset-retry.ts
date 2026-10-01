export async function retryAsset<T>(
  load: () => Promise<T>,
  signal: AbortSignal,
  delays = [500, 1500, 4000],
) {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await load();
    } catch (error) {
      if (attempt >= delays.length || signal.aborted) throw error;
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(signal.reason);
        };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", abort);
          resolve();
        }, delays[attempt]);
        signal.addEventListener("abort", abort, { once: true });
      });
    }
  }
}
