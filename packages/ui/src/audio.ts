/**
 * Music and UI sounds. Music loops and crossfades between scenes; a scene that names
 * the same file as the previous one just keeps playing. Browsers only allow sound after
 * the player has tapped something, which the title screen takes care of.
 */
const MUTE_KEY = "sg:muted";
const MUSIC_VOLUME = 0.5;
const FADE_MS = 800;

export class SoundBoard {
  private music: HTMLAudioElement | null = null;
  private musicUrl: string | undefined;
  private _muted = readMuted();
  private listeners = new Set<() => void>();

  get muted() {
    return this._muted;
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.music) this.music.muted = muted;
    this.listeners.forEach((l) => l());
  }

  subscribe(l: () => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  setMusic(url: string | undefined) {
    if (url === this.musicUrl) return;
    this.musicUrl = url;
    const old = this.music;
    if (old) fade(old, old.volume, 0, () => old.pause());
    this.music = null;
    if (!url) return;
    const next = new Audio(url);
    next.loop = true;
    next.volume = 0;
    next.muted = this._muted;
    this.music = next;
    next.play().then(() => fade(next, 0, MUSIC_VOLUME)).catch(() => {
      /* autoplay blocked or file missing: stay silent */
    });
  }

  play(url: string | undefined) {
    if (!url || this._muted) return;
    const a = new Audio(url);
    a.volume = 0.8;
    a.play().catch(() => {});
  }

  stop() {
    this.setMusic(undefined);
  }
}

function fade(a: HTMLAudioElement, from: number, to: number, done?: () => void) {
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / FADE_MS);
    a.volume = from + (to - from) * t;
    if (t < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}
