import { describe, expect, it } from 'vitest';
import { formatTick, labelIndices, layoutChart, niceNumber, niceTicks, scaleLinear, valueTicks } from './chart';

const DIMS = { width: 320, height: 200, padding: { top: 10, right: 10, bottom: 30, left: 40 } };

describe('niceNumber', () => {
  it('arrondit à 1, 2, 5 × 10^n', () => {
    expect(niceNumber(0.7, true)).toBe(1);
    expect(niceNumber(23, true)).toBe(20);
    expect(niceNumber(42, true)).toBe(50);
    expect(niceNumber(8, true)).toBe(10);
    expect(niceNumber(12, false)).toBe(20);
    expect(niceNumber(0.03, false)).toBeCloseTo(0.05);
  });
  it('valeur nulle, négative ou non finie → 1', () => {
    expect(niceNumber(0, true)).toBe(1);
    expect(niceNumber(-5, false)).toBe(1);
    expect(niceNumber(Number.NaN, true)).toBe(1);
  });
});

describe('niceTicks', () => {
  it('graduations régulières qui englobent le domaine', () => {
    const t = niceTicks(57, 103);
    expect(t.ticks).toEqual([40, 60, 80, 100, 120]);
    expect(t.min).toBe(40);
    expect(t.max).toBe(120);
    expect(t.step).toBe(20);
  });
  it('pas décimaux sans erreur d’arrondi', () => {
    expect(niceTicks(0, 1).ticks).toEqual([0, 0.5, 1]);
    expect(niceTicks(0.1, 0.35, 5).ticks).toEqual([0.1, 0.2, 0.3, 0.4]);
  });
  it('min = max : intervalle non nul autour de la valeur', () => {
    const t = niceTicks(60, 60);
    expect(t.min).toBeLessThan(60);
    expect(t.max).toBeGreaterThan(60);
    expect(t.ticks.length).toBeGreaterThanOrEqual(2);
    const zero = niceTicks(0, 0);
    expect(zero.min).toBeLessThan(0);
    expect(zero.max).toBeGreaterThan(0);
  });
  it('bornes inversées ou non finies tolérées', () => {
    expect(niceTicks(100, 0).ticks[0]).toBe(0);
    expect(niceTicks(Number.NaN, Number.NaN).ticks.every(Number.isFinite)).toBe(true);
  });
});

describe('valueTicks', () => {
  it('aucune valeur → domaine par défaut [0, 1]', () => {
    expect(valueTicks([])).toMatchObject({ min: 0, max: 1 });
  });
  it('valeurs positives : jamais sous 0', () => {
    const t = valueTicks([0, 10, 20]);
    expect(t.min).toBe(0);
    expect(t.max).toBeGreaterThanOrEqual(20);
  });
  it('valeurs identiques : marge autour de la valeur', () => {
    const t = valueTicks([80, 80, 80]);
    expect(t.min).toBeLessThan(80);
    expect(t.max).toBeGreaterThan(80);
    expect(t.min).toBeGreaterThanOrEqual(0);
  });
  it('englobe toutes les valeurs', () => {
    const t = valueTicks([62.5, 70, 77.5]);
    expect(t.min).toBeLessThanOrEqual(62.5);
    expect(t.max).toBeGreaterThanOrEqual(77.5);
  });
});

describe('scaleLinear', () => {
  it('projection linéaire (axe inversé possible)', () => {
    expect(scaleLinear(5, 0, 10, 0, 100)).toBe(50);
    expect(scaleLinear(0, 0, 10, 200, 0)).toBe(200);
    expect(scaleLinear(10, 0, 10, 200, 0)).toBe(0);
  });
  it('domaine vide → milieu, sans NaN', () => {
    expect(scaleLinear(3, 3, 3, 0, 100)).toBe(50);
  });
});

describe('formatTick', () => {
  it('compact au-delà de 10 000', () => {
    expect(formatTick(12_500)).toBe('12,5 k');
    expect(formatTick(20_000)).toBe('20 k');
  });
  it('sinon nombre à la française', () => {
    expect(formatTick(2.5)).toBe('2,5');
    expect(formatTick(0.30000000000000004)).toBe('0,3');
  });
});

describe('labelIndices', () => {
  it('tous les indices si peu de points', () => {
    expect(labelIndices(0)).toEqual([]);
    expect(labelIndices(1)).toEqual([0]);
    expect(labelIndices(3)).toEqual([0, 1, 2]);
  });
  it('répartis, premier et dernier inclus', () => {
    expect(labelIndices(10)).toEqual([0, 3, 6, 9]);
  });
});

describe('layoutChart', () => {
  const plot = { left: 40, right: 310, top: 10, bottom: 170 };

  it('0 point : graduations par défaut, aucun point', () => {
    const l = layoutChart([], DIMS);
    expect(l.points).toEqual([]);
    expect(l.xLabels).toEqual([]);
    expect(l.plot).toEqual(plot);
    expect(l.yTicks.length).toBeGreaterThan(0);
  });

  it('1 point : centré horizontalement, coordonnées finies', () => {
    const l = layoutChart([{ date: '2026-10-01T10:00:00Z', value: 80 }], DIMS);
    expect(l.points[0].x).toBe((plot.left + plot.right) / 2);
    expect(Number.isFinite(l.points[0].y)).toBe(true);
    expect(l.points[0].y).toBeGreaterThan(plot.top);
    expect(l.points[0].y).toBeLessThan(plot.bottom);
    expect(l.xLabels).toHaveLength(1);
  });

  it('valeurs identiques : pas de division par zéro', () => {
    const l = layoutChart(
      [
        { date: '2026-10-01', value: 50 },
        { date: '2026-10-08', value: 50 },
      ],
      DIMS,
    );
    expect(l.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(l.points[0].y).toBe(l.points[1].y);
  });

  it('trie par date, axe X proportionnel au temps, axe Y inversé', () => {
    const l = layoutChart(
      [
        { date: '2026-10-21', value: 100 },
        { date: '2026-10-01', value: 60 },
        { date: '2026-10-11', value: 80 },
      ],
      DIMS,
    );
    expect(l.points.map((p) => p.value)).toEqual([60, 80, 100]);
    expect(l.points[0].x).toBe(plot.left);
    expect(l.points[2].x).toBe(plot.right);
    expect(l.points[1].x).toBeCloseTo((plot.left + plot.right) / 2);
    expect(l.points[0].y).toBeGreaterThan(l.points[2].y);
    // Graduations : de bas en haut, dans la zone de tracé
    expect(l.yTicks[0].y).toBe(plot.bottom);
    expect(l.yTicks[l.yTicks.length - 1].y).toBe(plot.top);
  });

  it('étiquettes de dates sans chevauchement, la plus récente conservée', () => {
    const l = layoutChart(
      [
        { date: '2026-01-01', value: 1 },
        { date: '2026-10-29', value: 2 },
        { date: '2026-10-30', value: 3 },
      ],
      DIMS,
    );
    expect(l.xLabels.map((x) => x.date)).toEqual(['2026-01-01', '2026-10-30']);
  });

  it('ignore les points à date invalide ou valeur non finie', () => {
    const l = layoutChart(
      [
        { date: '2026-10-01', value: 60 },
        { date: 'pas une date', value: 70 },
        { date: '2026-10-05', value: Number.NaN },
        { date: '2026-10-06', value: Number.POSITIVE_INFINITY },
        { date: '2026-10-11', value: 80 },
      ],
      DIMS,
    );
    expect(l.points.map((p) => p.value)).toEqual([60, 80]);
    expect(l.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(l.yTicks.every((t) => Number.isFinite(t.value) && Number.isFinite(t.y))).toBe(true);
  });
});
