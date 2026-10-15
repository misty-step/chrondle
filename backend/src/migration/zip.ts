/**
 * The minimal ZIP reader/writer the Convex snapshot conversion needs.
 *
 * Reads what `npx convex export` writes: deflated, streamed entries whose
 * sizes and offsets live in ZIP64 extra fields (0x0001) when the 32-bit
 * fields hold 0xFFFFFFFF. Writes plain ZIP32, which `npx convex import`
 * reads. Encryption and other compression methods are refused.
 */
import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_END = 0x06064b50;
const ZIP64_EXTRA = 0x0001;
const STORED = 0;
const DEFLATED = 8;
const MAX16 = 0xffff;
const MAX32 = 0xffffffff;

/** Entry name → uncompressed bytes, in archive order. */
export type ZipEntries = Map<string, Uint8Array>;

function u64(view: DataView, at: number): number {
  const value = view.getBigUint64(at, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("ZIP field too large");
  return Number(value);
}

/** Locate the central directory, following the ZIP64 end record when needed. */
function centralDirectory(view: DataView): { count: number; offset: number } {
  let end = -1;
  for (let at = view.byteLength - 22; at >= Math.max(0, view.byteLength - 22 - MAX16); at--) {
    if (view.getUint32(at, true) === END_OF_CENTRAL_DIRECTORY) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new Error("Not a ZIP archive (no end of central directory)");
  let count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  if (count === MAX16 || offset === MAX32) {
    if (end < 20 || view.getUint32(end - 20, true) !== ZIP64_LOCATOR)
      throw new Error("Corrupt ZIP64 archive (no locator)");
    const zip64End = u64(view, end - 20 + 8);
    if (view.getUint32(zip64End, true) !== ZIP64_END) throw new Error("Corrupt ZIP64 end record");
    count = u64(view, zip64End + 32);
    offset = u64(view, zip64End + 48);
  }
  return { count, offset };
}

export function readZip(archive: Uint8Array): ZipEntries {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const { count, offset } = centralDirectory(view);
  const entries: ZipEntries = new Map();
  const decoder = new TextDecoder();
  let at = offset;
  for (let i = 0; i < count; i++) {
    if (at + 46 > archive.length || view.getUint32(at, true) !== CENTRAL_HEADER)
      throw new Error("Corrupt ZIP central directory");
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const expectedCrc = view.getUint32(at + 16, true);
    let compressedSize = view.getUint32(at + 20, true);
    let size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    let localOffset = view.getUint32(at + 42, true);
    const name = decoder.decode(archive.subarray(at + 46, at + 46 + nameLength));
    // ZIP64 extended information: only the saturated fields appear, in this order.
    const extraEnd = at + 46 + nameLength + extraLength;
    for (let extra = at + 46 + nameLength; extra + 4 <= extraEnd;) {
      const id = view.getUint16(extra, true);
      const length = view.getUint16(extra + 2, true);
      if (id === ZIP64_EXTRA) {
        let field = extra + 4;
        if (size === MAX32) {
          size = u64(view, field);
          field += 8;
        }
        if (compressedSize === MAX32) {
          compressedSize = u64(view, field);
          field += 8;
        }
        if (localOffset === MAX32) localOffset = u64(view, field);
      }
      extra += 4 + length;
    }
    if (flags & 0x1) throw new Error(`Encrypted ZIP entry ${name} is not supported`);
    if (localOffset + 30 > archive.length || view.getUint32(localOffset, true) !== LOCAL_HEADER)
      throw new Error(`Corrupt ZIP entry ${name}`);
    const dataStart =
      localOffset +
      30 +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);
    const raw = archive.subarray(dataStart, dataStart + compressedSize);
    let data: Uint8Array;
    if (method === STORED) data = raw;
    else if (method === DEFLATED) data = new Uint8Array(inflateRawSync(raw));
    else throw new Error(`ZIP entry ${name} uses unsupported compression method ${method}`);
    if (data.length !== size || crc32(data) !== expectedCrc)
      throw new Error(`ZIP entry ${name} failed its size or CRC check`);
    entries.set(name, data);
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function writeZip(entries: ZipEntries): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  if (entries.size >= MAX16) throw new Error("Too many entries for ZIP32");
  for (const [name, data] of entries) {
    const nameBytes = encoder.encode(name);
    const compressed = new Uint8Array(deflateRawSync(data));
    const crc = crc32(data);
    if (data.length >= MAX32 || offset >= MAX32) throw new Error("Archive too large for ZIP32");

    const local = new Uint8Array(30 + nameBytes.length + compressed.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, LOCAL_HEADER, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, DEFLATED, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(compressed, 30 + nameBytes.length);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, CENTRAL_HEADER, true);
    cv.setUint16(4, 0x0314, true); // made by: Unix, spec 2.0
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, DEFLATED, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, compressed.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(38, (0o100644 << 16) >>> 0, true); // regular file, rw-r--r--
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, END_OF_CENTRAL_DIRECTORY, true);
  ev.setUint16(8, entries.size, true);
  ev.setUint16(10, entries.size, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const archive = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    archive.set(part, at);
    at += part.length;
  }
  return archive;
}
