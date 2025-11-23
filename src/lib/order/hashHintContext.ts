export function hashHintContext(parts: Array<string | number>): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    const chunk = String(part);
    for (let i = 0; i < chunk.length; i++) {
      hash ^= chunk.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= chunk.length;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
