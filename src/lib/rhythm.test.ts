import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  countedSessions,
  isMilestone,
  isWeeklyGoal,
  monthRange,
  periodSummary,
  previousWeekRange,
  progressReview,
  sessionRank,
  shouldProposeWeeklyGoal,
  weekCount,
  weekCountAtSession,
  weekRange,
  weeklyGoalOf,
} from './rhythm';
import { detectNewRecords, sessionVolume, strongestRecords } from './stats';
import type { SetEntry, WorkoutSession } from './types';

/*
 * Bornes de semaine et de mois en heure locale : fuseau forcé à Europe/Paris pour ce fichier
 * (changements d'heure les 29 mars et 25 octobre 2026), rétabli ensuite pour ne pas toucher les autres.
 * Les dates sont construites dans les tests, après le changement de fuseau.
 */
let previousTz: string | undefined;
beforeAll(() => {
  previousTz = process.env.TZ;
  process.env.TZ = 'Europe/Paris';
});
afterAll(() => {
  if (previousTz === undefined) delete process.env.TZ;
  else process.env.TZ = previousTz;
});

const set = (weight: number, reps: number, done = true): SetEntry => ({ weight, reps, done });
const at = (y: number, m: number, d: number, h = 10, min = 0) => new Date(y, m - 1, d, h, min);

function session(
  id: string,
  start: Date,
  exercises: Record<string, SetEntry[]> = { squat: [set(100, 5)] },
  end: Date | null = new Date(start.getTime() + 60 * 60_000),
): WorkoutSession {
  return {
    id,
    name: id,
    startedAt: start.toISOString(),
    ...(end !== null && { endedAt: end.toISOString() }),
    exercises: Object.entries(exercises).map(([exerciseId, sets]) => ({ exerciseId, sets })),
  };
}

describe('fuseau du fichier', () => {
  it('Europe/Paris : UTC+1 en hiver, UTC+2 en été', () => {
    expect(at(2026, 1, 15).getTimezoneOffset()).toBe(-60);
    expect(at(2026, 7, 15).getTimezoneOffset()).toBe(-120);
  });
});

describe('séances comptées (critère 1)', () => {
  it('exclut les séances en cours et les séances terminées sans série validée', () => {
    const sessions = [
      session('b', at(2026, 10, 27)),
      session('a', at(2026, 10, 26)),
      session('en-cours', at(2026, 10, 28), undefined, null),
      session('vide', at(2026, 10, 28), {}),
      session('non-validee', at(2026, 10, 28), { squat: [set(100, 5, false)] }),
    ];
    expect(countedSessions(sessions).map((s) => s.id)).toEqual(['a', 'b']);
    expect(weekCount(sessions, at(2026, 10, 29))).toBe(2);
  });
});

describe('bornes de semaine, heure locale (critère 2)', () => {
  // Semaine sans changement d'heure : lundi 9 → dimanche 15 novembre 2026.
  const sunday = at(2026, 11, 15, 12);
  const monday = at(2026, 11, 16, 12);

  it('la semaine va du lundi 00:00 au lundi suivant 00:00 (exclu)', () => {
    expect(weekRange(sunday)).toEqual({ from: at(2026, 11, 9, 0), to: at(2026, 11, 16, 0) });
    expect(weekRange(at(2026, 11, 16, 0, 0))).toEqual({ from: at(2026, 11, 16, 0), to: at(2026, 11, 23, 0) });
  });

  it('dimanche 23:59 compte pour sa semaine, lundi 00:00 pour la nouvelle', () => {
    const sessions = [session('dim', at(2026, 11, 15, 23, 59)), session('lun', at(2026, 11, 16, 0, 0))];
    expect(weekCount(sessions, sunday)).toBe(1);
    expect(weekCount(sessions, monday)).toBe(1);
    expect(countedSessions(sessions).filter((s) => weekCount([s], sunday) === 1).map((s) => s.id)).toEqual(['dim']);
  });

  it('commencée dimanche 23:30, terminée lundi 00:40 : semaine du dimanche', () => {
    const late = session('cheval', at(2026, 11, 15, 23, 30), undefined, at(2026, 11, 16, 0, 40));
    expect(weekCount([late], sunday)).toBe(1);
    expect(weekCount([late], monday)).toBe(0);
    // Son récap rouvert le lundi : pas de ligne de semaine (semaine écoulée), mais le rang demeure.
    expect(weekCountAtSession([late], 'cheval', monday)).toBeUndefined();
    expect(sessionRank([late], 'cheval')).toBe(1);
  });

  it('semaine précédente : les 7 jours avant le lundi courant', () => {
    expect(previousWeekRange(at(2026, 11, 18))).toEqual({ from: at(2026, 11, 9, 0), to: at(2026, 11, 16, 0) });
  });
});

describe('semaines du changement d’heure (critère 3)', () => {
  it('23–29 mars 2026 (passage à l’heure d’été) : 167 h, dimanche 22:00 comptée, lundi 00:30 non', () => {
    const now = at(2026, 3, 29, 23);
    const { from, to } = weekRange(now);
    expect(from).toEqual(at(2026, 3, 23, 0));
    expect(to).toEqual(at(2026, 3, 30, 0));
    expect((to.getTime() - from.getTime()) / 3_600_000).toBe(167);
    const sessions = [session('dim', at(2026, 3, 29, 22)), session('lun', at(2026, 3, 30, 0, 30))];
    expect(weekCount(sessions, now)).toBe(1);
    expect(weekCount(sessions, at(2026, 3, 30, 12))).toBe(1);
    expect(weekCountAtSession(sessions, 'dim', now)).toBe(1);
    expect(weekCountAtSession(sessions, 'lun', now)).toBeUndefined();
  });

  it('19–25 octobre 2026 (retour à l’heure d’hiver) : 169 h, dimanche 22:00 comptée, lundi 00:30 non', () => {
    const now = at(2026, 10, 25, 23);
    const { from, to } = weekRange(now);
    expect(from).toEqual(at(2026, 10, 19, 0));
    expect(to).toEqual(at(2026, 10, 26, 0));
    expect((to.getTime() - from.getTime()) / 3_600_000).toBe(169);
    const sessions = [session('dim', at(2026, 10, 25, 22)), session('lun', at(2026, 10, 26, 0, 30))];
    expect(weekCount(sessions, now)).toBe(1);
    expect(weekCount(sessions, at(2026, 10, 26, 12))).toBe(1);
    expect(weekCount(sessions, at(2026, 10, 26, 0, 0))).toBe(1);
  });
});

describe('bornes de mois (critère 4)', () => {
  it('31 octobre 23:59 compte pour octobre, 1er novembre 00:00 pour novembre', () => {
    const sessions = [session('oct', at(2026, 10, 31, 23, 59)), session('nov', at(2026, 11, 1, 0, 0))];
    const oct = monthRange(at(2026, 10, 15));
    const nov = monthRange(at(2026, 11, 15));
    expect(oct).toEqual({ from: at(2026, 10, 1, 0), to: at(2026, 11, 1, 0) });
    expect(periodSummary(sessions, oct.from, oct.to).count).toBe(1);
    expect(periodSummary(sessions, nov.from, nov.to).count).toBe(1);
    expect(countedSessions(sessions).filter((s) => periodSummary([s], oct.from, oct.to).count === 1).map((s) => s.id)).toEqual([
      'oct',
    ]);
  });
});

describe('periodSummary (critère 5)', () => {
  const history = [
    session('s1', at(2026, 11, 2), { squat: [set(100, 5)], 'developpe-couche': [set(70, 8)] }),
    // Squat : poids, 1RM et volume battus → un seul record ; développé couché : poids battu.
    session('s2', at(2026, 11, 10), { squat: [set(110, 5), set(110, 5)], 'developpe-couche': [set(72.5, 8)] }),
    // Égalité : pas de record.
    session('s3', at(2026, 11, 12), { squat: [set(110, 5)] }),
    session('vide', at(2026, 11, 13), {}),
  ];

  it('volume = Σ sessionVolume ; records = un au plus par exercice et par séance, comme le récap', () => {
    const { from, to } = weekRange(at(2026, 11, 11));
    const summary = periodSummary(history, from, to);
    expect(summary.count).toBe(2);
    expect(summary.volume).toBe(sessionVolume(history[1]) + sessionVolume(history[2]));
    expect(summary.volume).toBe(1100 + 580 + 550);
    const fromRecap = history
      .slice(1, 3)
      .reduce((n, s) => n + strongestRecords(detectNewRecords(s, history)).length, 0);
    expect(summary.records).toBe(fromRecap);
    expect(summary.records).toBe(2);
  });

  it('les records se comparent à tout l’historique antérieur, pas seulement à la période', () => {
    // Semaine de s3 seule : 110 kg égalé, pas de record (s2, hors période, compte).
    const { from, to } = weekRange(at(2026, 11, 12));
    expect(periodSummary([history[0], history[2]], from, to).records).toBe(1);
    expect(periodSummary(history, at(2026, 11, 12, 0), to).records).toBe(0);
  });

  it('période vide : zéros', () => {
    expect(periodSummary(history, at(2026, 1, 1), at(2026, 2, 1))).toEqual({ count: 0, volume: 0, records: 0 });
  });
});

describe('bilan de Progrès (§4.2)', () => {
  const sessions = [
    session('oct-1', at(2026, 10, 20), { squat: [set(100, 5)] }),
    session('oct-2', at(2026, 10, 28), { squat: [set(100, 5)] }),
  ];

  it('semaine dernière omise si vide ; mois en cours vide, du 1er au 7 → mois précédent, sous son nom', () => {
    // Dimanche 1er novembre : semaine en cours 26 oct.–1er nov., semaine dernière 19–25 oct.
    const review = progressReview(sessions, at(2026, 11, 1, 9));
    expect(review.lastWeek).toEqual({ count: 1, volume: 500, records: 0 });
    expect(review.month).toEqual({ count: 2, volume: 1000, records: 0, monthStart: at(2026, 10, 1, 0), isCurrent: false });

    // Lundi 2 novembre : repli sur octobre, sans « Semaine dernière » (26 oct.–1er nov. : 1 séance, le 28).
    const monday = progressReview(sessions, at(2026, 11, 2, 9));
    expect(monday.month?.monthStart).toEqual(at(2026, 10, 1, 0));
    expect(monday.month?.isCurrent).toBe(false);
  });

  it('repli limité au 1er–7 : présent le 7 à 23:59, absent le 8 à 00:00', () => {
    expect(progressReview(sessions, at(2026, 11, 7, 23, 59)).month?.monthStart).toEqual(at(2026, 10, 1, 0));
    expect(progressReview(sessions, at(2026, 11, 8, 0, 0)).month).toBeUndefined();
    // Lundi 9 novembre : semaine dernière (2–8 nov.) vide, mois en cours vide → rien.
    expect(progressReview(sessions, at(2026, 11, 9, 9))).toEqual({});
  });

  it('repli au changement d’année : le 3 janvier, décembre de l’année précédente', () => {
    const december = [session('dec', at(2026, 12, 15)), session('dec-2', at(2026, 12, 21))];
    const review = progressReview(december, at(2027, 1, 3, 9));
    expect(review.month?.monthStart).toEqual(at(2026, 12, 1, 0));
    expect(review.month?.isCurrent).toBe(false);
    expect(review.month?.count).toBe(2);
  });

  it('du 1er au 7, mois précédent vide : pas de ligne de mois', () => {
    const away = [session('sep', at(2026, 9, 23, 18))];
    expect(progressReview(away, at(2026, 11, 3, 9)).month).toBeUndefined();
  });

  it('29 octobre, dernière séance le 23 septembre : ni mois ni semaine dernière', () => {
    const away = [session('sep', at(2026, 9, 23, 18))];
    expect(progressReview(away, at(2026, 10, 29, 20))).toEqual({});
  });

  it('mois en cours avec des séances : isCurrent', () => {
    const review = progressReview(sessions, at(2026, 10, 29, 20));
    expect(review.month).toEqual({ count: 2, volume: 1000, records: 0, monthStart: at(2026, 10, 1, 0), isCurrent: true });
  });

  it('les deux mois vides : pas de ligne de mois ; historique vide : rien', () => {
    expect(progressReview(sessions, at(2027, 1, 15))).toEqual({});
    expect(progressReview([], at(2026, 11, 1))).toEqual({});
  });
});

describe('jalons et rang (critère 6)', () => {
  it('isMilestone : 1, 10, 25, 50, 100, puis tous les 100', () => {
    for (const rank of [1, 10, 25, 50, 100, 200, 300, 1000]) expect(isMilestone(rank), String(rank)).toBe(true);
    for (const rank of [2, 9, 11, 24, 26, 75, 150, 250]) expect(isMilestone(rank), String(rank)).toBe(false);
  });

  it('le rang ignore les séances non comptées et ne dépend pas de la date du jour', () => {
    const sessions = [
      session('c', at(2026, 11, 3)),
      session('vide', at(2026, 11, 2), {}),
      session('a', at(2026, 11, 1)),
      session('b', at(2026, 11, 2, 18)),
    ];
    expect(sessionRank(sessions, 'a')).toBe(1);
    expect(sessionRank(sessions, 'b')).toBe(2);
    expect(sessionRank(sessions, 'c')).toBe(3);
    expect(sessionRank(sessions, 'vide')).toBeUndefined();
    expect(sessionRank(sessions, 'inconnue')).toBeUndefined();
    // Séance plus ancienne supprimée : les rangs suivants baissent de 1.
    expect(sessionRank(sessions.filter((s) => s.id !== 'a'), 'c')).toBe(2);
  });
});

describe('ligne de semaine du récap (§4.4)', () => {
  const sessions = [
    session('lun', at(2026, 10, 26, 8)),
    session('lun-soir', at(2026, 10, 26, 18)),
    session('vide', at(2026, 10, 27, 8), {}),
    session('mer', at(2026, 10, 28, 8)),
  ];
  const now = at(2026, 10, 29, 12);

  it('compte au moment de la séance (séances comptées de la semaine commencées au plus tard avec elle)', () => {
    expect(weekCountAtSession(sessions, 'lun', now)).toBe(1);
    expect(weekCountAtSession(sessions, 'lun-soir', now)).toBe(2);
    expect(weekCountAtSession(sessions, 'mer', now)).toBe(3);
  });

  it('rien pour une séance non comptée ou d’une semaine écoulée', () => {
    expect(weekCountAtSession(sessions, 'vide', now)).toBeUndefined();
    expect(weekCountAtSession(sessions, 'mer', at(2026, 11, 2, 12))).toBeUndefined();
  });

  it('séance datée dans le futur : comptée seulement quand sa semaine arrive', () => {
    const future = [...sessions, session('futur', at(2026, 11, 4))];
    expect(weekCount(future, now)).toBe(3);
    expect(weekCount(future, at(2026, 11, 3))).toBe(1);
  });
});

describe('objectif et proposition (§5)', () => {
  const two = [session('a', at(2026, 10, 26)), session('b', at(2026, 10, 27))];

  it('weeklyGoalOf / isWeeklyGoal : entier de 1 à 6, sinon « Aucun »', () => {
    expect(weeklyGoalOf({})).toBeUndefined();
    expect(weeklyGoalOf({ settings: { weeklyGoal: 3 } })).toBe(3);
    for (const bad of [0, 7, 2.5, '3', null]) expect(isWeeklyGoal(bad), String(bad)).toBe(false);
  });

  it('proposée si objectif « Aucun », jamais demandé et au moins 2 séances comptées', () => {
    expect(shouldProposeWeeklyGoal({ sessions: [] })).toBe(false);
    expect(shouldProposeWeeklyGoal({ sessions: two.slice(0, 1) })).toBe(false);
    expect(shouldProposeWeeklyGoal({ sessions: [two[0], session('vide', at(2026, 10, 27), {})] })).toBe(false);
    expect(shouldProposeWeeklyGoal({ sessions: two })).toBe(true);
    expect(shouldProposeWeeklyGoal({ sessions: two, settings: { weeklyGoalAsked: true } })).toBe(false);
    expect(shouldProposeWeeklyGoal({ sessions: two, settings: { weeklyGoal: 3 } })).toBe(false);
    expect(shouldProposeWeeklyGoal({ sessions: two, settings: { suggestLoad: false } })).toBe(true);
  });
});
