import { AudioBuffers } from "./buffers";
import { MusicPlayer } from "./music";
import {
  audioDefaults,
  cues,
  normalizeAudio,
  spatialMix,
  type AudioBus,
  type AudioSettings,
  type CueId,
  type Point,
} from "./catalog";
interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
  priority: number;
}
export interface AmbientLayer {
  id: string;
  volume: number;
  point?: Point;
  radius?: number;
}
export class AudioMixer {
  readonly buffers: AudioBuffers;
  private master: GainNode;
  private compressor: DynamicsCompressorNode;
  private buses = {} as Record<AudioBus, GainNode>;
  private music: MusicPlayer;
  private settings = { ...audioDefaults };
  private voices = new Set<Voice>();
  private loops = new Map<string, Voice>();
  private loadingLoops = new Set<string>();
  private layers = new Map<string, AmbientLayer>();
  private last = new Map<string, number>();
  private choices = new Map<string, number>();
  private retiringLoops = new Set<Voice>();
  private epoch = 0;
  private active = true;
  private disposed = false;
  private duckUntil = 0;
  private played = {} as Partial<Record<CueId, number>>;
  private listener: Point = { x: 0, z: -32 };
  private alpha = -Math.PI / 2;
  constructor(readonly context: AudioContext) {
    this.buffers = new AudioBuffers(context);
    this.master = context.createGain();
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -10;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.18;
    this.master.connect(this.compressor);
    this.compressor.connect(context.destination);
    for (const bus of [
      "music",
      "ambience",
      "effects",
      "interface",
      "creatures",
    ] as const) {
      this.buses[bus] = context.createGain();
      this.buses[bus].connect(this.master);
    }
    this.music = new MusicPlayer(context, this.buses.music);
    this.configure(this.settings);
  }
  configure(settings: Partial<AudioSettings>) {
    this.settings = normalizeAudio({ ...this.settings, ...settings });
    this.volumes();
  }
  private volumes() {
    const now = this.context.currentTime,
      duck = now < this.duckUntil;
    this.master.gain.setTargetAtTime(
      this.settings.mute ? 0 : this.settings.master,
      now,
      0.03,
    );
    for (const bus of Object.keys(this.buses) as AudioBus[])
      this.buses[bus].gain.setTargetAtTime(
        this.settings[bus] *
          (duck && bus === "music"
            ? 0.45
            : duck && bus === "ambience"
              ? 0.7
              : 1),
        now,
        0.15,
      );
  }
  setListener(point: Point, alpha: number) {
    this.listener = { ...point };
    this.alpha = alpha;
  }
  duck(seconds = 1.5) {
    this.duckUntil = Math.max(
      this.duckUntil,
      this.context.currentTime + seconds,
    );
  }
  setActive(active: boolean) {
    if (active === this.active || this.disposed) return;
    this.active = active;
    this.epoch++;
    if (!active) {
      for (const voice of this.voices) this.stop(voice);
      this.voices.clear();
      this.music.update("town", false);
      void this.context.suspend().catch(() => {});
    } else void this.context.resume().catch(() => {});
  }
  async play(id: CueId, point?: Point, volume = 1, pitch = 1) {
    const cue = cues[id];
    if (
      !this.active ||
      this.disposed ||
      this.settings.mute ||
      this.settings.master === 0 ||
      this.settings[cue.bus] === 0
    )
      return;
    const mix = spatialMix(this.listener, point, this.alpha);
    if (mix.volume < 0.015) return;
    const now = performance.now();
    const key = `${id}:${point ? "world" : "local"}`;
    if (now - (this.last.get(key) ?? -Infinity) < cue.interval * 1000) return;
    this.last.set(key, now);
    const previous = this.choices.get(id) ?? -1;
    const choice =
      cue.files.length < 2
        ? 0
        : (previous + 1 + Math.floor(Math.random() * (cue.files.length - 1))) %
          cue.files.length;
    this.choices.set(id, choice);
    const epoch = this.epoch;
    try {
      const buffer = await this.buffers.get(cue.files[choice]);
      if (
        this.disposed ||
        epoch !== this.epoch ||
        !this.active ||
        this.settings.mute ||
        this.settings[cue.bus] === 0 ||
        performance.now() - now > (cue.priority >= 4 ? 1200 : 250)
      )
        return;
      const priority = cue.priority + (mix.volume > 0.8 ? 1 : 0);
      if (this.voices.size >= 24) {
        const oldest = [...this.voices].find(
          (voice) => voice.priority < priority,
        );
        if (!oldest) return;
        this.stop(oldest);
        this.voices.delete(oldest);
      }
      const voice = this.voice(buffer, cue.bus, priority);
      voice.gain.gain.value = cue.volume * volume * mix.volume;
      voice.pan.pan.value = mix.pan;
      voice.source.playbackRate.value =
        pitch * (cue.bus === "interface" ? 1 : 0.96 + Math.random() * 0.08);
      this.voices.add(voice);
      this.played[id] = (this.played[id] ?? 0) + 1;
      voice.source.onended = () => {
        this.disconnect(voice);
        this.voices.delete(voice);
      };
      voice.source.start();
    } catch {}
  }
  update(track: string, layers: AmbientLayer[]) {
    if (this.disposed) return;
    this.volumes();
    const audible =
      this.active && !this.settings.mute && this.settings.master > 0;
    this.music.update(track, audible && this.settings.music > 0);
    this.layers = new Map(
      (audible && this.settings.ambience > 0 ? layers.slice(0, 8) : []).map(
        (layer) => [layer.id, layer],
      ),
    );
    for (const [id, voice] of this.loops)
      if (!this.layers.has(id)) {
        this.loops.delete(id);
        this.retiringLoops.add(voice);
        voice.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.15);
        voice.source.stop(this.context.currentTime + 0.65);
      }
    for (const layer of this.layers.values()) {
      const voice = this.loops.get(layer.id);
      if (voice) this.positionLoop(voice, layer);
      else if (
        this.loops.size + this.retiringLoops.size < 10 &&
        !this.loadingLoops.has(layer.id)
      )
        void this.loadLoop(layer.id);
    }
  }
  private async loadLoop(id: string) {
    this.loadingLoops.add(id);
    try {
      const buffer = await this.buffers.get(`ambient-${id}`);
      const layer = this.layers.get(id);
      if (
        !layer ||
        this.disposed ||
        !this.active ||
        this.loops.size + this.retiringLoops.size >= 10
      )
        return;
      const voice = this.voice(buffer, "ambience", 0);
      voice.source.loop = true;
      voice.gain.gain.value = 0;
      voice.source.onended = () => {
        this.retiringLoops.delete(voice);
        this.disconnect(voice);
      };
      this.loops.set(id, voice);
      this.positionLoop(voice, layer);
      voice.source.start(
        0,
        Math.random() * Math.max(0.01, buffer.duration - 0.1),
      );
    } catch {
    } finally {
      this.loadingLoops.delete(id);
    }
  }
  private positionLoop(voice: Voice, layer: AmbientLayer) {
    const mix = spatialMix(
      this.listener,
      layer.point,
      this.alpha,
      layer.radius,
    );
    voice.gain.gain.setTargetAtTime(
      layer.volume * mix.volume,
      this.context.currentTime,
      0.6,
    );
    voice.pan.pan.setTargetAtTime(mix.pan, this.context.currentTime, 0.3);
  }
  private voice(buffer: AudioBuffer, bus: AudioBus, priority: number): Voice {
    const source = this.context.createBufferSource(),
      gain = this.context.createGain(),
      pan = this.context.createStereoPanner();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(pan);
    pan.connect(this.buses[bus]);
    return { source, gain, pan, priority };
  }
  private disconnect(voice: Voice) {
    voice.source.disconnect();
    voice.gain.disconnect();
    voice.pan.disconnect();
  }
  private stop(voice: Voice) {
    try {
      voice.source.stop();
    } catch {}
    this.disconnect(voice);
  }
  dispose() {
    this.disposed = true;
    this.epoch++;
    this.music.dispose();
    this.buffers.dispose();
    for (const voice of [
      ...this.voices,
      ...this.loops.values(),
      ...this.retiringLoops,
    ])
      this.stop(voice);
    this.voices.clear();
    this.loops.clear();
    this.layers.clear();
    this.retiringLoops.clear();
    for (const bus of Object.values(this.buses)) bus.disconnect();
    this.master.disconnect();
    this.compressor.disconnect();
    void this.context.close().catch(() => {});
  }
  get metrics() {
    return {
      ...this.buffers.metrics,
      ...this.music.metrics,
      state: this.context.state,
      voices: this.voices.size,
      loops: this.loops.size,
      retiringLoops: this.retiringLoops.size,
      levels: Object.fromEntries(
        Object.entries(this.buses).map(([id, node]) => [id, node.gain.value]),
      ),
      played: { ...this.played },
    };
  }
}
