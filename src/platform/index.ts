import { Capacitor } from '@capacitor/core';

/**
 * Services de plateforme (lot 4, docs/product/lot4-app-store.md §A.0) : les pages et composants
 * n'importent jamais `@capacitor/*` directement, tout passe par `src/platform/`.
 */

let native: boolean | undefined;
let name: string | undefined;

/** Vrai dans l'app iOS (Capacitor), faux sur le web (PWA, tests). Lu une fois. */
export function isNative(): boolean {
  if (native === undefined) {
    try {
      native = Capacitor.isNativePlatform();
    } catch {
      native = false;
    }
  }
  return native;
}

/** `'web'` ou `'ios'`. Lu une fois. */
export function platformName(): string {
  if (name === undefined) {
    try {
      name = Capacitor.getPlatform();
    } catch {
      name = 'web';
    }
  }
  return name;
}
