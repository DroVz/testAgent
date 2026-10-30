import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { BACKUP_KEY, loadBackupInfo } from '../lib/backup';
import { resetRestChimeForTests } from '../lib/restChime';
import { STORAGE_KEY, createDefaultState, exportState, validateImport, type StorageLike } from '../lib/storage';
import type { AppState, SetEntry, WorkoutSession } from '../lib/types';
import { AppStoreProvider } from '../state/AppStore';

/** Lot 5 : filet de sauvegarde (Réglages, récap), record annoncé en séance. */

function memoryStorage(initial?: AppState) {
  const data: Record<string, string> = initial ? { [STORAGE_KEY]: JSON.stringify(initial) } : {};
  const storage: StorageLike = {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
  const saved = (): AppState => JSON.parse(data[STORAGE_KEY]);
  return { storage, saved };
}

function renderAt(hash: string, initial?: AppState) {
  window.location.hash = hash;
  const mem = memoryStorage(initial);
  const { unmount } = render(
    <AppStoreProvider storage={mem.storage}>
      <App />
    </AppStoreProvider>,
  );
  return { ...mem, unmount };
}

const done = (weight: number, reps: number): SetEntry => ({ weight, reps, done: true });
const todo = (weight: number, reps: number): SetEntry => ({ weight, reps, done: false });

/** Séance terminée du jour `day` d'octobre 2026 (18 h), squat 100 kg × 5. */
function pastSession(id: string, day: number, sets: SetEntry[] = [done(100, 5)]): WorkoutSession {
  return {
    id,
    name: 'Jambes',
    startedAt: new Date(2026, 9, day, 18).toISOString(),
    endedAt: new Date(2026, 9, day, 19).toISOString(),
    exercises: [{ exerciseId: 'squat', sets }],
  };
}

/** `n` séances comptées (s1 … sn), une par jour à partir du 1er octobre. */
function stateWithSessions(n: number): AppState {
  const s = createDefaultState();
  for (let i = 1; i <= n; i++) s.sessions.push(pastSession(`s${i}`, i));
  return s;
}

const setBackupInfo = (info: object) => localStorage.setItem(BACKUP_KEY, JSON.stringify(info));
const statusLine = () => document.querySelector('.settings-section__status');
const backupCard = () => document.querySelector<HTMLElement>('.backup-card');
const accents = () => [...document.querySelectorAll('.btn--primary')];
const stubShare = (share: () => Promise<void>) => vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share });
const today = 'Dernier export : aujourd’hui.';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('lot 5 — Réglages : ligne d’état et rappel', () => {
  it('sans export : « Aucun export pour l’instant. » sous le texte de la section ; partage réussi : « aujourd’hui », aussi après rechargement', async () => {
    stubShare(() => Promise.resolve());
    const { unmount, saved } = renderAt('#/reglages', stateWithSessions(2));
    const line = statusLine()!;
    expect(line).toHaveTextContent('Aucun export pour l’instant.');
    expect(line).toHaveClass('settings-section__text');
    // Juste après le texte existant de la section Sauvegarde.
    expect(line.previousElementSibling).toHaveTextContent(/stockées uniquement sur cet appareil/);
    // Même icône Share que sur le récap.
    expect(screen.getByRole('button', { name: 'Exporter mes données' }).querySelector('svg.lucide-share')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }));
    await act(async () => {});
    expect(statusLine()!.textContent).toBe(today);
    const state = saved();
    unmount();
    renderAt('#/reglages', state);
    expect(statusLine()!.textContent).toBe(today);
  });

  it('séances enregistrées depuis le dernier export', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 12));
    try {
      setBackupInfo({ lastExportAt: new Date(2026, 9, 5, 20).toISOString() });
      renderAt('#/reglages', stateWithSessions(8));
      expect(statusLine()!.textContent).toBe(
        'Dernier export : il y a 9 jours. 3 séances enregistrées depuis.',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('feuille fermée : inchangée ; téléchargement de repli : « aujourd’hui »', async () => {
    stubShare(() => Promise.reject(Object.assign(new Error('cancel'), { name: 'AbortError' })));
    const first = renderAt('#/reglages');
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }));
    await act(async () => {});
    expect(statusLine()).toHaveTextContent('Aucun export pour l’instant.');
    expect(loadBackupInfo().lastExportAt).toBeUndefined();
    first.unmount();

    vi.unstubAllGlobals();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderAt('#/reglages');
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }));
    expect(statusLine()!.textContent).toBe(today);
  });

  it('« Copier » réussi : « aujourd’hui » ; échec du presse-papiers : inchangée', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: undefined }));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => Promise.reject(new Error('no')) } });
    const first = renderAt('#/reglages');
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }));
    // « Téléchargement indisponible » : pas un export.
    expect(statusLine()).toHaveTextContent('Aucun export pour l’instant.');
    fireEvent.click(screen.getByRole('button', { name: 'Copier' }));
    expect(await screen.findByText(/le texte est sélectionné/)).toBeInTheDocument();
    expect(statusLine()).toHaveTextContent('Aucun export pour l’instant.');
    first.unmount();

    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => Promise.resolve() } });
    renderAt('#/reglages');
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copier' }));
    expect(await screen.findByText('Données copiées dans le presse-papiers.')).toBeInTheDocument();
    expect(statusLine()!.textContent).toBe(today);
  });

  it('interrupteur « Rappel de sauvegarde » : activé par défaut ; coupé = false, réactivé = champ retiré ; survit à un rechargement', () => {
    const { saved, unmount } = renderAt('#/reglages', stateWithSessions(1));
    const toggle = screen.getByRole('switch', { name: 'Rappel de sauvegarde' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveClass('switch-row');
    expect(toggle).toHaveAccessibleDescription(
      'Après 6 séances sans export, le récap te propose d’en faire un. Jamais de notification.',
    );
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(saved().settings?.backupReminder).toBe(false);
    const off = saved();
    unmount();
    const second = renderAt('#/reglages', off);
    const again = screen.getByRole('switch', { name: 'Rappel de sauvegarde' });
    expect(again).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(again);
    expect(again).toHaveAttribute('aria-checked', 'true');
    expect(second.saved().settings).not.toHaveProperty('backupReminder');
  });

  it('export puis import : le réglage suit ; « non » fait échouer l’import en citant settings.backupReminder ; les dates ne sont jamais exportées', () => {
    setBackupInfo({ lastExportAt: new Date().toISOString() });
    const s = stateWithSessions(1);
    s.settings = { backupReminder: false };
    const text = exportState(s);
    expect(text).not.toMatch(/lastExportAt|importedAt|reminderSnoozedAt/);
    const back = validateImport(text);
    expect(back.ok && back.state.settings?.backupReminder).toBe(false);
    const bad = validateImport(JSON.stringify({ ...s, settings: { backupReminder: 'non' } }));
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.error).toMatch('settings.backupReminder');
  });

  it('import réussi : importedAt posé, ligne inchangée ; réinitialisation : clé supprimée', () => {
    renderAt('#/reglages', stateWithSessions(1));
    fireEvent.change(screen.getByRole('textbox', { name: 'Ou colle le contenu exporté' }), {
      target: { value: exportState(stateWithSessions(3)) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Importer le texte' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remplacer' }));
    expect(loadBackupInfo().importedAt).toBeDefined();
    expect(statusLine()).toHaveTextContent('Aucun export pour l’instant.');

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser toutes les données' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tout effacer' }));
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
    expect(statusLine()).toHaveTextContent('Aucun export pour l’instant.');
  });

  it('réinitialisation non enregistrée (stockage plein) : la date du dernier export est gardée', () => {
    const exportedAt = new Date(2026, 9, 29).toISOString();
    setBackupInfo({ lastExportAt: exportedAt });
    const mem = memoryStorage(stateWithSessions(2));
    const storage: StorageLike = {
      getItem: mem.storage.getItem,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    window.location.hash = '#/reglages';
    render(
      <AppStoreProvider storage={storage}>
        <App />
      </AppStoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser toutes les données' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tout effacer' }));
    expect(screen.getByText(/Réinitialisation non enregistrée/)).toBeInTheDocument();
    expect(loadBackupInfo().lastExportAt).toBe(exportedAt);
  });
});

describe('lot 5 — récap : carte de rappel', () => {
  it('6ᵉ séance comptée sans export : deux lignes, deux boutons, après la liste et avant le dock ; 1 seul aplat accent', () => {
    renderAt('#/resume/s6', stateWithSessions(6));
    const card = backupCard()!;
    expect(card).toHaveTextContent('Tes 6 séances n’existent que sur ce téléphone.');
    expect(card).toHaveTextContent('Exporte une copie pour les garder en cas de perte ou de changement de téléphone.');
    const exportBtn = within(card).getByRole('button', { name: 'Exporter mes données' });
    expect(exportBtn).toHaveClass('btn', 'btn--block');
    expect(exportBtn).not.toHaveClass('btn--primary');
    expect(exportBtn.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(within(card).getByRole('button', { name: 'Plus tard' })).not.toHaveClass('btn--primary');
    const list = document.querySelector('.summary-list')!;
    const dock = document.querySelector('.summary-dock')!;
    expect(list.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(accents().map((a) => a.textContent)).toEqual(['Voir mes progrès']);
  });

  it('5ᵉ séance : pas de carte ; avec une référence : « Tes 6 dernières séances »', () => {
    const first = renderAt('#/resume/s5', stateWithSessions(5));
    expect(backupCard()).toBeNull();
    first.unmount();
    setBackupInfo({ importedAt: new Date(2026, 8, 1).toISOString() });
    renderAt('#/resume/s6', stateWithSessions(6));
    expect(backupCard()).toHaveTextContent('Tes 6 dernières séances n’existent que sur ce téléphone.');
  });

  it('partage réussi depuis la carte : « Copie exportée. », plus de bouton, lastExportAt posé ; pas de carte au récap suivant', async () => {
    stubShare(() => Promise.resolve());
    const first = renderAt('#/resume/s6', stateWithSessions(6));
    // Zone annoncée présente et vide dès le premier rendu : VoiceOver lira le message qui s'y ajoute.
    const status = within(backupCard()!).getByRole('status');
    expect(status).toBeEmptyDOMElement();
    fireEvent.click(within(backupCard()!).getByRole('button', { name: 'Exporter mes données' }));
    await act(async () => {});
    const card = backupCard()!;
    expect(within(card).getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('Copie exportée.');
    // Coche en encre (pas de vert), décorative ; le focus va sur le message (le bouton a disparu).
    expect(status.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(status.querySelector('svg')).toHaveClass('lucide-check');
    expect(document.activeElement).toBe(status);
    expect(within(card).queryAllByRole('button')).toHaveLength(0);
    expect(loadBackupInfo().lastExportAt).toBeDefined();
    first.unmount();
    renderAt('#/resume/s7', stateWithSessions(7));
    expect(backupCard()).toBeNull();
  });

  it('feuille fermée sans choix : carte inchangée, aucun message', async () => {
    stubShare(() => Promise.reject(Object.assign(new Error('cancel'), { name: 'AbortError' })));
    renderAt('#/resume/s6', stateWithSessions(6));
    fireEvent.click(within(backupCard()!).getByRole('button', { name: 'Exporter mes données' }));
    await act(async () => {});
    expect(within(backupCard()!).getByRole('button', { name: 'Exporter mes données' })).toBeInTheDocument();
    expect(loadBackupInfo().lastExportAt).toBeUndefined();
  });

  it('ni partage ni téléchargement : « Export impossible… » et « Ouvrir Réglages »', () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: undefined }));
    renderAt('#/resume/s6', stateWithSessions(6));
    const status = within(backupCard()!).getByRole('status');
    expect(status).toBeEmptyDOMElement();
    fireEvent.click(within(backupCard()!).getByRole('button', { name: 'Exporter mes données' }));
    const card = backupCard()!;
    expect(status).toHaveTextContent('Export impossible depuis cet écran. Ouvre Réglages pour copier tes données.');
    expect(document.activeElement).toBe(status);
    expect(within(card).getByRole('link', { name: 'Ouvrir Réglages' })).toHaveAttribute('href', '#/reglages');
  });

  it('« Plus tard » : carte retirée sans toast, absente après rechargement, de retour 6 séances comptées après', () => {
    const first = renderAt('#/resume/s6', stateWithSessions(6));
    fireEvent.click(within(backupCard()!).getByRole('button', { name: 'Plus tard' }));
    expect(backupCard()).toBeNull();
    expect(document.querySelector('.toast')).toBeNull();
    first.unmount();
    const second = renderAt('#/resume/s6', stateWithSessions(6));
    expect(backupCard()).toBeNull();
    second.unmount();
    // Les séances suivantes sont commencées après le report : on les date dans le futur proche.
    const later = stateWithSessions(6);
    for (let i = 1; i <= 6; i++) {
      const start = new Date(Date.now() + i * 3_600_000);
      later.sessions.push({
        ...pastSession(`n${i}`, 1),
        startedAt: start.toISOString(),
        endedAt: new Date(start.getTime() + 60_000).toISOString(),
      });
    }
    const withFive = { ...later, sessions: later.sessions.slice(0, 11) };
    const third = renderAt('#/resume/n5', withFive);
    expect(backupCard()).toBeNull();
    third.unmount();
    renderAt('#/resume/n6', later);
    expect(backupCard()).toHaveTextContent('Tes 12 séances n’existent que sur ce téléphone.');
  });

  it('récap rouvert d’une séance qui n’est pas la dernière comptée : pas de carte ; rappel coupé : jamais de carte', () => {
    const first = renderAt('#/resume/s7', stateWithSessions(8));
    expect(backupCard()).toBeNull();
    first.unmount();
    const off = stateWithSessions(8);
    off.settings = { backupReminder: false };
    renderAt('#/resume/s8', off);
    expect(backupCard()).toBeNull();
  });
});

describe('lot 5 — séance : record annoncé dans le dock', () => {
  /** Historique : squat à 82,5 kg max ; séance en cours : squat (3 séries) puis développé couché. */
  function stateInSession(squat: SetEntry[]): AppState {
    const s = createDefaultState();
    s.sessions.push(
      pastSession('h', 20, [done(82.5, 5), done(82.5, 5)]),
      { ...pastSession('h2', 21), exercises: [{ exerciseId: 'developpe-couche', sets: [done(60, 8)] }] },
    );
    s.activeSession = {
      id: 'live',
      name: 'Jambes',
      startedAt: new Date(2026, 9, 30, 18).toISOString(),
      exercises: [
        { exerciseId: 'squat', sets: squat },
        { exerciseId: 'developpe-couche', sets: [todo(60, 8)] },
      ],
    };
    return s;
  }
  const dockStatus = () =>
    [...document.querySelectorAll<HTMLElement>('.session-dock [role="status"]')].find((el) => !el.classList.contains('toast-region'))!;
  const recordLine = () => document.querySelector('.session-dock__record');
  const validateSet = () => fireEvent.click(screen.getByRole('button', { name: 'Valider la série' }));

  it('85 kg (ancien max 82,5) : « Nouveau record en squat : 85 kg ! » au-dessus du retour, dans un seul status ; pas à la série suivante', () => {
    renderAt('#/seance', stateInSession([todo(85, 5), todo(85, 5), todo(85, 5)]));
    validateSet();
    const status = dockStatus();
    expect(status.querySelectorAll('p')).toHaveLength(2);
    expect(status.textContent).toBe('Nouveau record en squat : 85 kg ! Série 1 validée. Repos : 90 s.');
    const line = recordLine()!;
    expect(line.nextElementSibling).toHaveClass('session-dock__feedback');
    expect(line.querySelector('svg')).toBeNull();
    expect(accents().map((a) => a.textContent)).toEqual(['Valider la série']);
    validateSet();
    expect(recordLine()).toBeNull();
    expect(dockStatus()).toHaveTextContent('Série 2 validée.');
  });

  it('la ligne disparaît après « Suivant », « Précédent » et « Corriger » ; rien après « Enregistrer la correction »', () => {
    renderAt('#/seance', stateInSession([todo(85, 5), todo(80, 5), todo(80, 5)]));
    validateSet();
    expect(recordLine()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Exercice suivant : / }));
    expect(recordLine()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Exercice précédent : / }));
    validateSet(); // 80 kg : pas de record
    expect(recordLine()).toBeNull();
    // Corriger la série 2 pour en faire un record : la correction n'annonce rien.
    fireEvent.click(screen.getByRole('button', { name: /^Corriger la série 2 / }));
    expect(recordLine()).toBeNull();
    fireEvent.change(screen.getByLabelText('Charge (kg)'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la correction' }));
    expect(recordLine()).toBeNull();
    expect(dockStatus()).toHaveTextContent('Série 2 corrigée.');
  });

  it('« Corriger » juste après un record : la ligne disparaît', () => {
    renderAt('#/seance', stateInSession([todo(85, 5), todo(80, 5)]));
    validateSet();
    expect(recordLine()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Corriger la série 1 / }));
    expect(recordLine()).toBeNull();
  });

  it('record sur la dernière série d’un exercice : la ligne reste sur l’exercice suivant', () => {
    renderAt('#/seance', stateInSession([done(80, 5), done(80, 5), todo(85, 5)]));
    validateSet();
    expect(screen.getByRole('heading', { level: 2, name: 'Développé couché' })).toBeInTheDocument();
    expect(dockStatus().textContent).toBe(
      'Nouveau record en squat : 85 kg ! Exercice terminé : squat. Repos : 90 s.',
    );
  });

  it('après chaque validation, la carte de la série en cours défile au-dessus du dock (sans animation sous mouvement réduit)', () => {
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    renderAt('#/seance', stateInSession([todo(85, 5), todo(85, 5), todo(85, 5)]));
    expect(scroll).not.toHaveBeenCalled();
    validateSet();
    expect(scroll).toHaveBeenCalledTimes(1);
    const card = scroll.mock.contexts[0] as HTMLElement;
    expect(card).toHaveClass('set-current');
    expect(card).toHaveTextContent('Série 2 sur 3');
    expect(card.style.scrollMarginBottom).toMatch(/px$/);
    expect(scroll.mock.calls[0][0]).toEqual({ block: 'nearest', behavior: 'smooth' });

    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    validateSet();
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(scroll.mock.contexts[1]).toHaveTextContent('Série 3 sur 3');
    expect(scroll.mock.calls[1][0]).toEqual({ block: 'nearest', behavior: 'auto' });
  });

  it('son de fin de repos activé : un record n’ajoute ni bip ni vibration par rapport à une validation sans record', () => {
    /** Valide la série 1 (son activé), puis laisse le repos se terminer ; compte bips et vibrations. */
    function run(weight: number) {
      resetRestChimeForTests();
      const oscillators = vi.fn();
      class FakeAudioContext {
        state = 'running';
        currentTime = 0;
        sampleRate = 44100;
        destination = {};
        resume = () => Promise.resolve();
        createBuffer = () => ({});
        createBufferSource = () => ({ connect: vi.fn(), start: vi.fn() });
        createOscillator = () => {
          oscillators();
          return { type: '', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
        };
        createGain = () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() });
      }
      const vibrate = vi.fn();
      vi.stubGlobal('navigator', { ...navigator, vibrate });
      vi.stubGlobal('AudioContext', FakeAudioContext);
      vi.useFakeTimers({ now: new Date(2026, 9, 30, 18, 10) });
      try {
        const s = stateInSession([todo(weight, 5), todo(weight, 5)]);
        expect(s.settings?.restSound).not.toBe(false); // son de fin de repos activé (défaut)
        const { unmount } = renderAt('#/seance', s);
        validateSet();
        const hasRecord = recordLine() !== null;
        const atValidation = { bips: oscillators.mock.calls.length, vibrations: vibrate.mock.calls.length };
        act(() => {
          vi.advanceTimersByTime(91_000);
        });
        expect(screen.getByText('Repos terminé.')).toBeInTheDocument();
        const afterRest = { bips: oscillators.mock.calls.length, vibrations: vibrate.mock.calls.length };
        unmount();
        return { hasRecord, atValidation, afterRest };
      } finally {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        resetRestChimeForTests();
      }
    }
    const withRecord = run(85); // bat 82,5 kg
    const withoutRecord = run(80);
    expect(withRecord.hasRecord).toBe(true);
    expect(withoutRecord.hasRecord).toBe(false);
    // Au tap : rien, record ou pas. En fin de repos : le même bip et la même vibration.
    expect(withRecord.atValidation).toEqual({ bips: 0, vibrations: 0 });
    expect(withRecord.atValidation).toEqual(withoutRecord.atValidation);
    expect(withoutRecord.afterRest).toEqual({ bips: 1, vibrations: 1 });
    expect(withRecord.afterRest).toEqual(withoutRecord.afterRest);
  });
});
