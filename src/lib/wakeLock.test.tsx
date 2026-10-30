import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './wakeLock';

function fakeWakeLock() {
  const sentinels: { released: boolean; release: ReturnType<typeof vi.fn> }[] = [];
  const request = vi.fn(() => {
    const s = {
      released: false,
      release: vi.fn(() => {
        s.released = true;
        return Promise.resolve();
      }),
    };
    sentinels.push(s);
    return Promise.resolve(s);
  });
  return { wakeLock: { request }, request, sentinels };
}

function Probe({ enabled, wakeLock }: { enabled: boolean; wakeLock?: Parameters<typeof useWakeLock>[1] }) {
  useWakeLock(enabled, wakeLock);
  return null;
}

let visibility: DocumentVisibilityState = 'visible';
const setVisibility = async (v: DocumentVisibilityState) => {
  visibility = v;
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

describe('useWakeLock', () => {
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  afterEach(() => {
    visibility = 'visible';
  });

  it('demande l’écran allumé au montage et le relâche au démontage', async () => {
    const { wakeLock, request, sentinels } = fakeWakeLock();
    const { unmount } = render(<Probe enabled wakeLock={wakeLock} />);
    await act(async () => {});
    expect(request).toHaveBeenCalledWith('screen');
    expect(request).toHaveBeenCalledTimes(1);
    unmount();
    expect(sentinels[0].release).toHaveBeenCalledTimes(1);
  });

  it('le redemande quand la page redevient visible (le navigateur l’a relâché)', async () => {
    const { wakeLock, request, sentinels } = fakeWakeLock();
    render(<Probe enabled wakeLock={wakeLock} />);
    await act(async () => {});
    // Arrière-plan : le système relâche le verrou ; on ne redemande pas tant que la page est masquée.
    sentinels[0].released = true;
    await setVisibility('hidden');
    expect(request).toHaveBeenCalledTimes(1);
    await setVisibility('visible');
    expect(request).toHaveBeenCalledTimes(2);
    // Déjà tenu : pas de double demande.
    await setVisibility('visible');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('désactivé : aucune demande ; repasser à faux relâche le verrou', async () => {
    const { wakeLock, request, sentinels } = fakeWakeLock();
    const { rerender } = render(<Probe enabled={false} wakeLock={wakeLock} />);
    expect(request).not.toHaveBeenCalled();
    rerender(<Probe enabled wakeLock={wakeLock} />);
    await act(async () => {});
    rerender(<Probe enabled={false} wakeLock={wakeLock} />);
    expect(sentinels[0].release).toHaveBeenCalledTimes(1);
  });

  it('démonté avant la réponse : le verrou obtenu est relâché aussitôt', async () => {
    const { wakeLock, sentinels } = fakeWakeLock();
    const { unmount } = render(<Probe enabled wakeLock={wakeLock} />);
    unmount();
    await act(async () => {});
    expect(sentinels[0].release).toHaveBeenCalledTimes(1);
  });

  it('API absente ou refus : rien ne se passe, aucune erreur', async () => {
    render(<Probe enabled wakeLock={undefined} />);
    const refused = { request: vi.fn(() => Promise.reject(new Error('NotAllowedError'))) };
    render(<Probe enabled wakeLock={refused} />);
    await act(async () => {});
    expect(refused.request).toHaveBeenCalledTimes(1);
    const throwing = {
      request: vi.fn(() => {
        throw new Error('x');
      }),
    };
    render(<Probe enabled wakeLock={throwing} />);
    await act(async () => {});
  });
});
