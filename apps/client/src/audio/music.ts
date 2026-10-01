import { audioUrl } from "./catalog";
interface Deck {
  id: string;
  media: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  cancel?: () => void;
  destroyed?: boolean;
}
export class MusicPlayer {
  private current?: Deck;
  private retiring?: Deck;
  private pending?: Deck;
  private enabled = false;
  private desired = "town";
  private retryAt = 0;
  private generation = 0;
  private disposed = false;
  private retirement?: ReturnType<typeof setTimeout>;
  constructor(
    private context: AudioContext,
    private output: AudioNode,
  ) {}
  update(id: string, enabled: boolean) {
    if (this.disposed) return;
    this.desired = id;
    this.enabled = enabled;
    if (!enabled) {
      this.generation++;
      this.discardPending();
      this.discardRetiring();
      this.current?.media.pause();
      return;
    }
    if (this.current?.id === id) {
      if (this.pending && this.pending.id !== id) {
        this.generation++;
        this.discardPending();
      }
      if (this.current.media.paused && Date.now() >= this.retryAt)
        void this.resume(this.current);
      return;
    }
    if (this.pending?.id === id || Date.now() < this.retryAt) return;
    void this.transition(id);
  }
  private async transition(id: string) {
    const version = ++this.generation;
    this.discardPending();
    this.discardRetiring();
    let deck: Deck | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      deck = this.createDeck(id);
      this.pending = deck;
      const { media, gain } = deck;
      const candidate = deck;
      media.ontimeupdate = () => {
        if (
          this.enabled &&
          this.current === candidate &&
          !this.pending &&
          media.duration > 8 &&
          media.duration - media.currentTime < 2.5 &&
          Date.now() >= this.retryAt
        )
          void this.transition(this.desired);
      };
      await Promise.race([
        media.play(),
        new Promise<never>((_, reject) => {
          candidate.cancel = () => reject(new Error("Music load cancelled"));
          timeout = setTimeout(
            () => reject(new Error("Music load timeout")),
            10000,
          );
        }),
      ]);
      if (this.disposed || version !== this.generation || !this.enabled) {
        this.destroy(deck);
        return;
      }
      this.pending = undefined;
      this.retiring = this.current;
      if (this.retiring) {
        this.retiring.gain.gain.cancelScheduledValues(this.context.currentTime);
        this.retiring.gain.gain.setTargetAtTime(
          0,
          this.context.currentTime,
          0.65,
        );
        const old = this.retiring;
        this.retirement = setTimeout(() => {
          this.destroy(old);
          if (this.retiring === old) this.retiring = undefined;
        }, 2500);
      }
      this.current = deck;
      gain.gain.setTargetAtTime(0.85, this.context.currentTime, 0.75);
    } catch {
      if (deck) this.destroy(deck);
      if (this.pending === deck) this.pending = undefined;
      if (!this.disposed && version === this.generation)
        this.retryAt = Date.now() + 15000;
    } finally {
      clearTimeout(timeout);
      if (deck) deck.cancel = undefined;
    }
  }
  private async resume(deck: Deck) {
    try {
      await deck.media.play();
    } catch {
      if (!this.disposed && this.current === deck)
        this.retryAt = Date.now() + 15000;
    }
  }
  private createDeck(id: string): Deck {
    const media = new Audio(audioUrl(`music-${id}`));
    let source: MediaElementAudioSourceNode | undefined;
    let gain: GainNode | undefined;
    try {
      media.preload = "none";
      media.loop = true;
      source = this.context.createMediaElementSource(media);
      gain = this.context.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(this.output);
      return { id, media, source, gain };
    } catch (error) {
      media.pause();
      media.removeAttribute("src");
      media.load();
      source?.disconnect();
      gain?.disconnect();
      throw error;
    }
  }
  private discardPending() {
    if (this.pending) this.destroy(this.pending);
    this.pending = undefined;
  }
  private discardRetiring() {
    clearTimeout(this.retirement);
    if (this.retiring) this.destroy(this.retiring);
    this.retiring = undefined;
  }
  private destroy(deck: Deck) {
    if (deck.destroyed) return;
    deck.destroyed = true;
    deck.cancel?.();
    deck.media.ontimeupdate = null;
    deck.media.pause();
    deck.media.removeAttribute("src");
    deck.media.load();
    deck.source.disconnect();
    deck.gain.disconnect();
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.discardPending();
    this.discardRetiring();
    if (this.current) this.destroy(this.current);
    this.current = undefined;
  }
  get metrics() {
    return {
      track: this.current?.id,
      streams: [this.current, this.retiring, this.pending].filter(Boolean)
        .length,
    };
  }
}
