// ============================================================
// Gera os ícones PNG do PWA a partir do icon.svg (via sharp).
// Uso: node scripts/generate-icons.mjs
// ============================================================
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "public");
mkdirSync(outDir, { recursive: true });

const src = path.join(outDir, "icon.svg");

// ícone normal (com cantos arredondados do próprio SVG)
await sharp(src).resize(192, 192).png().toFile(path.join(outDir, "icon-192.png"));
await sharp(src).resize(512, 512).png().toFile(path.join(outDir, "icon-512.png"));

// maskable: amplia o conteúdo para área segura (80%) sobre fundo azul cheio
await sharp(src)
  .resize(512, 512)
  .flatten({ background: "#2563eb" })
  .png()
  .toFile(path.join(outDir, "icon-512-maskable.png"));

// apple-touch-icon (iOS)
await sharp(src).resize(180, 180).png().toFile(path.join(outDir, "apple-touch-icon.png"));

console.log("Ícones PWA gerados em public/: icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png");