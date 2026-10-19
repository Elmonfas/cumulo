import {
  drawLockup,
  drawMark,
  fitFont,
  fitText,
  fontFamily,
  loadImage,
  PALETTES,
  SCALE,
  setTracking,
  toneColor,
  W,
  wrapText,
  type CardFormat,
  type CardModel,
  type CardTheme,
  type Palette,
} from "../share-card";

/**
 * Diseño «Órbita» de las tarjetas para compartir (propuesta de Claude Design).
 *
 * Todo gira alrededor de un centro: el logo del activo en medio y la gráfica
 * enrollada a su alrededor (línea radial, donut o reloj de 12 meses), con el
 * símbolo de cúmulo enorme detrás para que la «c» rodee la órbita. Mismas
 * coordenadas (1080 × 1920 / 1080 × 1080), temas y modelo que el diseño
 * editorial de share-card.ts.
 */

interface OrbitExtras {
  /** Fondo del avatar con el símbolo de marca. */
  surface: string;
  /** Color del símbolo sobre ese fondo. */
  markOn: string;
  /** Texto de las iniciales sobre el acento. */
  onAccent: string;
}

const EXTRAS: Record<CardTheme, OrbitExtras> = {
  dark: { surface: "#1C1C25", markOn: "#A78BFA", onAccent: "#0B0A10" },
  light: { surface: "#FFFFFF", markOn: "#7C3AED", onAccent: "#FFFFFF" },
  // En morado el acento es blanco: las iniciales van en morado oscuro.
  violet: { surface: "#FFFFFF", markOn: "#7C3AED", onAccent: "#4C1D95" },
};

type OrbitPalette = Palette & OrbitExtras;

const MONTH_INITIALS = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const solidBg = (p: Palette) => (Array.isArray(p.bg) ? p.bg[1] : p.bg);

function centerText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

/** Rango de la serie con un poco de aire arriba y abajo. */
function range(values: number[], baseline?: number) {
  const all = baseline !== undefined ? [...values, baseline] : values;
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (max === min) {
    max += 1;
    min -= 1;
  }
  const pad = (max - min) * 0.06;
  return { min: min - pad, max: max + pad };
}

async function drawCenter(ctx: CanvasRenderingContext2D, p: OrbitPalette, model: CardModel, cx: number, cy: number, r: number, family: string) {
  const img = model.logoUrl ? await loadImage(model.logoUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (img) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.clip();
    // Los logos de las fuentes suelen ser pequeños: algo de aire evita que se vean ampliados.
    const s = r * 2 * 0.62;
    const ratio = Math.min(s / img.width, s / img.height);
    ctx.drawImage(img, cx - (img.width * ratio) / 2, cy - (img.height * ratio) / 2, img.width * ratio, img.height * ratio);
  } else if (model.brandAvatar) {
    ctx.fillStyle = p.surface;
    ctx.fill();
    const size = r * 1.3;
    drawMark(ctx, cx - size / 2, cy - size / 2, size, p.markOn);
  } else {
    ctx.fillStyle = p.accent;
    ctx.fill();
    const glyph = model.initials ?? "";
    ctx.fillStyle = p.onAccent;
    ctx.font = `600 ${Math.round(r * (glyph.length > 2 ? 0.5 : glyph.length > 1 ? 0.7 : 0.95))}px ${family}`;
    ctx.textBaseline = "middle";
    centerText(ctx, glyph, cx, cy + r * 0.05);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
}

export async function renderOrbitCard(model: CardModel, format: CardFormat, theme: CardTheme = "dark"): Promise<HTMLCanvasElement> {
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
  const p: OrbitPalette = { ...PALETTES[theme], ...EXTRAS[theme] };

  // Fondo.
  if (Array.isArray(p.bg)) {
    const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, p.bg[0]);
    g.addColorStop(1, p.bg[1]);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = p.bg;
  }
  ctx.fillRect(0, 0, W, H);

  // Centro de la órbita y símbolo de marca detrás, para que la «c» la rodee.
  const cx = story ? 540 : 330;
  const cy = story ? 830 : 610;
  const R = story ? 360 : 240;
  const r0 = story ? 180 : 120;
  const logoR = story ? 112 : 76;
  const markSize = story ? 1700 : 1180;
  const s = markSize / 64;
  drawMark(ctx, cx - 32 * s, cy - 34 * s, markSize, p.bubble);

  // Cabecera: marca y fecha.
  const M = story ? 96 : 72;
  const headY = story ? 96 : 64;
  const brand = story ? 56 : 46;
  drawLockup(ctx, p, M, headY, brand, family);
  ctx.fillStyle = p.muted;
  ctx.font = `500 ${story ? 28 : 24}px ${family}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(model.footer, W - M, headY + brand / 2 + 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const chart = model.chart;
  ctx.strokeStyle = p.hairline;
  ctx.lineWidth = 2;

  if (chart?.kind === "line" && chart.values.length > 1) {
    // Línea radial: de −90° + 0,3 rad a −90° + 2π − 0,3 rad, con hueco arriba.
    const v = chart.values;
    const { min, max } = range(v, chart.baseline);
    const a0 = -Math.PI / 2 + 0.3;
    const a1 = -Math.PI / 2 + Math.PI * 2 - 0.3;
    const angle = (i: number) => a0 + (i / (v.length - 1)) * (a1 - a0);
    const radius = (value: number) => r0 + 18 + ((value - min) / (max - min)) * (R - r0 - 18);
    const point = (i: number, r: number): [number, number] => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];

    for (const r of [r0, R]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.stroke();
    }
    const trace = () => {
      ctx.beginPath();
      v.forEach((value, i) => {
        const [x, y] = point(i, radius(value));
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
    };
    trace();
    ctx.arc(cx, cy, r0, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = p.area;
    ctx.fill();

    if (chart.baseline !== undefined) {
      ctx.setLineDash([12, 12]);
      ctx.strokeStyle = p.reference;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, radius(chart.baseline), a0, a1);
      ctx.stroke();
      ctx.setLineDash([]);
      if (chart.baselineLabel) {
        ctx.font = `500 ${story ? 24 : 20}px ${family}`;
        ctx.fillStyle = p.reference;
        centerText(ctx, fitText(ctx, chart.baselineLabel, R * 2), cx, cy - R - (story ? 22 : 16));
      }
    }

    trace();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = story ? 5 : 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    for (const m of chart.markers ?? []) {
      const [x, y] = point(m.index, radius(v[m.index]));
      ctx.beginPath();
      ctx.arc(x, y, story ? 13 : 10, 0, Math.PI * 2);
      ctx.fillStyle = solidBg(p);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = m.tone === "sell" ? p.sell : p.accent;
      ctx.stroke();
    }
    const [ex, ey] = point(v.length - 1, radius(v[v.length - 1]));
    ctx.beginPath();
    ctx.arc(ex, ey, story ? 20 : 15, 0, Math.PI * 2);
    ctx.fillStyle = p.area;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex, ey, story ? 10 : 8, 0, Math.PI * 2);
    ctx.fillStyle = p.accent;
    ctx.fill();
  } else if (chart?.kind === "donut") {
    const color = (c: number | "other") => (c === "other" ? p.other : p.series[c % p.series.length]);
    // En cuadrado el anillo es algo menor para que los % no choquen con la columna de texto.
    const ro = story ? R - 40 : R - 36;
    const ri = ro * 0.7;
    let a = -Math.PI / 2;
    for (const slice of chart.slices) {
      const sweep = slice.share * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, ro, a + 0.02, a + sweep - 0.02);
      ctx.arc(cx, cy, ri, a + sweep - 0.02, a + 0.02, true);
      ctx.closePath();
      ctx.fillStyle = color(slice.color);
      ctx.fill();
      if (slice.share >= 0.08) {
        const mid = a + sweep / 2;
        const lx = cx + Math.cos(mid) * (ro + (story ? 28 : 22));
        const ly = cy + Math.sin(mid) * (ro + (story ? 28 : 22));
        const right = Math.cos(mid) >= 0;
        ctx.textAlign = right ? "left" : "right";
        ctx.textBaseline = "middle";
        ctx.font = `600 ${story ? 30 : 24}px ${family}`;
        ctx.fillStyle = p.text;
        ctx.fillText(`${Math.round(slice.share * 100)} %`, lx, ly);
        if (story) {
          const room = right ? W - 56 - lx : lx - 56;
          ctx.font = `500 22px ${family}`;
          ctx.fillStyle = p.muted;
          ctx.fillText(fitText(ctx, slice.label, Math.max(60, room)), lx, ly + 30);
        }
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
      a += sweep;
    }
  } else if (chart?.kind === "bars") {
    // Reloj de 12 meses: subidas hacia fuera desde r0, bajadas hacia dentro.
    const bars = chart.bars;
    const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
    ctx.beginPath();
    ctx.arc(cx, cy, r0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / 12;
      const c = Math.cos(angle);
      const sn = Math.sin(angle);
      const bar = bars[i];
      ctx.fillStyle = p.muted;
      ctx.font = `500 ${story ? 24 : 20}px ${family}`;
      ctx.textBaseline = "middle";
      centerText(ctx, MONTH_INITIALS[i], cx + c * (R + 26), cy + sn * (R + 26));
      ctx.textBaseline = "alphabetic";
      if (!bar) {
        ctx.beginPath();
        ctx.arc(cx + c * r0, cy + sn * r0, 6, 0, Math.PI * 2);
        ctx.fillStyle = p.hairline;
        ctx.fill();
        continue;
      }
      const up = bar.value >= 0;
      const length = up ? (bar.value / max) * (R - r0 - 20) : (Math.abs(bar.value) / max) * (r0 - logoR - 22);
      const rB = up ? r0 + Math.max(4, length) : r0 - Math.max(4, length);
      ctx.beginPath();
      ctx.moveTo(cx + c * r0, cy + sn * r0);
      ctx.lineTo(cx + c * rB, cy + sn * rB);
      ctx.strokeStyle = up ? p.positive : p.negative;
      ctx.lineWidth = story ? 34 : 24;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }

  await drawCenter(ctx, p, model, cx, cy, logoR, family);

  if (story) {
    // Arriba: etiqueta y título centrados.
    ctx.fillStyle = p.muted;
    ctx.font = `500 28px ${family}`;
    centerText(ctx, fitText(ctx, model.eyebrow, W - 2 * M), W / 2, 228);
    ctx.fillStyle = p.text;
    ctx.font = `600 46px ${family}`;
    setTracking(ctx, -1);
    wrapText(ctx, model.title, W - 2 * M, 2).forEach((line, i) => centerText(ctx, line, W / 2, 290 + i * 52));
    setTracking(ctx, 0);

    // Debajo de la órbita: cifra protagonista y subtítulo.
    let y = cy + R + 118;
    if (model.heroLabel) {
      ctx.fillStyle = p.muted;
      ctx.font = `500 28px ${family}`;
      centerText(ctx, fitText(ctx, model.heroLabel, W - 2 * M), W / 2, y);
    }
    const heroSize = fitFont(ctx, model.hero, 600, 128, W - 2 * M, family);
    y += 24 + heroSize * 0.74;
    ctx.font = `600 ${heroSize}px ${family}`;
    setTracking(ctx, -heroSize * 0.03);
    ctx.fillStyle = toneColor(p, model.tone);
    centerText(ctx, model.hero, W / 2, y);
    setTracking(ctx, 0);
    if (model.subtitle) {
      y += 62;
      ctx.fillStyle = p.muted;
      ctx.font = `500 26px ${family}`;
      centerText(ctx, fitText(ctx, model.subtitle, W - 2 * M), W / 2, y);
    }

    // Cifras clave en retícula centrada.
    const stats = model.stats.slice(0, 6);
    const cols = stats.length > 4 ? 3 : 2;
    const cw = (W - 2 * M) / cols;
    const top = y + 64;
    stats.forEach((stat, i) => {
      const x = M + (i % cols) * cw;
      const sy = top + Math.floor(i / cols) * 122;
      ctx.fillStyle = p.hairline;
      ctx.fillRect(x + 12, sy, cw - 24, 2);
      ctx.fillStyle = p.muted;
      ctx.font = `500 24px ${family}`;
      centerText(ctx, fitText(ctx, stat.label, cw - 24), x + cw / 2, sy + 44);
      ctx.fillStyle = toneColor(p, stat.tone);
      const size = fitFont(ctx, stat.value, 600, 40, cw - 24, family);
      ctx.font = `600 ${size}px ${family}`;
      centerText(ctx, stat.value, x + cw / 2, sy + 96);
    });
  } else {
    // Cuadrada: columna de texto a la derecha de la órbita.
    const x = 640;
    const w = W - M - x;
    let y = 236;
    ctx.fillStyle = p.muted;
    ctx.font = `500 24px ${family}`;
    ctx.fillText(fitText(ctx, model.eyebrow, w), x, y);
    ctx.fillStyle = p.text;
    ctx.font = `600 38px ${family}`;
    setTracking(ctx, -1);
    const titleLines = wrapText(ctx, model.title, w, 2);
    titleLines.forEach((line, i) => ctx.fillText(line, x, y + 52 + i * 44));
    setTracking(ctx, 0);
    y += 52 + (titleLines.length - 1) * 44 + 88;
    if (model.heroLabel) {
      ctx.fillStyle = p.muted;
      ctx.font = `500 22px ${family}`;
      ctx.fillText(fitText(ctx, model.heroLabel, w), x, y);
    }
    const heroSize = fitFont(ctx, model.hero, 600, 92, w, family);
    y += 16 + heroSize * 0.74;
    ctx.font = `600 ${heroSize}px ${family}`;
    ctx.fillStyle = toneColor(p, model.tone);
    ctx.fillText(model.hero, x - 3, y);
    if (model.subtitle) {
      ctx.fillStyle = p.muted;
      ctx.font = `500 22px ${family}`;
      wrapText(ctx, model.subtitle, w, 2).forEach((line, i) => ctx.fillText(line, x, y + 48 + i * 30));
    }
    model.stats.slice(0, 2).forEach((stat, i) => {
      const sy = H - 72 - (2 - i) * 112;
      ctx.fillStyle = p.hairline;
      ctx.fillRect(x, sy, w, 2);
      ctx.fillStyle = p.muted;
      ctx.font = `500 22px ${family}`;
      ctx.fillText(fitText(ctx, stat.label, w), x, sy + 40);
      ctx.fillStyle = toneColor(p, stat.tone);
      const size = fitFont(ctx, stat.value, 600, 38, w, family);
      ctx.font = `600 ${size}px ${family}`;
      ctx.fillText(stat.value, x, sy + 88);
    });
  }

  return canvas;
}
