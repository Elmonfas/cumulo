/**
 * Tarjetas para compartir, dibujadas en un canvas en el propio dispositivo:
 * ningún dato sale del navegador hasta que tú lo compartes.
 *
 * El modelo es genérico (cabecera, cifra protagonista, gráfica, cifras) y
 * cada tipo de tarjeta (posición, operación, cartera, año) lo rellena.
 *
 * Dirección visual: editorial y de marca. El símbolo de cúmulo (las burbujas
 * de la "c") es el motivo gráfico, recortado en una esquina; la cifra
 * protagonista va enorme y en un solo color; las cifras clave son una lista
 * tipográfica con filetes finos. Sin brillos ni cristal.
 * Se dibuja en coordenadas de 1080 px de ancho y se exporta a 2× (2160 px)
 * para que se vea nítida en pantallas de alta densidad.
 */

export type CardFormat = "story" | "square";
/** Oscuro (por defecto), claro o sobre el morado de la marca. */
export type CardTheme = "dark" | "light" | "violet";

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
  /** `color`: índice de la paleta de series (0 = acento) u "other" para el resto. */
  slices: { share: number; color: number | "other"; label: string }[];
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

export const SCALE = 2;
export const W = 1080;

export interface Palette {
  /** Fondo: color sólido o degradado vertical [arriba, abajo]. */
  bg: string | [string, string];
  text: string;
  muted: string;
  hairline: string;
  accent: string;
  positive: string;
  negative: string;
  /** Línea del precio medio. */
  reference: string;
  sell: string;
  /** Burbujas decorativas del símbolo. */
  bubble: string;
  /** Degradado del área de la gráfica (arriba). */
  area: string;
  /** Fondo del avatar sin logo. */
  avatarBg: string;
  series: string[];
  other: string;
}

export const PALETTES: Record<CardTheme, Palette> = {
  dark: {
    bg: "#0B0A10",
    text: "#F4F4F7",
    muted: "#8B8A9B",
    hairline: "rgba(255,255,255,0.10)",
    accent: "#A78BFA",
    positive: "#4ADE80",
    negative: "#F87171",
    reference: "#FACC15",
    sell: "#F472B6",
    bubble: "rgba(167,139,250,0.11)",
    area: "rgba(167,139,250,0.38)",
    avatarBg: "rgba(167,139,250,0.16)",
    series: ["#A78BFA", "#FACC15", "#34D399", "#F472B6", "#60A5FA", "#FB923C"],
    other: "#5C5B6B",
  },
  light: {
    bg: "#F5F5F8",
    text: "#0E0E14",
    muted: "#6B6A7A",
    hairline: "rgba(14,14,20,0.10)",
    accent: "#7C3AED",
    positive: "#16A34A",
    negative: "#DC2626",
    reference: "#D97706",
    sell: "#DB2777",
    bubble: "rgba(124,58,237,0.08)",
    area: "rgba(124,58,237,0.20)",
    avatarBg: "rgba(124,58,237,0.10)",
    series: ["#7C3AED", "#F59E0B", "#059669", "#DB2777", "#2563EB", "#EA580C"],
    other: "#B4B3C2",
  },
  violet: {
    bg: ["#7C3AED", "#4C1D95"],
    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.70)",
    hairline: "rgba(255,255,255,0.22)",
    accent: "#FFFFFF",
    positive: "#A7F3D0",
    negative: "#FECACA",
    reference: "#FDE68A",
    sell: "#FBCFE8",
    bubble: "rgba(255,255,255,0.10)",
    area: "rgba(255,255,255,0.28)",
    avatarBg: "rgba(255,255,255,0.16)",
    series: ["#FFFFFF", "#FDE68A", "#A7F3D0", "#FBCFE8", "#BFDBFE", "#FED7AA"],
    other: "rgba(255,255,255,0.35)",
  },
};

/** Las diez burbujas del símbolo de marca, en un lienzo de 64. */
export const LOGO_CIRCLES: [number, number, number][] = [
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

export const toneColor = (p: Palette, tone?: "positive" | "negative" | "neutral") =>
  tone === "positive" ? p.positive : tone === "negative" ? p.negative : p.text;

export function fontFamily() {
  return getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
}

export function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Parte un texto en como mucho `maxLines` líneas que quepan en `maxWidth`. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
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
export function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number, family: string) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 24 && ctx.measureText(text).width > maxWidth) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

/** Espaciado entre letras con fallback para navegadores sin `letterSpacing`. */
export function setTracking(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

const images = new Map<string, Promise<HTMLImageElement | null>>();

/** Carga una imagen una sola vez por sesión (los logos se reutilizan entre temas y formatos). */
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  let pending = images.get(url);
  if (!pending) {
    pending = loadImageOnce(url);
    images.set(url, pending);
  }
  return pending;
}

async function loadImageOnce(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Símbolo de marca. Las burbujas van en un único trazado: con un color translúcido no se oscurecen donde se cruzan. */
export function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const [cx, cy, r] of LOGO_CIRCLES) {
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
  ctx.fill("nonzero");
  ctx.restore();
}

export function drawLockup(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, size: number, family: string) {
  drawMark(ctx, x, y, size, p.accent);
  ctx.fillStyle = p.text;
  ctx.font = `500 ${Math.round(size * 0.62)}px ${family}`;
  setTracking(ctx, -1);
  ctx.textBaseline = "middle";
  ctx.fillText("cúmulo", x + size * 1.02, y + size / 2 + 2);
  ctx.textBaseline = "alphabetic";
  setTracking(ctx, 0);
}

export function hairline(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, w: number) {
  ctx.fillStyle = p.hairline;
  ctx.fillRect(x, y, w, 2);
}

function drawLine(ctx: CanvasRenderingContext2D, p: Palette, chart: CardChartLine, x: number, y: number, w: number, h: number, family: string) {
  const values = chart.values;
  if (values.length < 2) return;
  const all = chart.baseline !== undefined ? [...values, chart.baseline] : values;
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (max === min) {
    max += 1;
    min -= 1;
  }
  const pad = (max - min) * 0.1;
  min -= pad;
  max += pad;
  const px = (i: number) => x + (i / (values.length - 1)) * w;
  const py = (v: number) => y + h - ((v - min) / (max - min)) * h;

  // Área: acento → transparente, como en la app.
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, p.area);
  fill.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.moveTo(px(0), py(values[0]));
  values.forEach((v, i) => ctx.lineTo(px(i), py(v)));
  ctx.lineTo(px(values.length - 1), y + h);
  ctx.lineTo(px(0), y + h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  values.forEach((v, i) => (i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v))));
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  if (chart.baseline !== undefined) {
    const by = py(chart.baseline);
    ctx.setLineDash([14, 12]);
    ctx.strokeStyle = p.reference;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, by);
    ctx.lineTo(x + w, by);
    ctx.stroke();
    ctx.setLineDash([]);
    if (chart.baselineLabel) {
      ctx.font = `500 26px ${family}`;
      ctx.fillStyle = p.reference;
      ctx.textAlign = "right";
      const above = by - 44 > y;
      ctx.fillText(chart.baselineLabel, x + w, above ? by - 16 : by + 38);
      ctx.textAlign = "left";
    }
  }

  // Último punto: dónde está hoy.
  const lx = px(values.length - 1);
  const ly = py(values[values.length - 1]);
  ctx.beginPath();
  ctx.arc(lx, ly, 22, 0, Math.PI * 2);
  ctx.fillStyle = p.area;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lx, ly, 10, 0, Math.PI * 2);
  ctx.fillStyle = p.accent;
  ctx.fill();

  const bgSolid = Array.isArray(p.bg) ? p.bg[1] : p.bg;
  for (const m of chart.markers ?? []) {
    const cx = px(m.index);
    const cy = py(values[m.index]);
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = bgSolid;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = m.tone === "sell" ? p.sell : p.accent;
    ctx.stroke();
  }
}

function drawDonut(ctx: CanvasRenderingContext2D, p: Palette, chart: CardChartDonut, x: number, y: number, w: number, h: number, family: string, story: boolean) {
  const rows = chart.slices.slice(0, 6);
  const colorOf = (c: number | "other") => (c === "other" ? p.other : p.series[c % p.series.length]);
  const r = story ? Math.min(h * 0.42, w * 0.27) : Math.min(h / 2, w * 0.2);
  const cx = x + r;
  const cy = y + (story ? Math.max(r, h / 2) : h / 2);
  let angle = -Math.PI / 2;
  const gap = 0.035;
  for (const s of chart.slices) {
    const sweep = s.share * Math.PI * 2;
    const a0 = angle + gap / 2;
    const a1 = angle + Math.max(sweep - gap / 2, gap);
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.arc(cx, cy, r * 0.62, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = colorOf(s.color);
    ctx.fill();
    angle += sweep;
  }
  if (chart.centerValue) {
    ctx.textAlign = "center";
    ctx.fillStyle = p.text;
    ctx.font = `600 ${Math.round(r * 0.36)}px ${family}`;
    ctx.fillText(chart.centerValue, cx, cy + r * 0.08);
    if (chart.centerLabel) {
      ctx.fillStyle = p.muted;
      ctx.font = `500 ${Math.round(r * 0.14)}px ${family}`;
      ctx.fillText(chart.centerLabel, cx, cy + r * 0.3);
    }
    ctx.textAlign = "left";
  }

  // Leyenda a la derecha del donut, como una lista.
  const lx = cx + r + (story ? 64 : 52);
  const lw = x + w - lx;
  const lineH = Math.min(story ? 70 : 56, (h - 8) / rows.length);
  const size = story ? 32 : 28;
  ctx.textBaseline = "middle";
  rows.forEach((s, i) => {
    const ly = cy - ((rows.length - 1) * lineH) / 2 + i * lineH;
    ctx.beginPath();
    ctx.arc(lx + 9, ly, 9, 0, Math.PI * 2);
    ctx.fillStyle = colorOf(s.color);
    ctx.fill();
    ctx.font = `500 ${size}px ${family}`;
    const pct = `${Math.round(s.share * 100)} %`;
    const pctW = ctx.measureText(pct).width;
    ctx.fillStyle = p.text;
    ctx.fillText(fitText(ctx, s.label, lw - 60 - pctW), lx + 32, ly);
    ctx.fillStyle = p.muted;
    ctx.fillText(pct, x + w - pctW, ly);
  });
  ctx.textBaseline = "alphabetic";
}

function drawBars(ctx: CanvasRenderingContext2D, p: Palette, chart: CardChartBars, x: number, y: number, w: number, h: number, family: string) {
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
  const bw = Math.min(54, slot * 0.56);
  const deepest = Math.max(0, ...bars.filter((b) => b.value < 0).map((b) => Math.max(6, Math.abs(b.value) * scaleDown)));
  const labelY = Math.min(y + h - 8, zero + deepest + 42);
  hairline(ctx, p, x, zero - 1, w);
  bars.forEach((b, i) => {
    const bx = x + slot * i + (slot - bw) / 2;
    const up = b.value >= 0;
    const bh = Math.max(6, Math.abs(b.value) * (up ? scaleUp : scaleDown));
    ctx.beginPath();
    ctx.roundRect(bx, up ? zero - bh : zero, bw, bh, 12);
    ctx.fillStyle = up ? p.positive : p.negative;
    ctx.fill();
    ctx.fillStyle = p.muted;
    ctx.font = `500 26px ${family}`;
    ctx.textAlign = "center";
    ctx.fillText(b.label, bx + bw / 2, labelY);
    ctx.textAlign = "left";
  });
}

/** Dibuja la tarjeta y devuelve el canvas (a 2× de resolución). */
export async function renderShareCard(model: CardModel, format: CardFormat, theme: CardTheme = "dark"): Promise<HTMLCanvasElement> {
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
  const p = PALETTES[theme];

  // Fondo y, como motivo, el símbolo enorme recortado en la esquina.
  if (Array.isArray(p.bg)) {
    const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, p.bg[0]);
    g.addColorStop(1, p.bg[1]);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = p.bg;
  }
  ctx.fillRect(0, 0, W, H);
  // Recortado arriba a la derecha: acompaña a la cabecera sin pisar la cifra.
  const markSize = story ? 980 : 720;
  drawMark(ctx, W - markSize * 0.5, -markSize * (story ? 0.36 : 0.42), markSize, p.bubble);

  const M = story ? 96 : 72;
  const innerW = W - M * 2;

  // Cabecera: marca y fecha.
  const headY = story ? 96 : 64;
  const brandSize = story ? 60 : 50;
  drawLockup(ctx, p, M, headY, brandSize, family);
  ctx.fillStyle = p.muted;
  ctx.font = `500 ${story ? 30 : 26}px ${family}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(model.footer, W - M, headY + brandSize / 2 + 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Activo: avatar, etiqueta y título.
  let cursor = headY + brandSize + (story ? 150 : 60);
  const avatar = story ? 112 : 88;
  const img = model.logoUrl ? await loadImage(model.logoUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(M + avatar / 2, cursor + avatar / 2, avatar / 2, 0, Math.PI * 2);
  ctx.fillStyle = img ? "#FFFFFF" : p.avatarBg;
  ctx.fill();
  ctx.clip();
  if (img) {
    // Los logos de las fuentes suelen ser pequeños: algo de aire evita que se vean ampliados.
    const s = avatar * 0.62;
    const ratio = Math.min(s / img.width, s / img.height);
    ctx.drawImage(img, M + (avatar - img.width * ratio) / 2, cursor + (avatar - img.height * ratio) / 2, img.width * ratio, img.height * ratio);
  } else if (model.brandAvatar) {
    const s = avatar * 0.66;
    drawMark(ctx, M + (avatar - s) / 2, cursor + (avatar - s) / 2, s, p.accent);
  } else {
    ctx.fillStyle = p.accent;
    ctx.font = `600 ${Math.round(avatar * 0.3)}px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(model.initials ?? "", M + avatar / 2, cursor + avatar / 2 + 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  const tx = M + avatar + 32;
  const tw = W - M - tx;
  ctx.fillStyle = p.muted;
  ctx.font = `500 ${story ? 30 : 26}px ${family}`;
  ctx.fillText(fitText(ctx, model.eyebrow, tw), tx, cursor + (story ? 40 : 32));
  ctx.fillStyle = p.text;
  const titleSize = story ? 50 : 42;
  ctx.font = `600 ${titleSize}px ${family}`;
  setTracking(ctx, -1);
  const titleLines = wrapText(ctx, model.title, tw, story ? 2 : 1);
  titleLines.forEach((line, i) => ctx.fillText(line, tx, cursor + (story ? 94 : 78) + i * titleSize * 1.12));
  setTracking(ctx, 0);
  cursor += Math.max(avatar, (story ? 94 : 78) + (titleLines.length - 1) * titleSize * 1.12 + 14) + (story ? 120 : 64);

  // Cifra protagonista: enorme y en un solo color.
  if (model.heroLabel) {
    ctx.fillStyle = p.muted;
    ctx.font = `500 ${story ? 34 : 28}px ${family}`;
    ctx.fillText(model.heroLabel, M, cursor);
    cursor += story ? 30 : 20;
  }
  const heroSize = fitFont(ctx, model.hero, 600, story ? 290 : 196, innerW, family);
  setTracking(ctx, -heroSize * 0.04);
  ctx.font = `600 ${heroSize}px ${family}`;
  cursor += heroSize * 0.8;
  ctx.fillStyle = model.tone === "neutral" ? p.text : toneColor(p, model.tone);
  ctx.fillText(model.hero, M - heroSize * 0.04, cursor);
  setTracking(ctx, 0);
  if (model.subtitle) {
    cursor += story ? 76 : 56;
    ctx.fillStyle = p.muted;
    ctx.font = `500 ${story ? 34 : 28}px ${family}`;
    ctx.fillText(fitText(ctx, model.subtitle, innerW), M, cursor);
  }
  cursor += story ? 90 : 44;

  // Cifras clave: lista de dos columnas con filetes; la gráfica ocupa el hueco intermedio.
  const stats = model.stats.slice(0, story ? 6 : 2);
  const cols = 2;
  const rowH = story ? 148 : 124;
  const statRows = Math.ceil(stats.length / cols);
  const footerH = story ? 120 : 0;
  const bottom = H - (story ? 72 : 64) - footerH;
  const statsY = bottom - statRows * rowH;

  if (model.chart) {
    const chartY = cursor;
    const chartH = statsY - chartY - (story ? 80 : 40);
    if (chartH > 120) {
      if (model.chart.kind === "line") drawLine(ctx, p, model.chart, M, chartY, innerW, chartH, family);
      else if (model.chart.kind === "donut") drawDonut(ctx, p, model.chart, M, chartY, innerW, chartH, family, story);
      else drawBars(ctx, p, model.chart, M, chartY, innerW, chartH, family);
    }
  }

  const gap = 48;
  const colW = (innerW - gap) / cols;
  stats.forEach((s, i) => {
    const sx = M + (i % cols) * (colW + gap);
    const sy = statsY + Math.floor(i / cols) * rowH;
    hairline(ctx, p, sx, sy, colW);
    ctx.fillStyle = p.muted;
    ctx.font = `500 ${story ? 28 : 24}px ${family}`;
    ctx.fillText(fitText(ctx, s.label, colW), sx, sy + (story ? 52 : 44));
    ctx.fillStyle = toneColor(p, s.tone);
    const size = fitFont(ctx, s.value, 600, story ? 50 : 42, colW, family);
    ctx.font = `600 ${size}px ${family}`;
    setTracking(ctx, -0.5);
    ctx.fillText(s.value, sx, sy + (story ? 112 : 96));
    setTracking(ctx, 0);
  });

  // Pie: lema de la marca (solo en historia).
  if (story) {
    const fy = H - 72 - 40;
    hairline(ctx, p, M, fy - 56, innerW);
    ctx.fillStyle = p.muted;
    ctx.font = `500 28px ${family}`;
    ctx.fillText("Tus inversiones, sin humo", M, fy);
    drawMark(ctx, W - M - 40, fy - 30, 40, p.accent);
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
