import Decimal from "decimal.js";
import { allocationByAsset } from "@/domain/allocation";
import type { ClosePoint } from "@/domain/history";
import type { Asset, Transaction } from "@/domain/models";
import { annualReturn, buyDetail, sellDetail } from "@/domain/performance";
import { sortTransactions } from "@/domain/portfolio";
import { daysBetween } from "@/domain/returns";
import { priceSeriesWithTrades } from "@/domain/trade-markers";
import { fetchHistory } from "@/hooks/use-price-histories";
import type { PortfolioData } from "@/hooks/use-portfolio";
import { formatCurrency, formatDate, formatNumber, formatPercent, formatQuantity, todayIso } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/lib/labels";
import type { YearSummary } from "@/domain/year";
import type { CardChartLine, CardModel } from "./share-card";

export interface ShareOptions {
  /** Si es false, la tarjeta solo lleva porcentajes y precios públicos. */
  showAmounts: boolean;
}

/** Colores de la paleta de series en tema oscuro (las tarjetas siempre son oscuras). */
const PALETTE = ["#A78BFA", "#FACC15", "#34D399", "#F472B6", "#60A5FA", "#FB923C"];
const OTHER = "#8B8A9B";
const MAX_POINTS = 160;

const tone = (v: Decimal | null | undefined): CardModel["tone"] =>
  !v || v.isZero() ? "neutral" : v.isPositive() ? "positive" : "negative";
const statTone = (v: Decimal | null | undefined) => (!v || v.isZero() ? undefined : v.isPositive() ? ("positive" as const) : ("negative" as const));
const money = (v: Decimal | string, signed = false) => formatCurrency(v, { reveal: true, signed });
const footer = () => formatDate(todayIso());
const logoUrl = (asset: Asset) =>
  asset.priceSource !== "manual" && asset.priceSourceId ? `/api/logo?key=${encodeURIComponent(`${asset.priceSource}:${asset.priceSourceId}`)}` : undefined;
const initials = (asset: Asset) => (asset.ticker || asset.name).replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();

const minusDays = (iso: string, days: number) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

async function closesFor(asset: Asset, from: string): Promise<ClosePoint[]> {
  if (asset.priceSource === "manual" || !asset.priceSourceId) return [];
  try {
    return await fetchHistory(asset, minusDays(from, 7));
  } catch {
    return [];
  }
}

/** Serie de precios con marcadores, reducida a como mucho MAX_POINTS puntos. */
function lineChart(
  closes: ClosePoint[],
  trades: Transaction[],
  current: Decimal | null,
  from: string,
  to?: string,
  baseline?: Decimal | null,
  baselineLabel?: string,
): CardChartLine | undefined {
  const series = priceSeriesWithTrades(
    to ? closes.filter((p) => p.date <= to) : closes,
    trades,
    current && !to ? { date: todayIso(), price: current } : undefined,
    from,
  );
  if (series.points.length < 2) return undefined;
  const step = Math.max(1, Math.ceil(series.points.length / MAX_POINTS));
  const sampled = series.points.filter((_, i) => i % step === 0 || i === series.points.length - 1);
  const indexOf = (date: string) => {
    const exact = series.points.findIndex((p) => p.date === date);
    return Math.min(sampled.length - 1, Math.round(exact / step));
  };
  return {
    kind: "line",
    values: sampled.map((p) => Number(p.close.toFixed(6))),
    markers: series.markers.map((m) => ({ index: indexOf(m.date), tone: m.type })),
    baseline: baseline ? Number(baseline.toFixed(6)) : undefined,
    baselineLabel,
  };
}

export async function buildPositionCard(data: PortfolioData, assetId: string, { showAmounts }: ShareOptions): Promise<CardModel> {
  const asset = data.assets.get(assetId)!;
  const valuation = data.valuation.positions.find((p) => p.position.assetId === assetId);
  const position = valuation?.position ?? data.state.positions.get(assetId)!;
  const trades = sortTransactions(data.transactions.filter((t) => t.assetId === assetId && (t.type === "buy" || t.type === "sell")));
  const first = trades[0]?.date.slice(0, 10) ?? todayIso();
  const closes = await closesFor(asset, first);
  const open = position.quantity.gt(0);
  const pct = open ? valuation?.unrealizedPct ?? null : position.realizedGain.div(Decimal.max(position.saleProceeds.minus(position.realizedGain), 1));
  const annual = annualReturn(trades, valuation?.marketValue ?? new Decimal(0), todayIso());

  const stats: CardModel["stats"] = [
    { label: "Precio actual", value: valuation?.price ? money(valuation.price) : "—" },
    { label: "Mi precio medio", value: open ? money(position.averageCost) : "—" },
    { label: "Rentabilidad anual", value: annual ? formatPercent(annual) : "Menos de 1 año", tone: statTone(annual) },
    { label: "Peso en la cartera", value: valuation?.weight ? formatPercent(valuation.weight, { signed: false }) : "—" },
  ];
  if (showAmounts) {
    if (valuation?.marketValue) stats.push({ label: "Valor", value: money(valuation.marketValue) });
    if (valuation?.unrealized) stats.push({ label: "Ganancia", value: money(valuation.unrealized, true), tone: statTone(valuation.unrealized) });
  }

  return {
    eyebrow: `Posición · ${ASSET_TYPE_LABELS[asset.type]}`,
    title: asset.name,
    logoUrl: logoUrl(asset),
    initials: initials(asset),
    heroLabel: open ? "Rentabilidad de la posición" : "Resultado de la posición",
    hero: pct ? formatPercent(pct) : "—",
    tone: tone(pct),
    subtitle: `Desde ${formatDate(first)} · ${formatNumber(new Decimal(daysBetween(first, todayIso())), 0)} días${showAmounts ? ` · ${formatQuantity(position.quantity, { reveal: true })} uds` : ""}`,
    chart: lineChart(
      closes,
      trades,
      valuation?.price ?? null,
      first,
      undefined,
      open ? position.averageCost : null,
      open ? `Mi precio medio · ${money(position.averageCost)}` : undefined,
    ),
    stats,
    footer: footer(),
  };
}

export async function buildOperationCard(data: PortfolioData, transaction: Transaction, { showAmounts }: ShareOptions): Promise<CardModel> {
  const asset = data.assets.get(transaction.assetId!)!;
  const valuation = data.valuation.positions.find((p) => p.position.assetId === asset.id);
  const price = valuation?.price ?? null;
  const date = transaction.date.slice(0, 10);
  const trades = data.transactions.filter((t) => t.assetId === asset.id && (t.type === "buy" || t.type === "sell"));

  if (transaction.type === "sell") {
    const d = sellDetail(data.state, transaction)!;
    const firstBuy = sortTransactions(trades)[0]?.date.slice(0, 10) ?? date;
    const closes = await closesFor(asset, firstBuy);
    const qty = new Decimal(transaction.quantity);
    const stats: CardModel["stats"] = [
      { label: "Precio de venta", value: money(transaction.price) },
      { label: "Precio de compra (FIFO)", value: money(d.cost.div(qty)) },
      { label: "Días desde la 1.ª compra", value: formatNumber(new Decimal(daysBetween(firstBuy, date)), 0) },
      { label: "Si no hubiera vendido", value: price ? formatPercent(price.div(transaction.price).minus(1)) : "—", tone: price ? statTone(price.div(transaction.price).minus(1).negated()) : undefined },
    ];
    if (showAmounts) {
      stats.push({ label: "Cobrado", value: money(d.proceeds) });
      stats.push({ label: "Ganancia", value: money(d.gain, true), tone: statTone(d.gain) });
    }
    return {
      eyebrow: `Venta · ${ASSET_TYPE_LABELS[asset.type]}`,
      title: asset.name,
      logoUrl: logoUrl(asset),
      initials: initials(asset),
      heroLabel: "Resultado de la venta",
      hero: d.gainPct ? formatPercent(d.gainPct) : "—",
      tone: tone(d.gainPct),
      subtitle: `Vendí el ${formatDate(date)} a ${money(transaction.price)}`,
      chart: lineChart(closes, trades.filter((t) => t.date.slice(0, 10) <= date), null, firstBuy, date),
      stats,
      footer: footer(),
    };
  }

  const d = buyDetail(data.state, transaction, price, todayIso());
  const closes = await closesFor(asset, date);
  const sinceBuy = price ? price.div(transaction.price).minus(1) : null;
  const stats: CardModel["stats"] = [
    { label: "Precio de compra", value: money(transaction.price) },
    { label: "Precio hoy", value: price ? money(price) : "—" },
    { label: "Días en cartera", value: formatNumber(new Decimal(d.daysHeld), 0) },
    { label: "Rentabilidad anual", value: d.annualized ? formatPercent(d.annualized) : "Menos de 1 año", tone: statTone(d.annualized) },
  ];
  if (showAmounts) {
    stats.push({ label: "Pagué", value: money(d.cost) });
    if (d.currentValue) stats.push({ label: "Vale hoy", value: money(d.currentValue), tone: statTone(d.gain) });
  }
  const hero = d.gainPct ?? sinceBuy;
  return {
    eyebrow: `Compra · ${ASSET_TYPE_LABELS[asset.type]}`,
    title: asset.name,
    logoUrl: logoUrl(asset),
    initials: initials(asset),
    heroLabel: "Desde que compré",
    hero: hero ? formatPercent(hero) : "—",
    tone: tone(hero),
    subtitle: `Compré el ${formatDate(date)} a ${money(transaction.price)}`,
    chart: lineChart(closes, [transaction], price, date),
    stats,
    footer: footer(),
  };
}

export async function buildPortfolioCard(data: PortfolioData, { showAmounts }: ShareOptions): Promise<CardModel> {
  const v = data.valuation;
  const total = data.state.bought.gt(0) ? v.totalGain.div(data.state.bought) : null;
  const annual = annualReturn(data.transactions, v.totalValue, todayIso());
  const first = sortTransactions(data.transactions)[0]?.date.slice(0, 10) ?? todayIso();
  const slices = allocationByAsset(v, 6);
  const ranked = v.positions.filter((p) => p.unrealizedPct).sort((a, b) => b.unrealizedPct!.comparedTo(a.unrealizedPct!));
  const best = ranked[0];
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;

  const stats: CardModel["stats"] = [
    { label: "Rentabilidad anual", value: annual ? formatPercent(annual) : "Menos de 1 año", tone: statTone(annual) },
    { label: "No realizado", value: v.unrealizedPct ? formatPercent(v.unrealizedPct) : "—", tone: statTone(v.unrealizedPct) },
    {
      label: "Mejor posición",
      value: best ? `${data.assets.get(best.position.assetId)?.ticker ?? data.assets.get(best.position.assetId)?.name ?? ""} ${formatPercent(best.unrealizedPct!)}` : "—",
      tone: statTone(best?.unrealizedPct),
    },
    {
      label: "Peor posición",
      value: worst ? `${data.assets.get(worst.position.assetId)?.ticker ?? data.assets.get(worst.position.assetId)?.name ?? ""} ${formatPercent(worst.unrealizedPct!)}` : "—",
      tone: statTone(worst?.unrealizedPct),
    },
  ];
  if (showAmounts) {
    stats.push({ label: "Valor", value: money(v.totalValue) });
    stats.push({ label: "Ganancia total", value: money(v.totalGain, true), tone: statTone(v.totalGain) });
  }

  return {
    eyebrow: "Mi cartera",
    title: `${v.positions.length} ${v.positions.length === 1 ? "posición" : "posiciones"}`,
    brandAvatar: true,
    heroLabel: "Rentabilidad total",
    hero: total ? formatPercent(total) : "—",
    tone: tone(total),
    subtitle: `Desde ${formatDate(first)}`,
    chart: slices.length
      ? {
          kind: "donut",
          centerValue: String(v.positions.length),
          centerLabel: v.positions.length === 1 ? "activo" : "activos",
          slices: slices.map((s, i) => ({
            share: Number(s.share.toFixed(6)),
            color: s.key === "other" ? OTHER : PALETTE[i % PALETTE.length],
            label: s.key === "other" ? "Otros" : (data.assets.get(s.key)?.name ?? "Activo"),
          })),
        }
      : undefined,
    stats,
    footer: footer(),
  };
}

const MONTH_INITIALS = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export async function buildYearCard(data: PortfolioData, s: YearSummary, { showAmounts }: ShareOptions): Promise<CardModel> {
  const pct = s.change?.pct ?? null;
  const best = s.bestBuy ? data.assets.get(s.bestBuy.transaction.assetId!) : undefined;
  const isCurrent = String(s.year) === todayIso().slice(0, 4);
  const stats: CardModel["stats"] = [
    { label: "Meses aportando", value: `${s.activeMonths.length} de ${isCurrent ? Math.max(1, s.months.length) : 12}` },
    { label: "Racha más larga", value: `${s.longestStreak} ${s.longestStreak === 1 ? "mes" : "meses"}` },
    {
      label: "Mejor mes",
      value: s.bestMonth?.pct ? `${MONTHS_SHORT[s.bestMonth.month - 1]} ${formatPercent(s.bestMonth.pct)}` : "—",
      tone: statTone(s.bestMonth?.pct),
    },
    {
      label: "Mejor compra",
      value: s.bestBuy && best ? `${best.ticker ?? best.name} ${formatPercent(s.bestBuy.gainPct)}` : "—",
      tone: statTone(s.bestBuy?.gainPct),
    },
  ];
  if (showAmounts) {
    stats.push({ label: "Aportado", value: money(s.bought) });
    if (s.change) stats.push({ label: "Ganancia del año", value: money(s.change.gain, true), tone: statTone(s.change.gain) });
  }
  return {
    eyebrow: isCurrent ? "Mi año hasta hoy" : "Mi año",
    title: `Mi ${s.year} en cúmulo`,
    brandAvatar: true,
    heroLabel: isCurrent ? "Rentabilidad del año hasta hoy" : "Rentabilidad del año",
    hero: pct ? formatPercent(pct) : "—",
    tone: tone(pct),
    subtitle: `${s.buys} ${s.buys === 1 ? "compra" : "compras"} · ${s.sells} ${s.sells === 1 ? "venta" : "ventas"}`,
    chart: s.months.length
      ? { kind: "bars", bars: s.months.map((m) => ({ label: MONTH_INITIALS[m.month - 1], value: m.pct ? Number(m.pct.times(100).toFixed(2)) : 0 })) }
      : undefined,
    stats,
    footer: footer(),
  };
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
