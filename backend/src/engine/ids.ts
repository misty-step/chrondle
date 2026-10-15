/**
 * Convex document IDs (format v6), so documents created on Cloudflare remain
 * valid IDs for the same tables in the original Convex deployment. That keeps
 * `npx convex import --replace` usable as a lossless rollback path.
 *
 *   binary = VInt(tableNumber) ++ internalId[16] ++ footer[2, LE]
 *   footer = fletcher16(VInt(tableNumber) ++ internalId) ^ VERSION(0)
 *   text   = lowercase Crockford base32 of binary
 *
 * Reference: get-convex/convex-backend crates/value/src/id_v6.rs and base32.rs.
 */

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const DECODE = new Map([...ALPHABET].map((char, index) => [char, index]));

function encodedLength(byteLength: number): number {
  const lastChunk = [0, 2, 4, 5, 7][byteLength % 5];
  return Math.floor(byteLength / 5) * 8 + lastChunk;
}

const MIN_LENGTH = encodedLength(1 + 16 + 2);
const MAX_LENGTH = encodedLength(5 + 16 + 2);

function base32Encode(data: Uint8Array): string {
  let out = "";
  for (let offset = 0; offset < data.length; offset += 5) {
    const block = new Uint8Array(5);
    block.set(data.subarray(offset, offset + 5));
    const chars = [
      (block[0] & 0b1111_1000) >> 3,
      ((block[0] & 0b0000_0111) << 2) | ((block[1] & 0b1100_0000) >> 6),
      (block[1] & 0b0011_1110) >> 1,
      ((block[1] & 0b0000_0001) << 4) | ((block[2] & 0b1111_0000) >> 4),
      ((block[2] & 0b0000_1111) << 1) | (block[3] >> 7),
      (block[3] & 0b0111_1100) >> 2,
      ((block[3] & 0b0000_0011) << 3) | ((block[4] & 0b1110_0000) >> 5),
      block[4] & 0b0001_1111,
    ];
    for (const index of chars) out += ALPHABET[index];
  }
  return out.slice(0, encodedLength(data.length));
}

function base32Decode(text: string): Uint8Array | null {
  const outLength = Math.floor((text.length * 5) / 8);
  const out: number[] = [];
  for (let offset = 0; offset < text.length; offset += 8) {
    const indexes = new Array<number>(8).fill(0);
    for (let i = 0; i < 8 && offset + i < text.length; i++) {
      const index = DECODE.get(text[offset + i]);
      if (index === undefined) return null;
      indexes[i] = index;
    }
    out.push(
      ((indexes[0] << 3) | (indexes[1] >> 2)) & 0xff,
      ((indexes[1] << 6) | (indexes[2] << 1) | (indexes[3] >> 4)) & 0xff,
      ((indexes[3] << 4) | (indexes[4] >> 1)) & 0xff,
      ((indexes[4] << 7) | (indexes[5] << 2) | (indexes[6] >> 3)) & 0xff,
      ((indexes[6] << 5) | indexes[7]) & 0xff,
    );
  }
  return Uint8Array.from(out.slice(0, outLength));
}

function fletcher16(bytes: Uint8Array): number {
  let c0 = 0;
  let c1 = 0;
  for (const byte of bytes) {
    c0 = (c0 + byte) & 0xff;
    c1 = (c1 + c0) & 0xff;
  }
  return (c1 << 8) | c0;
}

function vintEncode(value: number): number[] {
  const out: number[] = [];
  let n = value >>> 0;
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
  return out;
}

export function encodeDocumentId(tableNumber: number, internalId: Uint8Array): string {
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 0xffffffff) {
    throw new Error(`Invalid table number ${tableNumber}`);
  }
  if (internalId.length !== 16) throw new Error("Internal ID must be 16 bytes");
  const body = Uint8Array.from([...vintEncode(tableNumber), ...internalId]);
  const footer = fletcher16(body);
  return base32Encode(Uint8Array.from([...body, footer & 0xff, footer >> 8]));
}

export function decodeDocumentId(id: string): { tableNumber: number; internalId: Uint8Array } | null {
  if (typeof id !== "string" || id.length < MIN_LENGTH || id.length > MAX_LENGTH) return null;
  const bytes = base32Decode(id);
  if (bytes === null) return null;
  let tableNumber = 0;
  let pos = 0;
  for (let i = 0; ; i++) {
    if (i >= 5 || pos >= bytes.length) return null;
    const byte = bytes[pos++];
    tableNumber += (byte & 0x7f) * 2 ** (7 * i);
    if (byte < 0x80) break;
  }
  if (tableNumber === 0 || tableNumber > 0xffffffff) return null;
  if (bytes.length !== pos + 16 + 2) return null;
  const internalId = bytes.slice(pos, pos + 16);
  const footer = bytes[pos + 16] | (bytes[pos + 17] << 8);
  if (fletcher16(bytes.subarray(0, pos + 16)) !== footer) return null;
  if (encodeDocumentId(tableNumber, internalId) !== id) return null;
  return { tableNumber, internalId };
}

export function newDocumentId(tableNumber: number): string {
  const internalId = new Uint8Array(16);
  crypto.getRandomValues(internalId);
  return encodeDocumentId(tableNumber, internalId);
}
