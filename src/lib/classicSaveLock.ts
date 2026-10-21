/** Serialize accepted submissions and acknowledgement cleanup across tabs. */
export async function withClassicSaveLock<T>(
  puzzleId: string,
  operation: () => T | Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(`chrondle-classic-${puzzleId}`, operation);
  }
  return operation();
}
