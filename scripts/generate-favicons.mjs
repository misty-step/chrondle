import sharp from "sharp";
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

// Generate favicon.ico (ICO = 32px PNG with ICO header approach)
// For simplicity, just copy the 32x32 PNG as favicon.ico placeholder
// A proper ICO would need an ico encoder library
const png32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
fs.writeFileSync(path.join(publicDir, "favicon.ico"), png32);
console.log("Generated favicon.ico (32px PNG as ICO)");

console.log("Done!");
