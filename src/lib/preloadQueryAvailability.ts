const UNAVAILABLE_PRELOAD_PATTERNS = [
  /next_public_convex_url is not set/i,
  /could not find public function/i,
  /public function .* not found/i,
  /query .* not found/i,
];

export function isBackendUnavailablePreloadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return UNAVAILABLE_PRELOAD_PATTERNS.some((pattern) => pattern.test(error.message));
}
