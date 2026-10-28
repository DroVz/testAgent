import { useMemo } from 'react';
import { formatTick, layoutChart, type ChartDimensions, type ChartInputPoint } from '../lib/chart';
import { formatShortDate } from '../lib/format';

export interface LineChartProps {
  data: ChartInputPoint[];
  /** Titre accessible du graphique (ex. « Poids max — Squat »). */
  label: string;
  /** Format de la valeur mise en évidence (dernier point) et du résumé accessible. */
  formatValue(value: number): string;
}

const DIMS: ChartDimensions = {
  width: 340,
  height: 200,
  // Marges dimensionnées pour des graduations de 14 unités (≥ 13 px affichés à 390 px de large).
  padding: { top: 28, right: 28, bottom: 30, left: 44 },
};

/** Courbe SVG faite main, responsive (viewBox + largeur 100 %). */
export default function LineChart({ data, label, formatValue }: LineChartProps) {
  const layout = useMemo(() => layoutChart(data, DIMS), [data]);

  if (data.length === 0) {
    return <p className="muted chart__empty">Pas encore de données pour cet exercice.</p>;
  }

  const { points, yTicks, xLabels, plot } = layout;
  const last = points[points.length - 1];
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const summary =
    `${label} : ${points.length} séance${points.length > 1 ? 's' : ''}, ` +
    `dernière valeur ${formatValue(last.value)} le ${formatShortDate(last.date)}`;
  // Étiquette de la dernière valeur : alignée à droite si le point est près du bord droit.
  const lastAnchor = last.x > DIMS.width - 60 ? 'end' : last.x < plot.left + 40 ? 'start' : 'middle';

  return (
    <figure className="chart">
      <svg
        className="chart__svg"
        viewBox={`0 0 ${DIMS.width} ${DIMS.height}`}
        width="100%"
        role="img"
        aria-label={summary}
      >
        <g className="chart__grid" aria-hidden="true">
          {yTicks.map((t) => (
            <g key={t.value}>
              <line x1={plot.left} x2={plot.right} y1={t.y} y2={t.y} className="chart__gridline" />
              <text x={plot.left - 6} y={t.y} className="chart__tick chart__tick--y">
                {formatTick(t.value)}
              </text>
            </g>
          ))}
          {xLabels.map((l) => (
            <text key={l.date} x={l.x} y={DIMS.height - 6} className="chart__tick chart__tick--x">
              {formatShortDate(l.date)}
            </text>
          ))}
        </g>
        {points.length > 1 && <path d={path} className="chart__line" />}
        {points.map((p, i) => (
          <circle
            key={`${p.date}-${i}`}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 6 : 3.5}
            className={`chart__point${i === points.length - 1 ? ' chart__point--last' : ''}`}
          />
        ))}
        <text x={last.x} y={last.y - 12} textAnchor={lastAnchor} className="chart__last-label" aria-hidden="true">
          {formatValue(last.value)}
        </text>
      </svg>
    </figure>
  );
}
