// Genera los iconos de la PWA a partir del símbolo de marca (dirección 2a,
// "c de cúmulo"; fuente en docs/brand). Uso: node scripts/generate-icons.mjs
import { copyFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Diez burbujas que dibujan la "c", sobre un lienzo de 64×64.
const CIRCLES = [
  [42.07, 47.27, 4.5],
  [35.41, 50.93, 4.97],
  [27.58, 50.9, 5.49],
  [20.55, 46.98, 6.06],
  [16.18, 39.96, 6.69],
  [15.75, 31.48, 7.39],
  [19.58, 23.65, 8.17],
  [26.9, 18.53, 9.02],
  [36.01, 17.57, 9.96],
  [44.64, 21.22, 11.0],
];
const symbol = CIRCLES.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join("");

const GRADIENT = `<linearGradient id="g" x1="0.3" y1="0" x2="0.7" y2="1">
  <stop offset="0" stop-color="#8B5CF6"/><stop offset="0.55" stop-color="#7C3AED"/><stop offset="1" stop-color="#6D28D9"/>
</linearGradient>`;

/** Icono de app 512: degradado y símbolo blanco (igual que app-icon-degradado.svg). */
const appIcon = ({ rounded }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>${GRADIENT}</defs>
  <rect width="512" height="512" rx="${rounded ? 115 : 0}" fill="url(#g)"/>
  <g transform="translate(82 82) scale(5.4375)" fill="#FFFFFF">${symbol}</g>
</svg>`;

/** Favicon: morado y, con el sistema en oscuro, lila. */
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <style>g{fill:#7C3AED}@media (prefers-color-scheme:dark){g{fill:#A78BFA}}</style>
  <g>${symbol}</g>
</svg>
`;

const png = (source, size, file) => sharp(Buffer.from(source), { density: 600 }).resize(size, size).png().toFile(file);

await Promise.all([
  png(appIcon({ rounded: true }), 192, "public/icons/icon-192.png"),
  png(appIcon({ rounded: true }), 512, "public/icons/icon-512.png"),
  // Maskable: a sangre; el símbolo cabe en la zona segura del 80 %.
  png(appIcon({ rounded: false }), 512, "public/icons/maskable-512.png"),
  copyFile("docs/brand/png/apple-touch-icon-180.png", "src/app/apple-icon.png"),
  writeFile("src/app/icon.svg", favicon),
]);
console.log("Iconos generados.");
