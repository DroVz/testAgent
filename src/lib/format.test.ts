import { describe, expect, it } from 'vitest';
import {
  DELETED_EXERCISE_NAME,
  exerciseName,
  formatClock,
  formatCount,
  formatDate,
  formatDuration,
  formatEstimatedDuration,
  formatGoalOption,
  formatGoalSaved,
  formatLastDone,
  formatMilestone,
  formatMonthName,
  formatPeriodSummary,
  formatWeekLine,
  formatWeekTile,
  formatWeekTileLabel,
  formatOneRepMax,
  formatProgressSentence,
  formatRecordSentence,
  formatSeconds,
  formatSessionSummary,
  formatSetValues,
  formatSetsSummary,
  formatShortDate,
  formatWeight,
  inSentence,
  normalizeSearch,
  parseDecimalInput,
  parseIntInput,
  restSecondsFor,
  roundOneRepMax,
  toInputText,
} from './format';
import { DEFAULT_REST_SECONDS, type SetEntry, type Template, type WorkoutSession } from './types';

const MIN = 60_000;
const set = (weight: number, reps: number): SetEntry => ({ weight, reps, done: true });
/** « ~ » = espace insécable attendue entre un nombre et son unité. */
const u = (text: string) => text.replace(/~/g, '\u00a0');

describe('formatDuration / formatClock', () => {
  it('durée lisible', () => {
    expect(formatDuration(42 * MIN + 30_000)).toBe(u('42~min'));
    expect(formatDuration(65 * MIN)).toBe(u('1~h~05'));
    expect(formatDuration(2 * 60 * MIN)).toBe(u('2~h~00'));
    expect(formatDuration(MIN)).toBe(u('1~min'));
    // Jamais « 0 min » : moins d'une minute s'écrit « < 1 min ».
    expect(formatDuration(10_000)).toBe(u('<~1~min'));
    expect(formatDuration(-5)).toBe(u('<~1~min'));
    expect(formatDuration(Number.NaN)).toBe(u('<~1~min'));
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
    expect(formatWeight(62.5)).toBe(u('62,5~kg'));
    expect(formatWeight(60)).toBe(u('60~kg'));
    expect(formatWeight(0)).toBe(u('0~kg'));
  });
});

describe('formatSetsSummary', () => {
  it('séries identiques', () => {
    expect(formatSetsSummary([set(60, 10), set(60, 10), set(60, 10)])).toBe(u('3×10 @ 60~kg'));
  });
  it('poids du corps', () => expect(formatSetsSummary([set(0, 8), set(0, 8)])).toBe('2×8'));
  it('séries hétérogènes', () => {
    expect(formatSetsSummary([set(60, 10), set(60, 10), set(65, 8)])).toBe(u('2×10 @ 60~kg · 1×8 @ 65~kg'));
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
    expect(formatCount(0, 'série')).toBe(u('0~série'));
    expect(formatCount(1, 'série')).toBe(u('1~série'));
    expect(formatCount(2, 'série')).toBe(u('2~séries'));
    expect(formatCount(3, 'série non validée', 'séries non validées')).toBe(u('3~séries non validées'));
  });

  it('formatSessionSummary : pluriels et milliers à la française', () => {
    expect(formatSessionSummary(5, 18, 6240)).toMatch(/^Séance terminée : 5\u00a0exercices, 18\u00a0séries, 6\u202f240\u00a0kg soulevés\.$/);
    expect(fr(formatSessionSummary(5, 18, 6240))).toBe('Séance terminée : 5 exercices, 18 séries, 6 240 kg soulevés.');
    expect(formatSessionSummary(1, 1, 500)).toBe(u('Séance terminée~: 1~exercice, 1~série, 500~kg soulevés.'));
    expect(formatSessionSummary(1, 1, 0)).toBe(u('Séance terminée~: 1~exercice, 1~série, 0~kg soulevé.'));
  });

  it('formatRecordSentence : seul « ! » autorisé, nom en minuscule dans la phrase', () => {
    expect(formatRecordSentence('Développé couché', 82.5)).toBe(u('Nouveau record en développé couché~: 82,5~kg\u202f!'));
    // Valeur déjà formatée (1RM arrondi à 0,5 kg)
    expect(formatRecordSentence('Squat', formatOneRepMax(128.33), '1RM estimé')).toBe(
      u('Nouveau record de 1RM estimé en squat~: 128,5~kg\u202f!'),
    );
    // Un sigle en tête garde ses capitales
    expect(formatRecordSentence('RDL roumain', 100)).toBe(u('Nouveau record en RDL roumain~: 100~kg\u202f!'));
    expect(fr(formatRecordSentence('Squat', 1650, 'volume'))).toBe('Nouveau record de volume en squat : 1 650 kg !');
  });

  it('« : » et « ! » jamais seuls en début de ligne : espaces insécables devant (U+00A0, fine U+202F)', () => {
    const sentences = [
      formatRecordSentence('Rowing barre', 62.5),
      formatRecordSentence('Squat', formatOneRepMax(128.33), '1RM estimé'),
      formatSessionSummary(5, 18, 6240),
    ];
    for (const text of sentences) {
      // Aucune espace sécable (coupure possible) juste avant « : » ou « ! ».
      expect(text).not.toMatch(/[ \t\n][:!]/);
      // Les points de coupure (espaces simples) ne laissent jamais une ligne commencer par « : » ou « ! ».
      for (const line of text.split(' ').slice(1)) expect(line).not.toMatch(/^[:!]/);
    }
    expect(formatRecordSentence('Rowing barre', 62.5)).toMatch(/\u00a0: 62,5\u00a0kg\u202f!$/);
  });

  it('formatSetValues : « 72,5 kg × 8 », « 8 reps » au poids du corps', () => {
    expect(formatSetValues(72.5, 8)).toBe(u('72,5~kg × 8'));
    expect(formatSetValues(0, 8)).toBe(u('8~reps'));
    expect(formatSetValues(0, 1)).toBe(u('1~rep'));
  });
});

describe('inSentence', () => {
  it('met la première lettre en minuscule', () => {
    expect(inSentence('Développé couché')).toBe('développé couché');
    expect(inSentence('Squat')).toBe('squat');
    expect(inSentence('A')).toBe('a');
  });
  it('laisse un sigle tel quel', () => {
    expect(inSentence('RDL')).toBe('RDL');
    expect(inSentence('RDL roumain')).toBe('RDL roumain');
    expect(inSentence('EZ-bar curl')).toBe('EZ-bar curl');
    expect(inSentence('Élévations')).toBe('élévations');
  });
});

describe('1RM arrondi à 0,5 kg', () => {
  it('roundOneRepMax / formatOneRepMax', () => {
    expect(roundOneRepMax(128.33)).toBe(128.5);
    expect(roundOneRepMax(120.2)).toBe(120);
    expect(roundOneRepMax(120.25)).toBe(120.5);
    expect(roundOneRepMax(Number.NaN)).toBe(0);
    expect(formatOneRepMax(120.33)).toBe(u('120,5~kg'));
    expect(formatOneRepMax(91.8)).toBe(u('92~kg'));
  });
});

describe('unités', () => {
  it('formatSeconds', () => expect(formatSeconds(90)).toBe(u('90~s')));
  it('formatEstimatedDuration', () => {
    expect(formatEstimatedDuration(45)).toBe(u('≈~45~min'));
    expect(formatEstimatedDuration(75)).toBe(u('≈~1~h~15'));
  });
});

describe('formatLastDone', () => {
  const now = new Date(2026, 9, 28, 12, 0);
  it('jamais faite', () => {
    expect(formatLastDone(undefined, now)).toBe('Jamais faite');
    expect(formatLastDone('pas une date', now)).toBe('Jamais faite');
  });
  it('« Faite … » : jours calendaires, puis semaines, puis mois', () => {
    expect(formatLastDone(new Date(2026, 9, 28, 7, 0), now)).toBe('Faite aujourd’hui');
    expect(formatLastDone(new Date(2026, 9, 27, 23, 0), now)).toBe('Faite hier');
    expect(formatLastDone(new Date(2026, 9, 25, 18, 0).toISOString(), now)).toBe(u('Faite il y a 3~jours'));
    expect(formatLastDone(new Date(2026, 9, 15), now)).toBe(u('Faite il y a 13~jours'));
    expect(formatLastDone(new Date(2026, 9, 14), now)).toBe(u('Faite il y a 2~semaines'));
    expect(formatLastDone(new Date(2026, 6, 1), now)).toBe(u('Faite il y a 3~mois'));
  });
});

describe('formatProgressSentence', () => {
  const p = (date: Date, value: number) => ({ date: date.toISOString(), value });
  const start = new Date(2026, 8, 1, 18);
  const weeks = (n: number) => new Date(2026, 8, 1 + 7 * n, 18);
  const now = new Date(2026, 9, 28, 20);

  it('aucun point → null ; un point → « Première séance enregistrée »', () => {
    expect(formatProgressSentence([])).toBeNull();
    expect(formatProgressSentence([p(start, 80)])).toEqual({ headline: 'Première séance enregistrée' });
  });

  it('hausse : « +7,5 kg en 8 semaines » (première vs dernière valeur)', () => {
    expect(formatProgressSentence([p(start, 80), p(weeks(4), 70), p(weeks(8), 87.5)], undefined, undefined, now)).toEqual({
      headline: u('+7,5~kg en 8~semaines'),
    });
  });

  it('période courte : en jours', () => {
    expect(formatProgressSentence([p(start, 80), p(new Date(2026, 8, 4, 18), 82.5)], undefined, undefined, now)?.headline).toBe(
      u('+2,5~kg en 3~jours'),
    );
    expect(formatProgressSentence([p(start, 80), p(new Date(2026, 8, 2, 9), 82.5)], undefined, undefined, now)?.headline).toBe(
      u('+2,5~kg en 1~jour'),
    );
  });

  it('deux points le même jour : « aujourd’hui » si c’est aujourd’hui, sinon « le même jour »', () => {
    const today = [p(new Date(2026, 9, 28, 9), 80), p(new Date(2026, 9, 28, 18), 85)];
    expect(formatProgressSentence(today, undefined, undefined, now)?.headline).toBe(u('+5~kg aujourd’hui'));
    const past = [p(start, 80), p(new Date(2026, 8, 1, 20), 85)];
    expect(formatProgressSentence(past, undefined, undefined, now)?.headline).toBe(u('+5~kg le même jour'));
    expect(formatProgressSentence([p(start, 80), p(new Date(2026, 8, 1, 20), 80)], undefined, undefined, now)?.headline).toBe(
      'Stable le même jour',
    );
    expect(formatProgressSentence(today, undefined, undefined, now)?.headline).not.toMatch(/en 1/);
  });

  it('stagnation : « Stable depuis 4 semaines »', () => {
    expect(formatProgressSentence([p(start, 80), p(weeks(2), 85), p(weeks(4), 80)], undefined, undefined, now)).toEqual({
      headline: u('Stable depuis 4~semaines'),
    });
  });

  it('baisse : le chiffre seul en titre, la relativisation à part, sans culpabiliser', () => {
    const summary = formatProgressSentence([p(start, 85), p(weeks(3), 80)], undefined, undefined, now);
    expect(summary).toEqual({ headline: u('−5~kg en 3~semaines'), note: 'Ça arrive, la prochaine séance compte.' });
    expect(`${summary?.headline} ${summary?.note}`).not.toMatch(/!|échec|raté|dommage/i);
  });

  it('arrondi de la métrique appliqué avant comparaison (1RM à 0,5 kg)', () => {
    // 100,1 et 100,2 s'affichent tous deux « 100 kg » : stable, pas « +0,1 kg ».
    expect(formatProgressSentence([p(start, 100.1), p(weeks(1), 100.2)], formatOneRepMax, roundOneRepMax, now)?.headline).toBe(
      u('Stable depuis 1~semaine'),
    );
    expect(formatProgressSentence([p(start, 116.4), p(weeks(2), 120.1)], formatOneRepMax, roundOneRepMax, now)?.headline).toBe(
      u('+3,5~kg en 2~semaines'),
    );
  });
});

describe('rythme (lot 3)', () => {
  /** « ~ » = espace insécable (U+00A0), « _ » = espace fine insécable (U+202F, milliers). */
  const t = (text: string) => text.replace(/~/g, ' ').replace(/_/g, ' ');

  it('formatWeekLine : les 10 textes du §3.1, insécables avant « : » et « séance(s) »', () => {
    const cases: [number | undefined, number, string | undefined][] = [
      [undefined, 0, undefined],
      [undefined, 1, 'Cette semaine~: 1~séance.'],
      [undefined, 4, 'Cette semaine~: 4~séances.'],
      [3, 0, 'Objectif de la semaine~: 3~séances.'],
      [1, 0, 'Objectif de la semaine~: 1~séance.'],
      [3, 1, 'Cette semaine~: 1~séance sur 3.'],
      [3, 2, 'Cette semaine~: 2~séances sur 3.'],
      [3, 3, 'Cette semaine~: 3~séances sur 3. Objectif atteint.'],
      [1, 1, 'Cette semaine~: 1~séance sur 1. Objectif atteint.'],
      [3, 4, 'Cette semaine~: 4~séances. Objectif de 3 atteint.'],
    ];
    for (const [goal, count, expected] of cases) {
      expect(formatWeekLine(count, goal), `${goal}/${count}`).toBe(expected === undefined ? undefined : t(expected));
    }
  });

  it('changement d’objectif en cours de semaine : effet immédiat (§7)', () => {
    expect(formatWeekLine(2, 2)).toBe(t('Cette semaine~: 2~séances sur 2. Objectif atteint.'));
    expect(formatWeekLine(2, 4)).toBe(t('Cette semaine~: 2~séances sur 4.'));
    expect(formatWeekLine(2, undefined)).toBe(t('Cette semaine~: 2~séances.'));
  });

  it('tuile « Cette semaine » : « 2 sur 3 », nombre seul sans objectif ou au-delà', () => {
    expect(formatWeekTile(2)).toBe('2');
    expect(formatWeekTile(2, 3)).toBe('2 sur 3');
    expect(formatWeekTile(0, 3)).toBe('0 sur 3');
    expect(formatWeekTile(4, 3)).toBe('4');
    expect(formatWeekTileLabel(2, 3)).toBe(t('2~séances sur 3'));
    expect(formatWeekTileLabel(4, 3)).toBe(t('4~séances'));
  });

  it('formatPeriodSummary : les 4 exemples du §3.2, segments à 0 omis', () => {
    expect(formatPeriodSummary('Semaine dernière', { count: 3, volume: 14520, records: 1 })).toBe(
      t('Semaine dernière~: 3~séances, 14_520~kg, 1~record.'),
    );
    expect(formatPeriodSummary('Octobre', { count: 11, volume: 52300, records: 4 })).toBe(
      t('Octobre~: 11~séances, 52_300~kg, 4~records.'),
    );
    expect(formatPeriodSummary('Semaine dernière', { count: 1, volume: 3200, records: 0 })).toBe(
      t('Semaine dernière~: 1~séance, 3_200~kg.'),
    );
    expect(formatPeriodSummary('Semaine dernière', { count: 2, volume: 0, records: 0 })).toBe(
      t('Semaine dernière~: 2~séances.'),
    );
    // Volume arrondi comme formatWeight (pas de décimale inutile).
    expect(formatPeriodSummary('Novembre', { count: 1, volume: 1012.5, records: 0 })).toBe(
      t('Novembre~: 1~séance, 1_012,5~kg.'),
    );
  });

  it('formatMonthName : en toutes lettres, majuscule initiale, sans année', () => {
    expect(formatMonthName(new Date(2026, 9, 15))).toBe('Octobre');
    expect(formatMonthName(new Date(2026, 10, 15))).toBe('Novembre');
    expect(formatMonthName(new Date(2026, 11, 15))).toBe('Décembre');
  });

  it('formatMilestone : seuils seulement, « ᵉ » = U+1D49', () => {
    expect(formatMilestone(1)).toBe('Première séance enregistrée. Bienvenue.');
    expect(formatMilestone(10)).toBe('10ᵉ séance enregistrée.');
    expect(formatMilestone(25)).toBe('25ᵉ séance enregistrée.');
    expect(formatMilestone(1000)).toBe(t('1_000ᵉ séance enregistrée.'));
    for (const rank of [2, 11, 75, 150]) expect(formatMilestone(rank), String(rank)).toBeUndefined();
  });

  it('réglage et proposition : noms accessibles et toast', () => {
    expect(formatGoalOption(undefined)).toBe('Aucun objectif');
    expect(formatGoalOption(1)).toBe(t('1~séance par semaine'));
    expect(formatGoalOption(2)).toBe(t('2~séances par semaine'));
    expect(formatGoalSaved(3)).toBe(t('Objectif enregistré~: 3~séances par semaine.'));
    expect(formatGoalSaved(1)).toBe(t('Objectif enregistré~: 1~séance par semaine.'));
  });

  it('aucun vocabulaire d’échec, de taux ni de « ! » (objectif 0–6 × compte 0–8, bilans, jalons)', () => {
    const texts: string[] = [];
    for (const goal of [undefined, 1, 2, 3, 4, 5, 6]) {
      for (let count = 0; count <= 8; count++) {
        const line = formatWeekLine(count, goal);
        if (line) texts.push(line);
        texts.push(formatWeekTile(count, goal), formatWeekTileLabel(count, goal));
        texts.push(formatPeriodSummary('Semaine dernière', { count, volume: count * 1000, records: count % 3 }));
      }
      texts.push(formatGoalOption(goal));
      if (goal) texts.push(formatGoalSaved(goal));
    }
    for (let rank = 1; rank <= 1000; rank++) {
      const milestone = formatMilestone(rank);
      if (milestone) texts.push(milestone);
    }
    for (const text of texts) {
      expect(text).not.toMatch(/!|%|raté|manqué|perdu|en retard|streak|série/i);
    }
  });
});
