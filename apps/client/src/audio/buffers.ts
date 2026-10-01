import { retryAsset } from "../render/asset-retry";
import { audioUrl } from "./catalog";
export class AudioBuffers {
  private cache = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer>>();
  private failures = new Map<string, number>();
  private cancellation = new AbortController();
  private queue: Array<() => void> = [];
  private active = 0;
  bytes = 0;
  constructor(
    private context: BaseAudioContext,
    private budget = 24 * 1024 * 1024,
  ) {}
  get(id: string): Promise<AudioBuffer> {
    const cached = this.cache.get(id);
    if (cached) {
      this.cache.delete(id);
      this.cache.set(id, cached);
      return Promise.resolve(cached);
    }
    const pending = this.pending.get(id);
    if (pending) return pending;
    if (
      this.cancellation.signal.aborted ||
      this.pending.size >= 24 ||
      (this.failures.get(id) ?? 0) > Date.now()
    )
      return Promise.reject(new Error("Audio unavailable"));
    const request = new Promise<void>((resolve) => {
      const begin = () => {
        this.active++;
        resolve();
      };
      if (this.active < 4) begin();
      else this.queue.push(begin);
    })
      .then(() =>
        retryAsset(() => this.read(id), this.cancellation.signal, [250, 1000]),
      )
      .then((buffer) => {
        this.cancellation.signal.throwIfAborted();
        const size = buffer.length * buffer.numberOfChannels * 4;
        while (this.bytes + size > this.budget && this.cache.size) {
          const key = this.cache.keys().next().value!;
          const old = this.cache.get(key)!;
          this.bytes -= old.length * old.numberOfChannels * 4;
          this.cache.delete(key);
        }
        if (size <= this.budget) {
          this.cache.set(id, buffer);
          this.bytes += size;
        }
        return buffer;
      })
      .catch((error) => {
        this.failures.set(id, Date.now() + 15000);
        throw error;
      })
      .finally(() => {
        this.active--;
        this.pending.delete(id);
        this.queue.shift()?.();
      });
    this.pending.set(id, request);
    return request;
  }
  private async read(id: string) {
    const abort = new AbortController();
    const cancel = () => abort.abort();
    const parent = this.cancellation.signal;
    parent.throwIfAborted();
    parent.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(cancel, 8000);
    try {
      const response = await fetch(audioUrl(id), { signal: abort.signal });
      if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 4 * 1024 * 1024)
        throw new Error("Audio sample exceeds budget");
      return await this.context.decodeAudioData(bytes);
    } finally {
      clearTimeout(timer);
      parent.removeEventListener("abort", cancel);
    }
  }
  dispose() {
    this.cancellation.abort();
    this.cache.clear();
    this.failures.clear();
    this.bytes = 0;
  }
  get metrics() {
    return {
      bytes: this.bytes,
      cached: this.cache.size,
      pending: this.pending.size,
    };
  }
}
