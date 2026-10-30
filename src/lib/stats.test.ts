import { describe, expect, it } from 'vitest';
import {
  completedSessions,
  countDoneSets,
  countedSessions,
  detectNewRecords,
  estimateOneRepMax,
  exerciseHistory,
  exerciseVolume,
  lastPerformance,
  personalRecords,
  recordGainedBy,
  sessionDurationMs,
  sessionVolume,
  suggestedTemplateId,
  templateLastDoneAt,
  sessionsThisMonth,
  sessionsThisWeek,
  startOfWeek,
  strongestRecords,
} from './stats';
import type { SetEntry, WorkoutSession } from './types';

/** Date ISO construite en heure locale (évite les surprises de fuseau). */
const local = (y: number, m: number, d: number, h = 10, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString();

const set = (weight: number, reps: number, done = true): SetEntry => ({ weight, reps, done });

function session(
  id: string,
  startedAt: string,
  exercises: Record<string, SetEntry[]>,
  endedAt: string | null = startedAt, // null = séance en cours
): WorkoutSession {
  return {
    id,
    name: id,
    startedAt,
    ...(endedAt !== null && { endedAt }),
    exercises: Object.entries(exercises).map(([exerciseId, sets]) => ({ exerciseId, sets })),
  };
}

describe('estimateOneRepMax', () => {
  it('applique Epley', () => {
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.333, 2);
    expect(estimateOneRepMax(60, 5)).toBeCloseTo(70, 5);
  });
  it('reps = 1 → poids', () => expect(estimateOneRepMax(120, 1)).toBe(120));
  it('reps = 0 → 0', () => expect(estimateOneRepMax(120, 0)).toBe(0));
  it('poids = 0 → 0', () => expect(estimateOneRepMax(0, 10)).toBe(0));
  it('valeurs non finies → 0', () => {
    expect(estimateOneRepMax(Number.NaN, 5)).toBe(0);
    expect(estimateOneRepMax(100, Number.NaN)).toBe(0);
    expect(estimateOneRepMax(Number.POSITIVE_INFINITY, 5)).toBe(0);
    expect(estimateOneRepMax(100, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('volume, séries et durée', () => {
  const s = session('a', local(2026, 1, 5), {
    squat: [set(100, 5), set(100, 5), set(100, 5, false)],
    'curl-barre': [set(30, 10)],
  });

  it('volume d’un exercice : uniquement séries validées', () => {
    expect(exerciseVolume(s.exercises[0])).toBe(1000);
  });
  it('volume de séance', () => expect(sessionVolume(s)).toBe(1300));
  it('nombre de séries validées', () => expect(countDoneSets(s)).toBe(3));

  it('durée d’une séance terminée', () => {
    const t = session('b', local(2026, 1, 5, 10), {}, local(2026, 1, 5, 11, 15));
    expect(sessionDurationMs(t)).toBe(75 * 60 * 1000);
  });
  it('durée d’une séance en cours (jusqu’à now)', () => {
    const t = session('b', local(2026, 1, 5, 10), {}, null);
    expect(sessionDurationMs(t, new Date(2026, 0, 5, 10, 30))).toBe(30 * 60 * 1000);
  });
  it('durée jamais négative', () => {
    const t = session('b', local(2026, 1, 5, 10), {}, null);
    expect(sessionDurationMs(t, new Date(2026, 0, 5, 9))).toBe(0);
  });
});

describe('historique et records', () => {
  const sessions = [
    session('s2', local(2026, 1, 8), { squat: [set(105, 3), set(90, 10)] }),
    session('s1', local(2026, 1, 5), { squat: [set(100, 5)], 'curl-barre': [set(30, 10)] }),
    session('s3', local(2026, 1, 10), { squat: [set(50, 5, false)] }), // aucune série validée
    session('en-cours', local(2026, 1, 12), { squat: [set(200, 1)] }, null),
  ];

  it('completedSessions exclut les séances en cours et trie par date', () => {
    expect(completedSessions(sessions).map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('exerciseHistory donne un point par séance avec séries validées', () => {
    const h = exerciseHistory(sessions, 'squat');
    expect(h.map((p) => p.sessionId)).toEqual(['s1', 's2']);
    expect(h[0]).toMatchObject({ maxWeight: 100, volume: 500 });
    expect(h[0].bestOneRepMax).toBeCloseTo(116.667, 2);
    expect(h[1]).toMatchObject({ maxWeight: 105, volume: 1215 });
    expect(h[1].bestOneRepMax).toBeCloseTo(120, 5); // 90 × (1 + 10/30)
  });

  it('exerciseHistory fusionne un exercice présent deux fois dans une séance', () => {
    const s: WorkoutSession = {
      ...session('x', local(2026, 1, 5), {}),
      exercises: [
        { exerciseId: 'squat', sets: [set(100, 5)] },
        { exerciseId: 'squat', sets: [set(110, 2)] },
      ],
    };
    expect(exerciseHistory([s], 'squat')[0]).toMatchObject({ maxWeight: 110, volume: 720 });
  });

  it('personalRecords', () => {
    const pr = personalRecords(sessions, 'squat');
    expect(pr.maxWeight).toEqual({ value: 105, sessionId: 's2', date: local(2026, 1, 8) });
    expect(pr.bestOneRepMax?.sessionId).toBe('s2');
    expect(pr.bestVolume).toMatchObject({ value: 1215, sessionId: 's2' });
  });

  it('personalRecords vide pour un exercice jamais fait', () => {
    expect(personalRecords(sessions, 'tractions')).toEqual({});
  });
});

describe('lastPerformance', () => {
  it('renvoie les séries validées de la séance terminée la plus récente qui contient l’exercice', () => {
    const sessions = [
      session('s1', local(2026, 1, 5), { squat: [set(100, 5)] }),
      session('s2', local(2026, 1, 8), { squat: [set(102.5, 5), set(102.5, 4, false)] }),
      session('s3', local(2026, 1, 10), { 'curl-barre': [set(30, 10)] }),
      session('en-cours', local(2026, 1, 12), { squat: [set(200, 1)] }, null),
    ];
    expect(lastPerformance(sessions, 'squat')).toEqual({
      sessionId: 's2',
      date: local(2026, 1, 8),
      sets: [set(102.5, 5)],
    });
  });

  it('ignore une séance récente sans série validée pour cet exercice', () => {
    const sessions = [
      session('s1', local(2026, 1, 5), { squat: [set(100, 5)] }),
      session('s2', local(2026, 1, 8), { squat: [set(120, 5, false)] }),
    ];
    expect(lastPerformance(sessions, 'squat')?.sessionId).toBe('s1');
  });

  it('undefined si jamais fait', () => {
    expect(lastPerformance([], 'squat')).toBeUndefined();
  });
});

describe('detectNewRecords', () => {
  const history = [
    session('s1', local(2026, 1, 5), { squat: [set(100, 5)], 'curl-barre': [set(30, 10)] }),
  ];

  it('détecte les records battus', () => {
    const current = session('s2', local(2026, 1, 8), {
      squat: [set(105, 3)], // poids ↑, 1RM 115.5 < 116.67, volume 315 < 500
      'curl-barre': [set(30, 12)], // 1RM ↑ et volume ↑
    });
    const records = detectNewRecords(current, [...history, current]);
    expect(records).toEqual([
      { exerciseId: 'squat', type: 'maxWeight', value: 105, previous: 100 },
      { exerciseId: 'curl-barre', type: 'bestOneRepMax', value: 42, previous: 40 },
      { exerciseId: 'curl-barre', type: 'bestVolume', value: 360, previous: 300 },
    ]);
  });

  it('pas de record pour un exercice sans historique antérieur', () => {
    const current = session('s2', local(2026, 1, 8), { tractions: [set(10, 8)] });
    expect(detectNewRecords(current, history)).toEqual([]);
  });

  it('historique au poids du corps (meilleur = 0) : passer à > 0 est un record', () => {
    const bw = [session('s1', local(2026, 1, 5), { tractions: [set(0, 8)] })];
    const current = session('s2', local(2026, 1, 8), { tractions: [set(10, 5)] });
    expect(detectNewRecords(current, bw)).toEqual([
      { exerciseId: 'tractions', type: 'maxWeight', value: 10, previous: 0 },
      { exerciseId: 'tractions', type: 'bestOneRepMax', value: estimateOneRepMax(10, 5), previous: 0 },
      { exerciseId: 'tractions', type: 'bestVolume', value: 50, previous: 0 },
    ]);
    // Toujours au poids du corps : pas de record.
    const again = session('s3', local(2026, 1, 9), { tractions: [set(0, 12)] });
    expect(detectNewRecords(again, bw)).toEqual([]);
  });

  it('égalité ≠ record et séries non validées ignorées', () => {
    const current = session('s2', local(2026, 1, 8), { squat: [set(100, 5), set(150, 5, false)] });
    expect(detectNewRecords(current, history)).toEqual([]);
  });

  it('ignore les séances postérieures', () => {
    const later = session('s9', local(2026, 2, 1), { squat: [set(200, 5)] });
    const current = session('s2', local(2026, 1, 8), { squat: [set(110, 5)] });
    expect(detectNewRecords(current, [...history, later]).map((r) => r.type)).toEqual([
      'maxWeight',
      'bestOneRepMax',
      'bestVolume',
    ]);
  });
});

describe('compteurs semaine / mois', () => {
  it('startOfWeek renvoie le lundi', () => {
    // mercredi 28 octobre 2026
    expect(startOfWeek(new Date(2026, 9, 28, 15))).toEqual(new Date(2026, 9, 26));
    // dimanche 1er novembre 2026 → lundi 26 octobre
    expect(startOfWeek(new Date(2026, 10, 1, 23))).toEqual(new Date(2026, 9, 26));
    // lundi lui-même
    expect(startOfWeek(new Date(2026, 9, 26, 0, 1))).toEqual(new Date(2026, 9, 26));
  });

  // Séances comptées (lot 3) : terminées avec au moins une série validée.
  const done = { squat: [set(100, 5)] };
  const sessions = [
    session('dim-precedent', local(2026, 10, 25, 20), done),
    session('lundi', local(2026, 10, 26, 8), done),
    session('mercredi', local(2026, 10, 28, 8), done),
    session('debut-mois', local(2026, 10, 1, 8), done),
    session('mois-precedent', local(2026, 9, 30, 8), done),
    session('en-cours', local(2026, 10, 28, 18), done, null),
    session('vide', local(2026, 10, 27, 8), {}),
    session('rien-valide', local(2026, 10, 27, 18), { squat: [set(100, 5, false)] }),
  ];
  const now = new Date(2026, 9, 28, 19);

  it('séances de la semaine (lundi → dimanche, séances comptées seulement)', () => {
    expect(sessionsThisWeek(sessions, now)).toBe(2);
  });

  it('séances du mois (séances vides ou sans série validée exclues)', () => {
    expect(sessionsThisMonth(sessions, now)).toBe(4);
  });

  it('countedSessions : terminées avec au moins une série validée, ordre chronologique', () => {
    expect(countedSessions(sessions).map((s) => s.id)).toEqual([
      'mois-precedent',
      'debut-mois',
      'dim-precedent',
      'lundi',
      'mercredi',
    ]);
  });
});

describe('strongestRecords', () => {
  it('un record par exercice : poids max, sinon 1RM, sinon volume ; ordre des exercices conservé', () => {
    const r = (exerciseId: string, type: 'maxWeight' | 'bestOneRepMax' | 'bestVolume') => ({ exerciseId, type, value: 1, previous: 0 });
    expect(
      strongestRecords([r('squat', 'bestVolume'), r('squat', 'maxWeight'), r('squat', 'bestOneRepMax'), r('dips', 'bestVolume'), r('rowing', 'bestOneRepMax'), r('rowing', 'bestVolume')]),
    ).toEqual([r('squat', 'maxWeight'), r('dips', 'bestVolume'), r('rowing', 'bestOneRepMax')]);
    expect(strongestRecords([])).toEqual([]);
  });
});

describe('séance type : dernier passage et suggestion', () => {
  const done = (id: string, templateId: string | undefined, startedAt: string, ended = true): WorkoutSession => ({
    id,
    templateId,
    name: id,
    startedAt,
    ...(ended && { endedAt: startedAt }),
    exercises: [],
  });
  const templates = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('templateLastDoneAt : séance terminée la plus récente de cette séance type', () => {
    const sessions = [
      done('1', 'a', '2026-10-01T10:00:00.000Z'),
      done('2', 'a', '2026-10-20T10:00:00.000Z'),
      done('3', 'a', '2026-10-25T10:00:00.000Z', false),
      done('4', 'b', '2026-10-22T10:00:00.000Z'),
    ];
    expect(templateLastDoneAt(sessions, 'a')).toBe('2026-10-20T10:00:00.000Z');
    expect(templateLastDoneAt(sessions, 'c')).toBeUndefined();
  });

  it('suggestedTemplateId : la moins récemment faite parmi celles déjà faites', () => {
    const sessions = [
      done('1', 'a', '2026-10-25T10:00:00.000Z'),
      done('2', 'b', '2026-10-20T10:00:00.000Z'),
      done('3', 'b', '2026-10-10T10:00:00.000Z'),
    ];
    // a : 25 oct., b : 20 oct. (c jamais faite, ignorée) → b
    expect(suggestedTemplateId(templates, sessions)).toBe('b');
  });

  it('aucune faite → la première ; liste vide → undefined', () => {
    expect(suggestedTemplateId(templates, [done('x', undefined, '2026-10-25T10:00:00.000Z')])).toBe('a');
    expect(suggestedTemplateId([], [])).toBeUndefined();
  });

  it('séance en cours (non terminée) ignorée', () => {
    const sessions = [done('1', 'c', '2026-10-01T10:00:00.000Z', false), done('2', 'b', '2026-10-25T10:00:00.000Z')];
    expect(suggestedTemplateId(templates, sessions)).toBe('b');
  });
});

describe('recordGainedBy (lot 5 : record annoncé en séance)', () => {
  /** Valide les séries une à une et renvoie le record annoncé à chaque validation. */
  function announcements(history: WorkoutSession[], exerciseId: string, sets: SetEntry[]) {
    const pending = sets.map((s) => ({ ...s, done: false }));
    let current = session('live', local(2026, 10, 30, 18), { [exerciseId]: pending }, null);
    const result = [];
    for (let i = 0; i < sets.length; i++) {
      const next: WorkoutSession = {
        ...current,
        exercises: current.exercises.map((e) => ({
          ...e,
          sets: e.sets.map((s, j) => (j === i ? { ...s, done: true } : s)),
        })),
      };
      result.push(recordGainedBy(current, next, history, exerciseId));
      current = next;
    }
    return { result, final: current };
  }

  it('poids max : annoncé à 85 kg, pas à la même charge, de nouveau à 87,5 kg', () => {
    const history = [session('h', local(2026, 10, 20), { squat: [set(82.5, 5), set(82.5, 5)] })];
    const { result } = announcements(history, 'squat', [set(85, 1), set(85, 1), set(87.5, 1)]);
    expect(result.map((r) => r && [r.type, r.value])).toEqual([['maxWeight', 85], undefined, ['maxWeight', 87.5]]);
  });

  it('volume : annoncé une seule fois, quand il dépasse l’ancien meilleur (série 3)', () => {
    // Ancien meilleur : 1 200 kg, 100 kg max, 1RM ≈ 113 kg. Séance : 85 kg × 5, sans record de poids ni de 1RM.
    const history = [session('h', local(2026, 10, 20), { squat: [set(100, 4), set(100, 4), set(100, 4)] })];
    const { result } = announcements(history, 'squat', [set(85, 5), set(85, 5), set(85, 5), set(85, 5), set(85, 5)]);
    expect(result.map((r) => r && [r.type, r.value])).toEqual([undefined, undefined, ['bestVolume', 1275], undefined, undefined]);
  });

  it('type plus fort : on passe d’un record de volume à un record de poids max', () => {
    const history = [session('h', local(2026, 10, 20), { squat: [set(100, 3)] })];
    // Série 1 : 60 × 6 = 360 > 300 (volume) ; série 2 : 102,5 kg (poids max).
    const { result } = announcements(history, 'squat', [set(60, 6), set(102.5, 1)]);
    expect(result.map((r) => r?.type)).toEqual(['bestVolume', 'maxWeight']);
  });

  it('1RM estimé qui remonte : annoncé de nouveau', () => {
    const history = [session('h', local(2026, 10, 20), { 'developpe-couche': [set(80, 5)] })];
    // 1RM historique ≈ 93,3 ; 70 × 10 ≈ 93,3 (=) ; 70 × 12 = 98 ; 70 × 14 ≈ 102,7.
    const { result } = announcements(history, 'developpe-couche', [set(70, 12), set(70, 14)]);
    expect(result.map((r) => r?.type)).toEqual(['bestOneRepMax', 'bestOneRepMax']);
    expect(result[1]!.value).toBeGreaterThan(result[0]!.value);
  });

  it('série 1 corrigée à 90 kg, puis série 2 validée à 85 kg : rien n’est annoncé', () => {
    const history = [session('h', local(2026, 10, 20), { squat: [set(82.5, 5), set(82.5, 5)] })];
    // Série 1 déjà validée puis corrigée à 90 kg (la correction n'annonce rien) ; série 2 à valider.
    const before = session('live', local(2026, 10, 30, 18), { squat: [set(90, 5), set(85, 5, false)] }, null);
    const after = session('live', local(2026, 10, 30, 18), { squat: [set(90, 5), set(85, 5)] }, null);
    expect(recordGainedBy(before, after, history, 'squat')).toBeUndefined();
  });

  it('exercice sans historique : aucune annonce', () => {
    const { result } = announcements([], 'squat', [set(100, 5), set(120, 5)]);
    expect(result).toEqual([undefined, undefined]);
  });

  it('sur la séance entière, le dernier record annoncé a le type de celui du récap', () => {
    const history = [
      session('h', local(2026, 10, 20), { squat: [set(100, 4), set(100, 4), set(100, 4)], 'developpe-couche': [set(80, 5)] }),
    ];
    for (const sets of [
      [set(85, 5), set(85, 5), set(85, 5), set(102.5, 1)],
      [set(85, 5), set(85, 5), set(85, 5), set(85, 5)],
      [set(102.5, 1), set(85, 5), set(85, 5), set(85, 5), set(85, 5)],
    ]) {
      const { result, final } = announcements(history, 'squat', sets);
      const lastAnnounced = result.filter((r) => r !== undefined).pop();
      const recap = strongestRecords(detectNewRecords({ ...final, endedAt: final.startedAt }, history)).find(
        (r) => r.exerciseId === 'squat',
      );
      expect(lastAnnounced?.type).toBe(recap?.type);
    }
  });
});
