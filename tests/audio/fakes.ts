import { vi } from "vitest";
export const parameter = () => ({
  value: 0,
  setTargetAtTime(value: number) {
    this.value = value;
  },
  cancelScheduledValues() {},
});
export class Node {
  gain = parameter();
  pan = parameter();
  playbackRate = { value: 1 };
  threshold = parameter();
  knee = parameter();
  ratio = parameter();
  attack = parameter();
  release = parameter();
  buffer: AudioBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn(() => this.onended?.());
}
export class Context {
  state = "running";
  currentTime = 0;
  destination = new Node();
  sources: Node[] = [];
  createGain = () => new Node();
  createStereoPanner = () => new Node();
  createDynamicsCompressor = () => new Node();
  createMediaElementSource = () => new Node();
  createBufferSource = () => {
    const node = new Node();
    this.sources.push(node);
    return node;
  };
  decodeAudioData = vi.fn(async () => buffer());
  suspend = vi.fn(async () => {
    this.state = "suspended";
  });
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
  asAudio() {
    return this as unknown as AudioContext;
  }
}
export const buffer = (length = 100) =>
  ({ length, numberOfChannels: 1, duration: 1 }) as AudioBuffer;
export class Media {
  static instances: Media[] = [];
  preload = "";
  loop = false;
  paused = true;
  duration = 100;
  currentTime = 0;
  ontimeupdate: (() => void) | null = null;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  removeAttribute = vi.fn();
  load = vi.fn();
  constructor(readonly src: string) {
    Media.instances.push(this);
  }
}
export function setupAudio() {
  vi.stubGlobal("Audio", Media);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4),
    })),
  );
  Media.instances = [];
}
