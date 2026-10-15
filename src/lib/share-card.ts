/**
 * Tarjetas para compartir, dibujadas en un canvas en el propio dispositivo:
 * ningún dato sale del navegador hasta que tú lo compartes.
 *
 * El modelo es genérico (cabecera, cifra protagonista, gráfica, cifras) y
 * cada tipo de tarjeta (posición, operación, cartera, año) lo rellena.
 * Se dibuja en coordenadas de 1080 px de ancho y se exporta a 2× (2160 px)
 * para que se vea nítida en pantallas de alta densidad.
 */

export type CardFormat = "story" | "square";

export interface CardChartLine {
  kind: "line";
  values: number[];
  /** Puntos sobre la curva (índice en `values`). */
  markers?: { index: number; tone: "buy" | "sell" }[];
  /** Línea horizontal discontinua (p. ej. precio medio). */
  baseline?: number;
  /** Texto de la línea horizontal: "Mi precio medio · 108,45 €". */
  baselineLabel?: string;
}

export interface CardChartDonut {
  kind: "donut";
  slices: { share: number; color: string; label: string }[];
  /** Texto en el centro del donut. */
  centerLabel?: string;
  centerValue?: string;
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
  /** Usar el símbolo de cúmulo como avatar (tarjetas de cartera o del año). */
  brandAvatar?: boolean;
  /** Etiqueta sobre la cifra protagonista: "Rentabilidad". */
  heroLabel?: string;
  /** Cifra protagonista: "+57,6 %". */
  hero: string;
  /** Verde, rojo o neutro (acento). */
  tone: "positive" | "negative" | "neutral";
  subtitle?: string;
  chart?: CardChartLine | CardChartDonut | CardChartBars;
  /** Cifras clave (máx. 6 en historia, 2 en cuadrado; van primero las más importantes). */
  stats: { label: string; value: string; tone?: "positive" | "negative" }[];
  /** Fecha que se muestra en la tarjeta. */
  footer: string;
}

const SCALE = 2;
const W = 1080;

const C = {
  bg: "#08070D",
  text: "#F4F4F7",
  muted: "#9A99AB",
  faint: "rgba(255,255,255,0.08)",
  glass: "rgba(255,255,255,0.045)",
  glassStroke: "rgba(255,255,255,0.09)",
  accent: "#A78BFA",
  accentDeep: "#7C3AED",
  series2: "#FACC15",
  positive: "#4ADE80",
  negative: "#F87171",
};

const TONES = {
  positive: { from: "#BBF7D0", to: "#22C55E", glow: "rgba(34,197,94,0.20)" },
  negative: { from: "#FECACA", to: "#EF4444", glow: "rgba(239,68,68,0.18)" },
  neutral: { from: "#DDD6FE", to: "#8B5CF6", glow: "rgba(139,92,246,0.22)" },
} as const;

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

const statColor = (tone?: "positive" | "negative") => (tone === "positive" ? C.positive : tone === "negative" ? C.negative : C.text);

function fontFamily() {
  return getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Parte un texto en como mucho `maxLines` líneas que quepan en `maxWidth`. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  const rest = words.slice(consumed).join(" ");
  if (rest) lines.push(fitText(ctx, rest, maxWidth));
  return lines.slice(0, maxLines);
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

/** Espaciado entre letras con fallback para navegadores sin `letterSpacing`. */
function setTracking(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Grano muy suave para que el fondo no parezca plano. */
function grain(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const tile = document.createElement("canvas");
  tile.width = tile.height = 160;
  const t = tile.getContext("2d")!;
  const data = t.createImageData(160, 160);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.random() * 255;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    data.data[i + 3] = 10;
  }
  t.putImageData(data, 0, 0);
  ctx.fillStyle = ctx.createPattern(tile, "repeat")!;
  ctx.fillRect(0, 0, width, height);
}

function drawBrand(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, family: string) {
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
  ctx.font = `500 ${Math.round(size * 0.6)}px ${family}`;
  setTracking(ctx, -1);
  ctx.textBaseline = "middle";
  ctx.fillText("cúmulo", x + size * 1.04, y + size / 2 + 2);
  ctx.textBaseline = "alphabetic";
  setTracking(ctx, 0);
}

function pill(ctx: CanvasRenderingContext2D, text: string, rightX: number, centerY: number, family: string, size: number) {
  ctx.font = `500 ${size}px ${family}`;
  const padX = size * 0.9;
  const w = ctx.measureText(text).width + padX * 2;
  const h = size * 2.1;
  const x = rightX - w;
  ctx.beginPath();
  ctx.roundRect(x, centerY - h / 2, w, h, h / 2);
  ctx.fillStyle = C.glass;
  ctx.fill();
  ctx.strokeStyle = C.glassStroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = C.muted;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, centerY + 1);
  ctx.textBaseline = "alphabetic";
}

function drawLine(ctx: CanvasRenderingContext2D, chart: CardChartLine, x: number, y: number, w: number, h: number, family: string) {
  const values = chart.values;
  if (values.length < 2) return;
  const all = chart.baseline !== undefined ? [...values, chart.baseline] : values;
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (max === min) {
    max += 1;
    min -= 1;
  }
  const pad = (max - min) * 0.12;
  min -= pad;
  max += pad;
  const px = (i: number) => x + (i / (values.length - 1)) * w;
  const py = (v: number) => y + h - ((v - min) / (max - min)) * h;

  // Área con degradado acento → transparente.
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, "rgba(167,139,250,0.42)");
  fill.addColorStop(0.7, "rgba(124,58,237,0.08)");
  fill.addColorStop(1, "rgba(124,58,237,0)");
  ctx.beginPath();
  ctx.moveTo(px(0), py(values[0]));
  values.forEach((v, i) => ctx.lineTo(px(i), py(v)));
  ctx.lineTo(px(values.length - 1), y + h);
  ctx.lineTo(px(0), y + h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  // Línea con resplandor.
  const stroke = ctx.createLinearGradient(x, 0, x + w, 0);
  stroke.addColorStop(0, "#8B5CF6");
  stroke.addColorStop(1, "#C4B5FD");
  ctx.save();
  ctx.shadowColor = "rgba(167,139,250,0.75)";
  ctx.shadowBlur = 28;
  ctx.beginPath();
  values.forEach((v, i) => (i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v))));
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 7;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  if (chart.baseline !== undefined) {
    const by = py(chart.baseline);
    ctx.setLineDash([16, 14]);
    ctx.strokeStyle = "rgba(250,204,21,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, by);
    ctx.lineTo(x + w, by);
    ctx.stroke();
    ctx.setLineDash([]);
    if (chart.baselineLabel) {
      ctx.font = `500 26px ${family}`;
      const tw = ctx.measureText(chart.baselineLabel).width + 36;
      const above = by - 40 > y;
      const ly = above ? by - 34 : by + 34;
      ctx.beginPath();
      ctx.roundRect(x + w - tw, ly - 22, tw, 44, 22);
      ctx.fillStyle = "rgba(250,204,21,0.14)";
      ctx.fill();
      ctx.fillStyle = C.series2;
      ctx.textBaseline = "middle";
      ctx.fillText(chart.baselineLabel, x + w - tw + 18, ly + 1);
      ctx.textBaseline = "alphabetic";
    }
  }

  for (const m of chart.markers ?? []) {
    const cx = px(m.index);
    const cy = py(values[m.index]);
    const color = m.tone === "sell" ? C.series2 : C.accent;
    glow(ctx, cx, cy, 46, m.tone === "sell" ? "rgba(250,204,21,0.45)" : "rgba(167,139,250,0.55)");
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fillStyle = C.bg;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function drawDonut(ctx: CanvasRenderingContext2D, chart: CardChartDonut, x: number, y: number, w: number, h: number, family: string, story: boolean) {
  const legendRows = Math.ceil(Math.min(6, chart.slices.length) / 2);
  const legendH = story ? legendRows * 64 : 0;
  const r = story ? Math.min((h - legendH - 40) / 2, w * 0.3) : Math.min(h / 2, w * 0.2);
  const cx = story ? x + w / 2 : x + r;
  const cy = story ? y + r : y + h / 2;
  let angle = -Math.PI / 2;
  const gap = 0.03;
  for (const s of chart.slices) {
    const sweep = s.share * Math.PI * 2;
    const a0 = angle + gap / 2;
    const a1 = angle + Math.max(sweep - gap / 2, gap);
    ctx.save();
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.arc(cx, cy, r * 0.64, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.restore();
    angle += sweep;
  }
  if (chart.centerValue) {
    ctx.textAlign = "center";
    ctx.fillStyle = C.text;
    ctx.font = `600 ${Math.round(r * 0.34)}px ${family}`;
    ctx.fillText(chart.centerValue, cx, cy + r * 0.06);
    if (chart.centerLabel) {
      ctx.fillStyle = C.muted;
      ctx.font = `500 ${Math.round(r * 0.13)}px ${family}`;
      ctx.fillText(chart.centerLabel, cx, cy + r * 0.27);
    }
    ctx.textAlign = "left";
  }

  const rows = chart.slices.slice(0, 6);
  ctx.textBaseline = "middle";
  if (story) {
    const colW = w / 2;
    rows.forEach((s, i) => {
      const lx = x + (i % 2) * colW;
      const ly = cy + r + 70 + Math.floor(i / 2) * 64;
      ctx.beginPath();
      ctx.arc(lx + 12, ly, 12, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.font = `500 32px ${family}`;
      const pct = `${Math.round(s.share * 100)} %`;
      const pctW = ctx.measureText(pct).width;
      ctx.fillStyle = C.text;
      ctx.fillText(fitText(ctx, s.label, colW - 90 - pctW), lx + 40, ly);
      ctx.fillStyle = C.muted;
      ctx.fillText(pct, lx + colW - 40 - pctW, ly);
    });
  } else {
    const lx = x + r * 2 + 56;
    const lineH = Math.min(58, h / rows.length);
    rows.forEach((s, i) => {
      const ly = cy - ((rows.length - 1) * lineH) / 2 + i * lineH;
      ctx.beginPath();
      ctx.arc(lx + 10, ly, 10, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.font = `500 30px ${family}`;
      const pct = `${Math.round(s.share * 100)} %`;
      const pctW = ctx.measureText(pct).width;
      ctx.fillStyle = C.text;
      ctx.fillText(fitText(ctx, s.label, x + w - lx - 60 - pctW), lx + 34, ly);
      ctx.fillStyle = C.muted;
      ctx.fillText(pct, x + w - pctW, ly);
    });
  }
  ctx.textBaseline = "alphabetic";
}

function drawBars(ctx: CanvasRenderingContext2D, chart: CardChartBars, x: number, y: number, w: number, h: number, family: string) {
  const bars = chart.bars.slice(0, 12);
  if (!bars.length) return;
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
  const hasNeg = bars.some((b) => b.value < 0);
  const labelH = 48;
  const plotH = h - labelH;
  const zero = hasNeg ? y + plotH * 0.62 : y + plotH;
  const scaleUp = (hasNeg ? plotH * 0.62 : plotH) / max;
  const scaleDown = (plotH * 0.38) / max;
  const slot = w / bars.length;
  const bw = Math.min(58, slot * 0.58);
  // Etiquetas justo bajo la barra negativa más profunda (o bajo el eje).
  const deepest = Math.max(0, ...bars.filter((b) => b.value < 0).map((b) => Math.max(6, Math.abs(b.value) * scaleDown)));
  const labelY = Math.min(y + h - 8, zero + deepest + 42);
  ctx.strokeStyle = C.faint;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, zero);
  ctx.lineTo(x + w, zero);
  ctx.stroke();
  bars.forEach((b, i) => {
    const bx = x + slot * i + (slot - bw) / 2;
    const up = b.value >= 0;
    const bh = Math.max(6, Math.abs(b.value) * (up ? scaleUp : scaleDown));
    const by = up ? zero - bh : zero;
    const g = ctx.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, up ? "#86EFAC" : "#F87171");
    g.addColorStop(1, up ? "#16A34A" : "#B91C1C");
    ctx.save();
    ctx.shadowColor = up ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.4)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 14);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = C.muted;
    ctx.font = `500 26px ${family}`;
    ctx.textAlign = "center";
    ctx.fillText(b.label, bx + bw / 2, labelY);
    ctx.textAlign = "left";
  });
}

/** Dibuja la tarjeta y devuelve el canvas (a 2× de resolución). */
export async function renderShareCard(model: CardModel, format: CardFormat): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const story = format === "story";
  const H = story ? 1920 : 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingQuality = "high";
  const family = fontFamily();
  const tone = TONES[model.tone];

  // Fondo: base profunda, resplandores y grano.
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, W * 0.92, H * 0.02, W * 0.95, "rgba(124,58,237,0.55)");
  glow(ctx, W * 0.0, H * (story ? 0.36 : 0.45), W * 0.75, tone.glow);
  glow(ctx, W * 0.6, H * 1.02, W * 0.8, "rgba(91,33,182,0.35)");
  grain(ctx, W, H);

  const M = story ? 88 : 64;
  const innerW = W - M * 2;

  // Cabecera: marca y fecha.
  const brandY = story ? 92 : 56;
  const brandSize = story ? 64 : 54;
  drawBrand(ctx, M, brandY, brandSize, family);
  pill(ctx, model.footer, W - M, brandY + brandSize / 2, family, story ? 26 : 24);

  // Activo: logo con halo, etiqueta y título.
  let cursor = brandY + brandSize + (story ? 96 : 48);
  const avatar = story ? 132 : 104;
  const img = model.logoUrl ? await loadImage(model.logoUrl) : null;
  glow(ctx, M + avatar / 2, cursor + avatar / 2, avatar * 1.1, "rgba(167,139,250,0.35)");
  ctx.save();
  ctx.beginPath();
  ctx.arc(M + avatar / 2, cursor + avatar / 2, avatar / 2, 0, Math.PI * 2);
  ctx.fillStyle = img ? "#FFFFFF" : "rgba(167,139,250,0.2)";
  ctx.fill();
  ctx.clip();
  if (img) {
    // Los logos de las fuentes suelen ser pequeños: algo de aire evita que se vean ampliados.
    const s = avatar * 0.62;
    const ratio = Math.min(s / img.width, s / img.height);
    ctx.drawImage(img, M + (avatar - img.width * ratio) / 2, cursor + (avatar - img.height * ratio) / 2, img.width * ratio, img.height * ratio);
  } else if (model.brandAvatar) {
    const s = avatar * 0.66;
    ctx.save();
    ctx.translate(M + (avatar - s) / 2, cursor + (avatar - s) / 2);
    ctx.scale(s / 64, s / 64);
    ctx.fillStyle = C.accent;
    for (const [cx, cy, r] of LOGO_CIRCLES) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else {
    ctx.fillStyle = C.accent;
    ctx.font = `600 ${Math.round(avatar * 0.3)}px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(model.initials ?? "", M + avatar / 2, cursor + avatar / 2 + 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(M + avatar / 2, cursor + avatar / 2, avatar / 2 + 3, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 3;
  ctx.stroke();

  const tx = M + avatar + 36;
  const tw = W - M - tx;
  ctx.fillStyle = C.accent;
  ctx.font = `600 ${story ? 26 : 22}px ${family}`;
  setTracking(ctx, 3);
  ctx.fillText(fitText(ctx, model.eyebrow.toUpperCase(), tw), tx, cursor + (story ? 38 : 30));
  setTracking(ctx, 0);
  ctx.fillStyle = C.text;
  const titleSize = story ? 54 : 44;
  ctx.font = `600 ${titleSize}px ${family}`;
  setTracking(ctx, -1);
  const titleLines = wrapText(ctx, model.title, tw, story ? 2 : 1);
  titleLines.forEach((line, i) => ctx.fillText(line, tx, cursor + (story ? 98 : 80) + i * titleSize * 1.12));
  setTracking(ctx, 0);
  cursor += Math.max(avatar, (story ? 98 : 80) + (titleLines.length - 1) * titleSize * 1.12 + 12) + (story ? 84 : 44);

  // Cifra protagonista con degradado.
  if (model.heroLabel) {
    ctx.fillStyle = C.muted;
    ctx.font = `500 ${story ? 34 : 28}px ${family}`;
    ctx.fillText(model.heroLabel, M, cursor);
    cursor += story ? 22 : 14;
  }
  const heroSize = fitFont(ctx, model.hero, 600, story ? 232 : 168, innerW, family);
  setTracking(ctx, -heroSize * 0.03);
  ctx.font = `600 ${heroSize}px ${family}`;
  const heroTop = cursor;
  cursor += heroSize * 0.86;
  const heroFill = ctx.createLinearGradient(0, heroTop, 0, cursor);
  heroFill.addColorStop(0, tone.from);
  heroFill.addColorStop(1, tone.to);
  ctx.fillStyle = heroFill;
  ctx.fillText(model.hero, M - heroSize * 0.03, cursor);
  setTracking(ctx, 0);
  if (model.subtitle) {
    cursor += story ? 70 : 54;
    ctx.fillStyle = C.muted;
    ctx.font = `500 ${story ? 34 : 28}px ${family}`;
    ctx.fillText(fitText(ctx, model.subtitle, innerW), M, cursor);
  }
  cursor += story ? 72 : 40;

  // Cifras clave abajo; la gráfica ocupa el hueco intermedio.
  const stats = model.stats.slice(0, story ? 6 : 2);
  const cols = 2;
  const statH = story ? 150 : 118;
  const gap = story ? 22 : 18;
  const statRows = Math.ceil(stats.length / cols);
  const statsH = statRows ? statRows * statH + (statRows - 1) * gap : 0;
  const bottom = H - (story ? 110 : 64);
  const statsY = bottom - statsH;

  if (model.chart) {
    const chartY = cursor;
    const chartH = statsY - chartY - (story ? 72 : 36);
    if (chartH > 110) {
      if (model.chart.kind === "line") drawLine(ctx, model.chart, M - 16, chartY, innerW + 32, chartH, family);
      else if (model.chart.kind === "donut") drawDonut(ctx, model.chart, M, chartY, innerW, chartH, family, story);
      else drawBars(ctx, model.chart, M, chartY, innerW, chartH, family);
    }
  }

  const colW = (innerW - gap) / cols;
  stats.forEach((s, i) => {
    const sx = M + (i % cols) * (colW + gap);
    const sy = statsY + Math.floor(i / cols) * (statH + gap);
    ctx.beginPath();
    ctx.roundRect(sx, sy, colW, statH, 34);
    ctx.fillStyle = C.glass;
    ctx.fill();
    ctx.strokeStyle = C.glassStroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.muted;
    ctx.font = `600 ${story ? 21 : 19}px ${family}`;
    setTracking(ctx, 2);
    ctx.fillText(fitText(ctx, s.label.toUpperCase(), colW - 60), sx + 30, sy + (story ? 52 : 44));
    setTracking(ctx, 0);
    ctx.fillStyle = statColor(s.tone);
    const size = fitFont(ctx, s.value, 600, story ? 48 : 40, colW - 60, family);
    ctx.font = `600 ${size}px ${family}`;
    ctx.fillText(s.value, sx + 30, sy + (story ? 112 : 92));
  });

  // Pie de marca (solo en historia; en cuadrado no cabe sin apretar).
  if (story) {
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.font = `500 26px ${family}`;
    ctx.textAlign = "center";
    ctx.fillText("Tus inversiones, sin humo · cúmulo", W / 2, H - 56);
    ctx.textAlign = "left";
  }

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
