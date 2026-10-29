import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** Durée d'affichage d'un toast (identity.md §4.8 : « Annuler » pendant 5 s). */
export const TOAST_DURATION_MS = 5000;

export interface ToastOptions {
  /** Phrase courte qui dit ce qui vient de se passer : « Séance supprimée. ». */
  message: string;
  /** Annule l'action. Sans `onUndo`, le toast n'a pas de bouton. */
  onUndo?: () => void;
  /** Nom accessible du bouton « Annuler » (par défaut : « Annuler la suppression »). */
  undoLabel?: string;
}

interface ToastData extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: ToastData | null;
  /** Affiche un toast ; il remplace le précédent (dont l'action reste validée). Renvoie son id. */
  show(options: ToastOptions): number;
  /** Ferme le toast `id` s'il est encore affiché (sans id : ferme le toast courant). */
  dismiss(id?: number): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Un seul toast à la fois ; il se ferme seul après `TOAST_DURATION_MS`. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const nextId = useRef(1);

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setToast({ ...options, id });
    return id;
  }, []);

  const dismiss = useCallback((id?: number) => {
    setToast((current) => (current && (id === undefined || current.id === id) ? null : current));
  }, []);

  // Chaque nouveau toast relance le délai de 5 s.
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => dismiss(toast.id), TOAST_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [toast, dismiss]);

  const value = useMemo(() => ({ toast, show, dismiss }), [toast, show, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): Pick<ToastContextValue, 'show' | 'dismiss'> {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>.');
  return { show: ctx.show, dismiss: ctx.dismiss };
}

/**
 * Zone du toast : `role="status"` toujours présente dans l'arbre (vide sans toast), pour que les
 * lecteurs d'écran annoncent le message dès qu'il apparaît.
 * `floating` : fixée en bas de l'écran, au-dessus de la barre d'onglets (ou de la zone sûre).
 * `inline` : dans le bas d'écran d'une page qui a son propre bouton principal fixe (séance,
 * constructeur), juste au-dessus de ce bouton, pour ne jamais le masquer.
 */
export function ToastHost({ placement, aboveTabbar = false }: { placement: 'floating' | 'inline'; aboveTabbar?: boolean }) {
  const ctx = useContext(ToastContext);
  const toast = ctx?.toast;
  const className = [
    'toast-region',
    `toast-region--${placement}`,
    placement === 'floating' && aboveTabbar ? 'toast-region--above-tabbar' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={className} role="status">
      {ctx && toast && (
        <div key={toast.id} className="toast">
          <span className="toast__message">{toast.message}</span>
          {toast.onUndo && (
            <button
              type="button"
              className="toast__undo"
              aria-label={toast.undoLabel ?? 'Annuler la suppression'}
              onClick={() => {
                toast.onUndo?.();
                ctx.dismiss(toast.id);
              }}
            >
              Annuler
            </button>
          )}
        </div>
      )}
    </div>
  );
}
