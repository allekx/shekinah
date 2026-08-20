// ============================================================
// Gera ícones PNG/PWA a partir do icon.svg (via sharp).
// Uso: node scripts/generate-icons.mjs
// ============================================================
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "public");
mkdirSync(outDir, { recursive: true });

const src = path.join(outDir, "icon.svg");
const mark = path.join(outDir, "brand-mark.svg");

const PRIMARY_600 = "#E87245";
const PRIMARY_700 = "#D05F38";

const maskableBg = (size) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop stop-color="${PRIMARY_600}"/>
      <stop stop-color="${PRIMARY_700}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
</svg>`);

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-16.png", size: 16 },
];

for (const { name, size } of sizes) {
  await sharp(src).resize(size, size).png().toFile(path.join(outDir, name));
}

// maskable: fundo laranja cheio + símbolo na área segura (~80%)
const maskableSize = 512;
const markSize = Math.round(maskableSize * 0.52);
const markPad = Math.round((maskableSize - markSize) / 2);
const markPng = await sharp(mark).resize(markSize, markSize).png().toBuffer();

await sharp(maskableBg(maskableSize))
  .composite([{ input: markPng, left: markPad, top: markPad }])
  .png()
  .toFile(path.join(outDir, "icon-512-maskable.png"));

console.log(
  "Ícones gerados em public/: icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png, favicon-16.png, favicon-32.png"
);
