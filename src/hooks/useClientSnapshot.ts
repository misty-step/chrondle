"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function useClientSnapshot<T>(getSnapshot: () => T, getServerSnapshot: () => T): T {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
