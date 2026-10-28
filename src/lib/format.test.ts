import { describe, expect, it } from 'vitest';
import {
  DELETED_EXERCISE_NAME,
  exerciseName,
  formatClock,
  formatCount,
  formatDate,
  formatDuration,
  formatRecordSentence,
  formatSessionSummary,
  formatSetValues,
  formatSetsSummary,
  formatShortDate,
  formatWeight,
  normalizeSearch,
  parseDecimalInput,
  parseIntInput,
  restSecondsFor,
  toInputText,
} from './format';
import { DEFAULT_REST_SECONDS, type SetEntry, type Template, type WorkoutSession } from './types';

const MIN = 60_000;
const set = (weight: number, reps: number): SetEntry => ({ weight, reps, done: true });

describe('formatDuration / formatClock', () => {
  it('durée lisible', () => {
    expect(formatDuration(42 * MIN + 30_000)).toBe('42 min');
    expect(formatDuration(65 * MIN)).toBe('1 h 05');
    expect(formatDuration(2 * 60 * MIN)).toBe('2 h 00');
    expect(formatDuration(10_000)).toBe('0 min');
    expect(formatDuration(-5)).toBe('0 min');
    expect(formatDuration(Number.NaN)).toBe('0 min');
  });

  it('chrono', () => {
    expect(formatClock(12 * MIN + 34_000)).toBe('12:34');
    expect(formatClock(5_900)).toBe('00:05');
    expect(formatClock(62 * MIN + 3_000)).toBe('1:02:03');
    expect(formatClock(-1)).toBe('00:00');
  });
});

describe('formatDate', () => {
  it('format français court', () => {
    expect(formatDate(new Date(2026, 9, 27, 18))).toBe('mar. 27 oct. 2026');
    expect(formatDate(new Date(2026, 9, 27, 18).toISOString())).toBe('mar. 27 oct. 2026');
  });
  it('date invalide → chaîne vide', () => expect(formatDate('hier')).toBe(''));
});

describe('formatShortDate', () => {
  it('jour et mois abrégé', () => {
    expect(formatShortDate(new Date(2026, 9, 27, 18))).toBe('27 oct.');
    expect(formatShortDate(new Date(2026, 4, 3).toISOString())).toBe('3 mai');
  });
  it('date invalide → chaîne vide', () => expect(formatShortDate('???')).toBe(''));
});

describe('formatWeight', () => {
  it('virgule française', () => {
    expect(formatWeight(62.5)).toBe('62,5 kg');
    expect(formatWeight(60)).toBe('60 kg');
    expect(formatWeight(0)).toBe('0 kg');
  });
});

describe('formatSetsSummary', () => {
  it('séries identiques', () => {
    expect(formatSetsSummary([set(60, 10), set(60, 10), set(60, 10)])).toBe('3×10 @ 60 kg');
  });
  it('poids du corps', () => expect(formatSetsSummary([set(0, 8), set(0, 8)])).toBe('2×8'));
  it('séries hétérogènes', () => {
    expect(formatSetsSummary([set(60, 10), set(60, 10), set(65, 8)])).toBe('2×10 @ 60 kg · 1×8 @ 65 kg');
  });
  it('vide', () => expect(formatSetsSummary([])).toBe(''));
});

describe('exerciseName', () => {
  const exercises = [{ id: 'squat', name: 'Squat', muscleGroup: 'Jambes' as const, isCustom: false }];
  it('nom connu', () => expect(exerciseName(exercises, 'squat')).toBe('Squat'));
  it('repli', () => expect(exerciseName(exercises, 'x')).toBe(DELETED_EXERCISE_NAME));
});

describe('restSecondsFor', () => {
  const template: Template = {
    id: 't1',
    name: 'T',
    exercises: [{ exerciseId: 'squat', targetSets: 3, targetReps: 5, restSeconds: 180 }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const session: WorkoutSession = { id: 's', templateId: 't1', name: 'T', startedAt: '2026-01-02T00:00:00.000Z', exercises: [] };

  it('repos de la séance type', () => expect(restSecondsFor(session, [template], 'squat')).toBe(180));
  it('exercice hors séance type', () => expect(restSecondsFor(session, [template], 'dips')).toBe(DEFAULT_REST_SECONDS));
  it('séance libre', () => {
    expect(restSecondsFor({ ...session, templateId: undefined }, [template], 'squat')).toBe(DEFAULT_REST_SECONDS);
  });
  it('séance type supprimée', () => expect(restSecondsFor(session, [], 'squat')).toBe(DEFAULT_REST_SECONDS));
});

describe('saisie numérique', () => {
  it('parseDecimalInput accepte virgule et point', () => {
    expect(parseDecimalInput('62,5')).toBe(62.5);
    expect(parseDecimalInput(' 62.5 ')).toBe(62.5);
    expect(parseDecimalInput('62,')).toBe(62);
    expect(parseDecimalInput(',5')).toBe(0.5);
    expect(parseDecimalInput('')).toBeNull();
    expect(parseDecimalInput(',')).toBeNull();
    expect(parseDecimalInput('abc')).toBeNull();
    expect(parseDecimalInput('-3')).toBeNull();
    expect(parseDecimalInput('1,2,3')).toBeNull();
  });

  it('parseIntInput', () => {
    expect(parseIntInput('12')).toBe(12);
    expect(parseIntInput(' 8 ')).toBe(8);
    expect(parseIntInput('8,5')).toBeNull();
    expect(parseIntInput('')).toBeNull();
    expect(parseIntInput('-1')).toBeNull();
  });

  it('toInputText', () => {
    expect(toInputText(62.5)).toBe('62,5');
    expect(toInputText(10)).toBe('10');
  });
});

describe('normalizeSearch', () => {
  it('ignore accents et casse', () => {
    expect(normalizeSearch('  Élévations Latérales ')).toBe('elevations laterales');
    expect(normalizeSearch('développé')).toBe(normalizeSearch('DEVELOPPE'));
  });
});

describe('phrases de séance', () => {
  // Intl fr-FR : séparateur de milliers = espace fine insécable (U+202F).
  const fr = (text: string) => text.replace(/[\u202f\u00a0]/g, ' ');

  it('formatCount accorde à partir de 2', () => {
    expect(formatCount(0, 'série')).toBe('0 série');
    expect(formatCount(1, 'série')).toBe('1 série');
    expect(formatCount(2, 'série')).toBe('2 séries');
    expect(formatCount(3, 'série non validée', 'séries non validées')).toBe('3 séries non validées');
  });

  it('formatSessionSummary : pluriels et milliers à la française', () => {
    expect(formatSessionSummary(5, 18, 6240)).toMatch(/^Séance terminée : 5 exercices, 18 séries, 6[\u202f\u00a0]240 kg soulevés\.$/);
    expect(fr(formatSessionSummary(5, 18, 6240))).toBe('Séance terminée : 5 exercices, 18 séries, 6 240 kg soulevés.');
    expect(formatSessionSummary(1, 1, 500)).toBe('Séance terminée : 1 exercice, 1 série, 500 kg soulevés.');
    expect(formatSessionSummary(1, 1, 0)).toBe('Séance terminée : 1 exercice, 1 série, 0 kg soulevé.');
  });

  it('formatRecordSentence : seul « ! » autorisé, nom en minuscule dans la phrase', () => {
    expect(formatRecordSentence('Développé couché', 82.5)).toBe('Nouveau record en développé couché : 82,5 kg !');
    expect(fr(formatRecordSentence('Squat', 1650, 'volume'))).toBe('Nouveau record de volume en squat : 1 650 kg !');
  });

  it('formatSetValues : « 72,5 kg × 8 », « 8 reps » au poids du corps', () => {
    expect(formatSetValues(72.5, 8)).toBe('72,5 kg × 8');
    expect(formatSetValues(0, 8)).toBe('8 reps');
    expect(formatSetValues(0, 1)).toBe('1 rep');
  });
});
