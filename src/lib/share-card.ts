/**
 * Tarjetas para compartir, dibujadas en un canvas en el propio dispositivo:
 * ningún dato sale del navegador hasta que tú lo compartes.
 *
 * El modelo es genérico (cabecera, cifra protagonista, gráfica, cifras) y
 * cada tipo de tarjeta (posición, operación, cartera, año) lo rellena.
 */

export type CardFormat = "story" | "square";

export interface CardChartLine {
  kind: "line";
  values: number[];
  /** Puntos sobre la curva (índice en `values`). */
  markers?: { index: number; tone: "buy" | "sell" }[];
  /** Línea horizontal discontinua (p. ej. precio medio). */
  baseline?: number;
}

export interface CardChartDonut {
  kind: "donut";
  slices: { share: number; color: string; label: string }[];
}

export interface CardChartBars {
  kind: "bars";
  /** Valores en %, positivos y negativos. */
  bars: { label: string; value: number }[];
}

export interface CardModel {
  /** Texto pequeño sobre el título: "Posición · ETF". */
  eyebrow: string;
  title: string;
  /** Logo del activo (misma web) o iniciales. */
  logoUrl?: string;
  initials?: string;
  /** Cifra protagonista: "+57,6 %". */
  hero: string;
  /** Verde, rojo o neutro (acento). */
  tone: "positive" | "negative" | "neutral";
  subtitle?: string;
  chart?: CardChartLine | CardChartDonut | CardChartBars;
  /** Cifras clave (máx. 6 en historia, 2 en cuadrado; van primero las más importantes). */
  stats: { label: string; value: string; tone?: "positive" | "negative" }[];
  footer: string;
}

const C = {
  bg: "#0A0A0F",
  surface: "#14141B",
  surface2: "#1C1C25",
  border: "#262631",
  text: "#F4F4F7",
  muted: "#8B8A9B",
  accent: "#A78BFA",
  accentStrong: "#7C3AED",
  series2: "#FACC15",
  positive: "#4ADE80",
  negative: "#F87171",
};

/** Las diez burbujas del símbolo de marca, en un lienzo de 64. */
const LOGO_CIRCLES: [number, number, number][] = [
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

const toneColor = (tone?: "positive" | "negative" | "neutral") =>
  tone === "positive" ? C.positive : tone === "negative" ? C.negative : C.text;

function fontFamily() {
  const family = getComputedStyle(document.body).fontFamily;
  return family || "system-ui, sans-serif";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Ajusta el tamaño de fuente para que el texto quepa. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number, family: string) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 24 && ctx.measureText(text).width > maxWidth) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, family: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  ctx.fillStyle = C.accent;
  for (const [cx, cy, r] of LOGO_CIRCLES) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = C.text;
  ctx.font = `500 ${Math.round(size * 0.62)}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.fillText("cúmulo", x + size * 1.02, y + size / 2 + 2);
  ctx.textBaseline = "alphabetic";
}

function drawLine(ctx: CanvasRenderingContext2D, chart: CardChartLine, x: number, y: number, w: number, h: number) {
  const values = chart.values;
  if (values.length < 2) return;
  const all = chart.baseline !== undefined ? [...values, chart.baseline] : values;
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (max === min) {
    max += 1;
    min -= 1;
  }
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;
  const px = (i: number) => x + (i / (values.length - 1)) * w;
  const py = (v: number) => y + h - ((v - min) / (max - min)) * h;

  // Rejilla horizontal suave.
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 10]);
  for (let i = 0; i <= 3; i++) {
    const gy = y + (h / 3) * i;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Área con degradado acento → transparente.
  const gradient = ctx.createLinearGradient(0, y, 0, y + h);
  gradient.addColorStop(0, "rgba(167,139,250,0.38)");
  gradient.addColorStop(1, "rgba(167,139,250,0)");
  ctx.beginPath();
  ctx.moveTo(px(0), py(values[0]));
  values.forEach((v, i) => ctx.lineTo(px(i), py(v)));
  ctx.lineTo(px(values.length - 1), y + h);
  ctx.lineTo(px(0), y + h);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  values.forEach((v, i) => (i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v))));
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  if (chart.baseline !== undefined) {
    ctx.setLineDash([14, 12]);
    ctx.strokeStyle = C.series2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, py(chart.baseline));
    ctx.lineTo(x + w, py(chart.baseline));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const m of chart.markers ?? []) {
    const cx = px(m.index);
    const cy = py(values[m.index]);
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = m.tone === "sell" ? C.series2 : C.accent;
    ctx.fill();
  }
}

function drawDonut(ctx: CanvasRenderingContext2D, chart: CardChartDonut, x: number, y: number, w: number, h: number, family: string) {
  const r = Math.min(h / 2, w * 0.22);
  const cx = x + r;
  const cy = y + h / 2;
  let angle = -Math.PI / 2;
  const gap = 0.025;
  for (const s of chart.slices) {
    const sweep = s.share * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, angle + gap / 2, angle + Math.max(sweep - gap / 2, gap));
    ctx.arc(cx, cy, r * 0.62, angle + Math.max(sweep - gap / 2, gap), angle + gap / 2, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    angle += sweep;
  }
  // Leyenda a la derecha.
  const lx = x + r * 2 + 56;
  const rows = chart.slices.slice(0, 6);
  const lineH = Math.min(64, h / rows.length);
  ctx.textBaseline = "middle";
  rows.forEach((s, i) => {
    const ly = cy - ((rows.length - 1) * lineH) / 2 + i * lineH;
    ctx.beginPath();
    ctx.arc(lx + 10, ly, 10, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.fillStyle = C.text;
    ctx.font = `500 34px ${family}`;
    const pct = `${Math.round(s.share * 100)} %`;
    const pctW = ctx.measureText(pct).width;
    ctx.fillText(fitText(ctx, s.label, x + w - lx - 40 - pctW - 24), lx + 36, ly);
    ctx.fillStyle = C.muted;
    ctx.fillText(pct, x + w - pctW, ly);
  });
  ctx.textBaseline = "alphabetic";
}

function drawBars(ctx: CanvasRenderingContext2D, chart: CardChartBars, x: number, y: number, w: number, h: number, family: string) {
  const bars = chart.bars.slice(0, 12);
  if (!bars.length) return;
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
  const hasNeg = bars.some((b) => b.value < 0);
  const labelH = 44;
  const plotH = h - labelH;
  const zero = hasNeg ? y + plotH / 2 : y + plotH;
  const scale = (hasNeg ? plotH / 2 : plotH) / max;
  const slot = w / bars.length;
  const bw = Math.min(64, slot * 0.6);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, zero);
  ctx.lineTo(x + w, zero);
  ctx.stroke();
  bars.forEach((b, i) => {
    const bx = x + slot * i + (slot - bw) / 2;
    const bh = Math.max(4, Math.abs(b.value) * scale);
    ctx.fillStyle = b.value >= 0 ? C.positive : C.negative;
    roundRect(ctx, bx, b.value >= 0 ? zero - bh : zero, bw, bh, 12);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.font = `500 26px ${family}`;
    ctx.textAlign = "center";
    ctx.fillText(b.label, bx + bw / 2, y + h - 6);
    ctx.textAlign = "left";
  });
}

/** Dibuja la tarjeta y devuelve el canvas. */
export async function renderShareCard(model: CardModel, format: CardFormat): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const W = 1080;
  const H = format === "story" ? 1920 : 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const family = fontFamily();

  // Fondo con brillo de acento.
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.15, H * 0.05, 0, W * 0.15, H * 0.05, W * 1.1);
  glow.addColorStop(0, "rgba(124,58,237,0.55)");
  glow.addColorStop(0.45, "rgba(124,58,237,0.12)");
  glow.addColorStop(1, "rgba(124,58,237,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const story = format === "story";
  const M = story ? 72 : 56;
  drawLogo(ctx, M, story ? 96 : 56, story ? 72 : 60, family);

  // Panel.
  const panelY = story ? 230 : 156;
  const panelH = H - panelY - (story ? 150 : 96);
  roundRect(ctx, M, panelY, W - M * 2, panelH, 56);
  ctx.fillStyle = C.surface;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  const P = story ? 64 : 52;
  const innerX = M + P;
  const innerW = W - (M + P) * 2;
  let cursor = panelY + P;

  // Cabecera: logo del activo + eyebrow + título.
  const avatar = story ? 112 : 96;
  const img = model.logoUrl ? await loadImage(model.logoUrl) : null;
  const ax = innerX;
  const ay = cursor;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + avatar / 2, ay + avatar / 2, avatar / 2, 0, Math.PI * 2);
  ctx.fillStyle = img ? "#FFFFFF" : "rgba(167,139,250,0.18)";
  ctx.fill();
  ctx.clip();
  if (img) {
    const s = avatar * 0.74;
    const ratio = Math.min(s / img.width, s / img.height);
    const iw = img.width * ratio;
    const ih = img.height * ratio;
    ctx.drawImage(img, ax + (avatar - iw) / 2, ay + (avatar - ih) / 2, iw, ih);
  } else {
    ctx.fillStyle = C.accent;
    ctx.font = `600 ${Math.round(avatar * 0.3)}px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(model.initials ?? "", ax + avatar / 2, ay + avatar / 2 + 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  const tx = ax + avatar + 32;
  const tw = innerX + innerW - tx;
  ctx.fillStyle = C.muted;
  ctx.font = `500 ${story ? 32 : 28}px ${family}`;
  ctx.fillText(fitText(ctx, model.eyebrow, tw), tx, ay + avatar * 0.38);
  ctx.fillStyle = C.text;
  ctx.font = `600 ${story ? 46 : 40}px ${family}`;
  ctx.fillText(fitText(ctx, model.title, tw), tx, ay + avatar * 0.84);
  cursor += avatar + (story ? 72 : 48);

  // Cifra protagonista.
  const heroSize = fitFont(ctx, model.hero, 500, story ? 196 : 150, innerW, family);
  ctx.fillStyle = model.tone === "neutral" ? C.accent : toneColor(model.tone);
  cursor += heroSize * 0.82;
  ctx.fillText(model.hero, innerX - 4, cursor);
  if (model.subtitle) {
    cursor += story ? 70 : 56;
    ctx.fillStyle = C.muted;
    ctx.font = `500 ${story ? 38 : 32}px ${family}`;
    ctx.fillText(fitText(ctx, model.subtitle, innerW), innerX, cursor);
  }
  cursor += story ? 64 : 44;

  // Cifras clave abajo; la gráfica ocupa el hueco intermedio.
  // En cuadrado solo una fila de cifras para que quepa la gráfica.
  const maxStats = story ? 6 : 2;
  const stats = model.stats.slice(0, maxStats);
  const cols = 2;
  const statH = story ? 156 : 126;
  const gap = story ? 24 : 20;
  const statRows = Math.ceil(stats.length / cols);
  const statsH = statRows ? statRows * statH + (statRows - 1) * gap : 0;
  const statsY = panelY + panelH - P - statsH;

  if (model.chart) {
    const chartY = cursor + 10;
    const chartH = statsY - chartY - (story ? 56 : 36);
    if (chartH > 120) {
      if (model.chart.kind === "line") drawLine(ctx, model.chart, innerX, chartY, innerW, chartH);
      else if (model.chart.kind === "donut") drawDonut(ctx, model.chart, innerX, chartY, innerW, chartH, family);
      else drawBars(ctx, model.chart, innerX, chartY, innerW, chartH, family);
    }
  }

  const colW = (innerW - gap) / cols;
  stats.forEach((s, i) => {
    const sx = innerX + (i % cols) * (colW + gap);
    const sy = statsY + Math.floor(i / cols) * (statH + gap);
    roundRect(ctx, sx, sy, colW, statH, 32);
    ctx.fillStyle = C.surface2;
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.font = `500 ${story ? 28 : 25}px ${family}`;
    ctx.fillText(fitText(ctx, s.label, colW - 56), sx + 28, sy + (story ? 56 : 46));
    ctx.fillStyle = toneColor(s.tone);
    const size = fitFont(ctx, s.value, 600, story ? 46 : 40, colW - 56, family);
    ctx.font = `600 ${size}px ${family}`;
    ctx.fillText(s.value, sx + 28, sy + (story ? 118 : 96));
  });

  // Pie.
  ctx.fillStyle = C.muted;
  ctx.font = `500 ${story ? 30 : 26}px ${family}`;
  ctx.textAlign = "center";
  ctx.fillText(model.footer, W / 2, H - (story ? 70 : 42));
  ctx.textAlign = "left";

  return canvas;
}

export async function cardToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear la imagen."))), "image/png"),
  );
  return new File([blob], name, { type: "image/png" });
}

/** Comparte con el menú del sistema; si no se puede, descarga la imagen. */
export async function shareOrDownload(file: File, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  downloadFile(file);
  return "downloaded";
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
