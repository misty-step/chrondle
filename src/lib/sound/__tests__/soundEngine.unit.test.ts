import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "chrondle_sound_enabled";
const createContext = vi.fn();
const scheduleCue = vi.fn();
let contextState: AudioContextState;
const resumeAudio = vi.fn(async () => {
  contextState = "running";
});

class AudioContextStub {
  currentTime = 0;
  destination = {};
  resume = resumeAudio;

  constructor() {
    createContext();
  }

  get state() {
    return contextState;
  }

  createGain() {
    return {
      gain: {
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
      disconnect() {},
    };
  }

  createOscillator() {
    return {
      frequency: {
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
      disconnect() {},
      start: scheduleCue,
      stop() {},
    };
  }
}

// Dynamic imports exercise page-load preference restoration with a fresh module singleton.
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  window.localStorage.clear();
  contextState = "running";
  vi.stubGlobal("AudioContext", AudioContextStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("interaction sound consent", () => {
  it("requires explicit opt-in even with reduced motion and stays silent after muting", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      ...window.matchMedia("(prefers-reduced-motion: reduce)"),
      matches: true,
    });
    const { sound, playSound } = await import("../soundEngine");

    playSound("toggle");
    expect(createContext).not.toHaveBeenCalled();

    sound.toggle();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");
    expect(scheduleCue).toHaveBeenCalledTimes(1);

    sound.toggle();
    playSound("toggle");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("false");
    expect(scheduleCue).toHaveBeenCalledTimes(1);
  });

  it("restores explicit consent on reload without playing or initializing audio", async () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    const { playSound, sound } = await import("../soundEngine");
    expect(createContext).not.toHaveBeenCalled();

    playSound("press");
    expect(scheduleCue).toHaveBeenCalledTimes(1);
    sound.setEnabled(false);

    vi.resetModules();
    const reloaded = await import("../soundEngine");
    reloaded.playSound("press");
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(scheduleCue).toHaveBeenCalledTimes(1);
  });

  it("discards cues while audio is suspended instead of playing them later", async () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    contextState = "suspended";
    const { playSound } = await import("../soundEngine");

    playSound("press");
    await Promise.resolve();
    expect(resumeAudio).toHaveBeenCalledTimes(1);
    expect(scheduleCue).not.toHaveBeenCalled();

    playSound("press");
    expect(scheduleCue).toHaveBeenCalledTimes(1);
  });
});
