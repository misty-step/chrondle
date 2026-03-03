import sharp from "sharp";
import fs from "fs";
import path from "path";

const publicDir = "public";
const sourceLogo = path.join(publicDir, "logo.svg");

const sizes = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 },
];

function buildIco(pngBuffers) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngBuffers.length, 4); // image count

  const entries = [];
  const payloads = [];
  let offset = 6 + pngBuffers.length * 16;

  for (const png of pngBuffers) {
    const meta = {
      width: png.readUInt32BE(16),
      height: png.readUInt32BE(20),
    };
    const entry = Buffer.alloc(16);
    entry.writeUInt8(meta.width >= 256 ? 0 : meta.width, 0);
    entry.writeUInt8(meta.height >= 256 ? 0 : meta.height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    payloads.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...payloads]);
}

async function main() {
  try {
    if (!fs.existsSync(sourceLogo)) {
      console.error(`Favicon generation failed: missing ${sourceLogo}`);
      process.exit(1);
    }

    const svgBuffer = fs.readFileSync(sourceLogo);
    for (const { name, size } of sizes) {
      await sharp(svgBuffer).resize(size, size).png().toFile(path.join(publicDir, name));
      console.log(`Generated ${name}`);
    }

    const [png16, png32] = await Promise.all([
      sharp(svgBuffer).resize(16, 16).png().toBuffer(),
      sharp(svgBuffer).resize(32, 32).png().toBuffer(),
    ]);
    const icoBuffer = buildIco([png16, png32]);
    fs.writeFileSync(path.join(publicDir, "favicon.ico"), icoBuffer);
    console.log("Generated favicon.ico");

    console.log("Done!");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Favicon generation failed: ${message}`);
    process.exit(1);
  }
}

await main();
