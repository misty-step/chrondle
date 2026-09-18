"use client";

import { useCallback, useSyncExternalStore } from "react";
import { sound, type SoundCue, type PlaySoundOptions } from "./soundEngine";

function subscribe(callback: () => void) {
  return sound.subscribe(callback);
}

function getSoundSnapshot() {
  return sound.isEnabled();
}

function getServerSnapshot() {
  return false;
}

export function useSound() {
  const isEnabled = useSyncExternalStore(subscribe, getSoundSnapshot, getServerSnapshot);

  const play = useCallback((cue: SoundCue, options?: PlaySoundOptions) => {
    sound.play(cue, options);
  }, []);

  const toggleSound = useCallback(() => {
    return sound.toggle();
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    sound.setEnabled(enabled);
  }, []);

  return {
    isEnabled,
    play,
    toggleSound,
    setSoundEnabled,
  };
}
