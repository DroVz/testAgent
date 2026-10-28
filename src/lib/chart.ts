/**
 * Logique pure des graphiques SVG (échelles, graduations, placement des points).
 * Aucune dépendance au DOM : tout est testable.
 */

export interface Domain {
  min: number;
  max: number;
}

export interface Ticks extends Domain {
  step: number;
  ticks: number[];
}

/** Nombre « joli » (1, 2, 5 × 10^n) proche de `value` (arrondi si `round`, sinon par excès). */
export function niceNumber(value: number, round: boolean): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const fraction = Number.parseFloat((value / magnitude).toPrecision(12));
  let nice: number;
  if (round) nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  else nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
}

/** Arrondit les erreurs de virgule flottante (0.30000000000000004 → 0.3). */
function clean(n: number): number {
  return Number.parseFloat(n.toPrecision(12));
}

/**
 * Graduations « jolies » couvrant [min, max] (environ `count` graduations).
 * Le domaine renvoyé est élargi aux graduations extrêmes. Si min = max, un intervalle
 * non nul est construit autour de la valeur (pas de division par zéro).
 */
export function niceTicks(min: number, max: number, count = 4): Ticks {
  let lo = Number.isFinite(min) ? min : 0;
  let hi = Number.isFinite(max) ? max : lo;
  if (lo > hi) [lo, hi] = [hi, lo];
  if (hi === lo) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    lo -= pad;
    hi += pad;
  }
  const step = niceNumber(niceNumber(hi - lo, false) / Math.max(1, count - 1), true);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let i = 0; start + i * step <= end + step / 2; i++) ticks.push(clean(start + i * step));
  return { min: ticks[0], max: ticks[ticks.length - 1], step, ticks };
}

/**
 * Domaine vertical pour une série de valeurs : marge de 5 % (10 % de la valeur si toutes
 * identiques), sans descendre sous 0 si toutes les valeurs sont positives. Puis graduations jolies.
 */
export function valueTicks(values: number[], count = 4): Ticks {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return niceTicks(0, 1, count);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const pad = max > min ? (max - min) * 0.05 : Math.abs(max) * 0.1 || 1;
  let lo = min - pad;
  const hi = max + pad;
  if (min >= 0) lo = Math.max(0, lo);
  return niceTicks(lo, hi, count);
}

/** Projection linéaire de `value` de [d0, d1] vers [r0, r1] ; milieu si le domaine est vide. */
export function scaleLinear(value: number, d0: number, d1: number, r0: number, r1: number): number {
  if (d1 === d0) return (r0 + r1) / 2;
  return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}

/** Valeur compacte pour un axe : « 12,5 k » au-delà de 10 000, sinon 2 décimales max. */
export function formatTick(value: number): string {
  const nf = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);
  if (Math.abs(value) >= 10_000) return `${nf(Math.round(value / 100) / 10)} k`;
  return nf(clean(value));
}

/** Indices des points à étiqueter sur l'axe X : au plus `max`, répartis, premier et dernier inclus. */
export function labelIndices(length: number, max = 4): number[] {
  if (length <= 0) return [];
  if (length <= max) return Array.from({ length }, (_, i) => i);
  const result = new Set<number>();
  for (let i = 0; i < max; i++) result.add(Math.round((i * (length - 1)) / (max - 1)));
  return [...result];
}

export interface ChartInputPoint {
  /** Date ISO. */
  date: string;
  value: number;
}

export interface ChartDimensions {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface PlacedPoint extends ChartInputPoint {
  x: number;
  y: number;
}

export interface ChartLayout {
  points: PlacedPoint[];
  yTicks: { value: number; y: number }[];
  xLabels: { date: string; x: number }[];
  /** Zone de tracé. */
  plot: { left: number; right: number; top: number; bottom: number };
}

/** Étiquettes X réparties, sans chevauchement (écart ≥ `gap`) ; la plus récente est toujours gardée. */
function spacedLabels(points: PlacedPoint[], gap: number): { date: string; x: number }[] {
  const result: { date: string; x: number }[] = [];
  const indices = labelIndices(points.length);
  for (const i of indices) {
    const label = { date: points[i].date, x: points[i].x };
    const prev = result[result.length - 1];
    if (!prev || label.x - prev.x >= gap) result.push(label);
    else if (i === points.length - 1) result[result.length - 1] = label;
  }
  return result;
}

/**
 * Place les points d'une série temporelle dans la zone de tracé. L'axe X est proportionnel au temps
 * (un seul point, ou toutes les dates identiques → centré). L'axe Y utilise `valueTicks`.
 * Les points dont la date ou la valeur n'est pas finie sont ignorés.
 */
export function layoutChart(
  data: ChartInputPoint[],
  dims: ChartDimensions,
  { tickCount = 4, minLabelGap = 56 }: { tickCount?: number; minLabelGap?: number } = {},
): ChartLayout {
  const plot = {
    left: dims.padding.left,
    right: dims.width - dims.padding.right,
    top: dims.padding.top,
    bottom: dims.height - dims.padding.bottom,
  };
  // Filtre défensif : un point à date illisible ou valeur non finie fausserait les échelles (NaN).
  const sorted = data
    .filter((p) => Number.isFinite(Date.parse(p.date)) && Number.isFinite(p.value))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const times = sorted.map((p) => Date.parse(p.date));
  const t0 = times.length > 0 ? Math.min(...times) : 0;
  const t1 = times.length > 0 ? Math.max(...times) : 0;
  const ticks = valueTicks(sorted.map((p) => p.value), tickCount);

  const points = sorted.map((p, i) => ({
    ...p,
    x: scaleLinear(times[i], t0, t1, plot.left, plot.right),
    y: scaleLinear(p.value, ticks.min, ticks.max, plot.bottom, plot.top),
  }));

  return {
    points,
    yTicks: ticks.ticks.map((value) => ({ value, y: scaleLinear(value, ticks.min, ticks.max, plot.bottom, plot.top) })),
    xLabels: spacedLabels(points, minLabelGap),
    plot,
  };
}
