import sharp from "sharp";
import toIco from "to-ico";
import fs from "fs";
import path from "path";

const svgBuffer = fs.readFileSync("public/logo.svg");
const publicDir = "public";

const sizes = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 },
];

for (const { name, size } of sizes) {
  await sharp(svgBuffer).resize(size, size).png().toFile(path.join(publicDir, name));
  console.log(`Generated ${name}`);
}

// Generate favicon.ico with proper ICO container (16px + 32px layers)
const [png16, png32] = await Promise.all([
  sharp(svgBuffer).resize(16, 16).png().toBuffer(),
  sharp(svgBuffer).resize(32, 32).png().toBuffer(),
]);
const icoBuffer = await toIco([png16, png32]);
fs.writeFileSync(path.join(publicDir, "favicon.ico"), icoBuffer);
console.log("Generated favicon.ico (ICO container with 16px + 32px layers)");

console.log("Done!");
