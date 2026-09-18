/** Quiet, optional interaction cues synthesized with Web Audio. */
export type SoundCue = "press" | "toggle" | "chime" | "success" | "whoosh";

export interface PlaySoundOptions {
  volume?: number;
  variant?: "high" | "low" | "default";
}

const STORAGE_KEY_ENABLED = "chrondle_sound_enabled";
const CUES: Record<SoundCue, { frequency: number; endFrequency: number; duration: number }> = {
  press: { frequency: 220, endFrequency: 100, duration: 0.05 },
  toggle: { frequency: 520, endFrequency: 760, duration: 0.065 },
  chime: { frequency: 740, endFrequency: 740, duration: 0.18 },
  success: { frequency: 660, endFrequency: 880, duration: 0.22 },
  whoosh: { frequency: 220, endFrequency: 440, duration: 0.1 },
};

function readPreference(fallback = false): boolean {
  try {
    return (
      typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY_ENABLED) === "true"
    );
  } catch {
    return fallback;
  }
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = readPreference();
  private listeners = new Set<() => void>();

  public isEnabled(): boolean {
    return this.enabled;
  }

  private updateEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (this.ctx && this.masterGain && this.ctx.state !== "closed") {
      this.masterGain.gain.setValueAtTime(enabled ? 0.14 : 0, this.ctx.currentTime);
    }
    this.listeners.forEach((listener) => listener());
  }

  public setEnabled(enabled: boolean) {
    try {
      window.localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
    } catch {
      // The current page still remembers the choice when storage is unavailable.
    }
    this.updateEnabled(enabled);
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    if (this.enabled) this.play("toggle", { variant: "high" });
    return this.enabled;
  }

  private handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY_ENABLED && event.key !== null) return;
    try {
      if (event.storageArea !== window.localStorage) return;
    } catch {
      return;
    }
    this.updateEnabled(readPreference(this.enabled));
  };

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    if (this.listeners.size === 1 && typeof window !== "undefined") {
      window.addEventListener("storage", this.handleStorage);
      this.updateEnabled(readPreference(this.enabled));
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && typeof window !== "undefined") {
        window.removeEventListener("storage", this.handleStorage);
      }
    };
  }

  public play(cue: SoundCue, options?: PlaySoundOptions) {
    if (!this.enabled || typeof window === "undefined") return;

    try {
      if (!this.ctx || this.ctx.state === "closed") {
        const AudioContextClass = window.AudioContext;
        if (!AudioContextClass) return;
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.14, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }

      const ctx = this.ctx;
      if (ctx.state !== "running") {
        // Do not queue a cue that could arrive long after its interaction.
        void ctx.resume().catch(() => {});
        return;
      }
      if (!this.masterGain) return;

      const { frequency, endFrequency, duration } = CUES[cue];
      const pitch = options?.variant === "high" ? 1.15 : options?.variant === "low" ? 0.85 : 1;
      const volume = Math.max(0, Math.min(1, options?.volume ?? 1));
      if (!Number.isFinite(volume) || volume === 0) return;
      const start = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency * pitch, start);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency * pitch, start + duration);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(volume, start + 0.004);
      envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(envelope);
      envelope.connect(this.masterGain);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
    } catch {
      // Optional audio must never interrupt the interaction it accompanies.
    }
  }
}

export const sound = new SoundManager();

export function playSound(cue: SoundCue, options?: PlaySoundOptions) {
  sound.play(cue, options);
}
