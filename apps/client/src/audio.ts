import { ABILITIES } from "../../../packages/shared/data";
import type { Biome, GameEvent } from "../../../packages/shared/types";

export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private effects?: GainNode;
  private timer?: number;
  private step = 0;
  private biome: Biome = "town";
  private settings = { master: 0.5, music: 0.25, effects: 0.65, mute: false };

  async start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.music = this.context.createGain();
      this.effects = this.context.createGain();
      this.master.connect(this.context.destination);
      this.music.connect(this.master);
      this.effects.connect(this.master);
      this.apply();
      this.timer = window.setInterval(() => this.ambience(), 1800);
      this.ambience();
    }
    await this.context.resume();
  }

  configure(settings: Partial<typeof this.settings>) {
    Object.assign(this.settings, settings);
    this.apply();
  }

  private apply() {
    if (!this.master || !this.music || !this.effects) return;
    this.master.gain.value = this.settings.mute ? 0 : this.settings.master;
    this.music.gain.value = this.settings.music;
    this.effects.gain.value = this.settings.effects;
  }

  private tone(
    frequency: number,
    duration: number,
    volume: number,
    music = false,
    delay = 0,
  ) {
    if (!this.context || !this.music || !this.effects) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const time = this.context.currentTime + delay;
    oscillator.type = music ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, time);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + 0.035);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(music ? this.music : this.effects);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }

  setBiome(biome: Biome) {
    if (biome === this.biome) return;
    this.biome = biome;
    this.step = 0;
  }

  private ambience() {
    const melodies: Partial<Record<Biome, number[]>> = {
      town: [196, 246.94, 293.66, 369.99, 329.63, 293.66, 246.94, 220],
      meadow: [261.63, 329.63, 392, 440, 392, 329.63, 293.66, 329.63],
      forest: [220, 261.63, 329.63, 493.88, 440, 329.63, 293.66, 261.63],
      ruins: [146.83, 220, 293.66, 329.63, 293.66, 220, 196, 164.81],
    };
    const notes = melodies[this.biome] ?? melodies.forest!;
    this.tone(notes[this.step++ % notes.length], 3.5, 0.065, true);
    this.tone(notes[0] / 2, 3.2, 0.03, true);
    if (this.step % 4 === 0 && this.biome !== "town") {
      const call =
        this.biome === "ruins"
          ? [530, 470, 360]
          : this.biome === "forest"
            ? [1174, 1568, 1318]
            : [1318, 1568];
      call.forEach((frequency, index) =>
        this.tone(frequency, 0.18, 0.018, false, index * 0.2),
      );
    }
  }

  playAbility(id?: string, incoming = false) {
    const ability = ABILITIES[id ?? ""];
    if (ability?.effect === "heal") {
      [330, 440, 660].forEach((note, i) =>
        this.tone(note, 0.5, 0.08, false, i * 0.1),
      );
      return;
    }
    if (ability?.effect === "guard") {
      this.tone(220, 0.65, 0.12);
      this.tone(440, 0.5, 0.07, false, 0.1);
      return;
    }
    if (incoming) return;
    const melee = (ability?.range ?? 0) > 0 && ability!.range <= 5;
    this.noise(melee ? 0.15 : 0.28, melee ? 2800 : 1200, 0.055, true);
    if (!melee) this.tone(ability?.element === "flame" ? 150 : 520, 0.3, 0.045);
  }

  /** Sounds when a combat event arrives; landing hits use playImpact. */
  playCombat(event: GameEvent, self: string) {
    const ability = ABILITIES[event.ability ?? ""];
    switch (event.type) {
      case "cast":
        if (event.source === self) this.playAbility(event.ability);
        break;
      case "attack":
        if (
          event.source === self &&
          ["heal", "guard", "evasion"].includes(ability?.effect ?? "")
        )
          this.playAbility(event.ability);
        break;
      case "dash":
        this.noise(0.22, 1800, 0.05, true);
        break;
      case "interrupt":
        [988, 740, 494].forEach((note, i) =>
          this.tone(note, 0.12, 0.06, false, i * 0.05),
        );
        this.noise(0.18, 3200, 0.05);
        break;
      case "aggro":
        if (event.target === self) {
          this.tone(98, 0.3, 0.09);
          this.tone(147, 0.22, 0.05, false, 0.04);
        }
        break;
      case "shatter":
        [2093, 2637, 3136].forEach((note, i) =>
          this.tone(note, 0.18, 0.035, false, i * 0.03),
        );
        break;
      case "cast-cancel":
        if (event.source === self) this.tone(140, 0.25, 0.06);
        break;
    }
  }

  playImpact(event: GameEvent, self?: string) {
    const outcome = event.outcome ?? "hit";
    const incoming = event.target === self && event.source !== self;
    if (outcome === "parry" || outcome === "block") {
      this.tone(1245, 0.09, 0.05);
      this.tone(1865, 0.12, 0.03, false, 0.015);
      if (outcome === "parry") return;
    }
    if (!["hit", "crit", "block"].includes(outcome)) {
      this.noise(0.16, 2400, 0.035, true);
      return;
    }
    const ability = ABILITIES[event.ability ?? ""];
    const crit = outcome === "crit";
    const heavy =
      crit ||
      ["crush", "cleave", "meteor", "execute", "whirlwind"].includes(
        event.ability ?? "",
      );
    const light = event.auto && !crit;
    this.noise(
      heavy ? 0.3 : light ? 0.1 : 0.15,
      ability?.element === "tide" ? 4200 : incoming ? 700 : 950,
      (incoming ? 0.13 : 0.11) * (light ? 0.7 : 1),
    );
    this.tone(heavy ? 58 : 105, heavy ? 0.28 : 0.13, light ? 0.08 : 0.12);
    if (crit) this.tone(1480, 0.16, 0.04, false, 0.02);
    else if (!ability || ability.range <= 5)
      this.tone(740, 0.08, light ? 0.02 : 0.035);
  }

  private noise(
    duration: number,
    frequency: number,
    volume: number,
    rising = false,
  ) {
    const context = this.context;
    if (!context || !this.effects) return;
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      gain = context.createGain();
    source.buffer = buffer;
    filter.type = rising ? "bandpass" : "lowpass";
    const start = context.currentTime;
    filter.frequency.setValueAtTime(frequency, start);
    filter.frequency.exponentialRampToValueAtTime(
      rising ? frequency * 0.25 : 90,
      start + duration,
    );
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effects);
    source.start(start);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  play(kind = "ui") {
    if (kind === "attack" || kind === "damage") {
      this.tone(160, 0.2, 0.15);
      this.tone(80, 0.28, 0.1, false, 0.05);
    } else if (
      ["capture", "reward", "evolve", "quest", "starter"].includes(kind)
    ) {
      [392, 493.88, 587.33, 783.99].forEach((note, i) =>
        this.tone(note, 0.6, 0.12, false, i * 0.12),
      );
    } else if (kind === "level") {
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((note, i) =>
        this.tone(note, 0.9, 0.1, false, i * 0.09),
      );
      this.tone(196, 1.4, 0.06, false, 0.1);
    } else if (kind === "step") this.noise(0.055, 380, 0.022);
    else if (kind === "error") this.tone(180, 0.25, 0.07);
    else this.tone(660, 0.13, 0.045);
  }

  dispose() {
    clearInterval(this.timer);
    void this.context?.close();
  }
}
