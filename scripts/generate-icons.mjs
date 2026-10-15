// Genera los iconos de la PWA a partir de la marca. Uso: node scripts/generate-icons.mjs
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const ACCENT = "#7C3AED";
const CLOUD = "#FFFFFF";

// Nube sobre lienzo de 32x32 (misma geometría que components/logo.tsx).
const cloud = `
  <g transform="translate(-0.25 0.5)">
    <circle cx="11.5" cy="18.5" r="4.5"/>
    <circle cx="17" cy="14" r="6"/>
    <circle cx="21.5" cy="19" r="4"/>
    <rect x="11.5" y="17" width="10" height="6"/>
  </g>`;

const svg = ({ rounded, scale }) => {
  const offset = (32 - 32 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${rounded ? 7 : 0}" fill="${ACCENT}"/>
  <g fill="${CLOUD}" transform="translate(${offset} ${offset}) scale(${scale})">${cloud}</g>
</svg>`;
};

const standard = svg({ rounded: false, scale: 1.15 });
const maskable = svg({ rounded: false, scale: 0.85 }); // dentro de la zona segura del 80 %
const favicon = svg({ rounded: true, scale: 1 });

const png = (source, size, file) => sharp(Buffer.from(source), { density: 1200 }).resize(size, size).png().toFile(file);

await Promise.all([
  png(standard, 192, "public/icons/icon-192.png"),
  png(standard, 512, "public/icons/icon-512.png"),
  png(maskable, 512, "public/icons/maskable-512.png"),
  png(standard, 180, "src/app/apple-icon.png"),
  writeFile("src/app/icon.svg", favicon),
]);
console.log("Iconos generados.");
