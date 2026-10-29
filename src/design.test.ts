import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Garde-fous de l'identité (docs/identity.md) : jetons, échelle typo, cibles tactiles, ton des textes. */

const SRC = join(process.cwd(), 'src');
const css = readFileSync(join(SRC, 'styles.css'), 'utf-8');

/** Retire les commentaires (une ligne et bloc) pour ne contrôler que le code et les textes. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Bloc `:root { … }` (premier niveau) et bloc sombre `@media (prefers-color-scheme: dark) { :root { … } }`. */
function block(source: string, start: string): string {
  const from = source.indexOf(start);
  expect(from).toBeGreaterThanOrEqual(0);
  return source.slice(from, source.indexOf('}', from));
}

const token = (scope: string, name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(scope)?.[1].trim().toLowerCase();

/** Rapport de contraste WCAG 2.x entre deux couleurs #rrggbb. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('identité visuelle', () => {
  it('jetons de couleur exacts du §6 (B · Améthyste), clair par défaut et sombre via prefers-color-scheme', () => {
    const light = block(css, ':root {');
    const dark = block(css, '@media (prefers-color-scheme: dark)');
    const expected: Record<string, [string, string]> = {
      '--bg': ['#f5f5fa', '#0b0b12'],
      '--surface': ['#ffffff', '#161620'],
      '--text': ['#13131c', '#f1f1f6'],
      '--text-muted': ['#5e5e71', '#a5a5ba'],
      '--border': ['#dddde6', '#31313f'],
      '--accent': ['#584cad', '#adaaf8'],
      '--accent-contrast': ['#ffffff', '#0b0b12'],
      '--success': ['#137a4b', '#34c27c'],
      '--danger': ['#c62828', '#ff6b6b'],
    };
    for (const [name, [l, d]] of Object.entries(expected)) {
      expect(token(light, name), name).toBe(l);
      expect(token(dark, name), name).toBe(d);
    }
  });

  it('contraste texte ≥ 4,5:1 en clair et en sombre (fond, cartes, texte posé sur l’accent et le danger)', () => {
    for (const scope of [block(css, ':root {'), block(css, '@media (prefers-color-scheme: dark)')]) {
      const t = (name: string) => token(scope, name)!;
      const pairs: [string, string][] = [
        ['--text', '--bg'],
        ['--text', '--surface'],
        ['--text-muted', '--bg'],
        ['--text-muted', '--surface'],
        ['--accent-contrast', '--accent'],
        ['--danger-contrast', '--danger'],
        ['--success', '--surface'],
        ['--danger', '--surface'],
      ];
      for (const [fg, bg] of pairs) {
        expect(contrast(t(fg), t(bg)), `${fg} sur ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('Inter pour le corps, Space Grotesk pour titres et chiffres, cibles 48 / 56 px, rayons 14 / 999 px', () => {
    const light = block(css, ':root {');
    expect(token(light, '--font-sans')).toMatch(/^'inter variable'/);
    expect(token(light, '--font-display')).toMatch(/^'space grotesk'/);
    expect(light).toContain('font-variant-numeric: tabular-nums');
    expect(token(light, '--touch')).toBe('48px');
    expect(token(light, '--touch-primary')).toBe('56px');
    expect(token(light, '--radius')).toBe('14px');
    expect(token(light, '--radius-pill')).toBe('999px');
  });

  it('Space Grotesk 700 tabulaire pour les noms, titres et tous les champs chiffrés (y compris le constructeur)', () => {
    // Règle groupée « font-family: var(--font-display) » : liste de sélecteurs juste avant le bloc.
    const rule = /([^{}]+)\{\s*font-family: var\(--font-display\);\s*font-weight: 700;[^}]*tabular-nums;[^}]*\}/.exec(css);
    expect(rule).not.toBeNull();
    const selectors = rule![1]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((sel) => sel.trim());
    for (const sel of [
      '.page__title',
      '.picker__title',
      '.session__name',
      '.template-card__name',
      '.history-item__name',
      '.detail-exercise__name',
      '.editor-item__name',
      '.number-field__input',
    ]) {
      expect(selectors, sel).toContain(sel);
    }
  });

  it('champs chiffrés non-héros : 18 px à 4 caractères, 16 px à 5, sans toucher au héros', () => {
    expect(css).toMatch(/\.number-field:not\(\.number-field--hero\) \.number-field__input\[data-len='4'\] \{\s*font-size: 18px;/);
    expect(css).toMatch(/\.number-field:not\(\.number-field--hero\) \.number-field__input\[data-len='5'\] \{\s*font-size: 16px;/);
  });

  it('barre d’onglets à 13 px (échelle 40 / 24 / 16 / 13)', () => {
    const item = /\.tabbar__item \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(item).toMatch(/font-size:\s*13px;/);
  });

  it('aucune taille de texte < 13 px', () => {
    const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) {
      const px = /^([\d.]+)px$/.exec(size);
      const rem = /^([\d.]+)rem$/.exec(size);
      if (px) expect(Number(px[1]), size).toBeGreaterThanOrEqual(13);
      else if (rem) expect(Number(rem[1]) * 16, size).toBeGreaterThanOrEqual(13);
      else expect(size, size).toMatch(/^var\(--fs-(display|title|body|caption)\)$/);
    }
  });

  it('Space Grotesk 500 et 700 embarquées via @fontsource (hors ligne)', () => {
    const fonts = readFileSync(join(SRC, 'fonts.css'), 'utf-8');
    for (const weight of [500, 700]) {
      expect(fonts).toContain(`@fontsource/space-grotesk/files/space-grotesk-latin-${weight}-normal.woff2`);
    }
  });

  it('signature pente 12° : crans de progression biseautés, un par exercice (--steps)', () => {
    const track = /\.session-progress__track \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(track).toContain('skewX(-12deg)');
    expect(track).toContain('var(--steps, 1)');
  });

  it('respecte prefers-reduced-motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('ton des textes', () => {
  const files = sourceFiles(SRC);

  it('tutoiement partout, jamais « OK »', () => {
    for (const file of files) {
      expect(readFileSync(file, 'utf-8'), file).not.toMatch(/\bvous\b|\bvos\b|\bvotre\b|>OK<|'OK'|"OK"|`OK`/i);
    }
  });

  it('pas d’impératif au vouvoiement (« Créez », « Ajoutez »…)', () => {
    // Mots courants en -ez qui ne sont pas des impératifs au vouvoiement.
    const allowed = new Set(['assez', 'chez', 'nez', 'rez']);
    for (const file of files) {
      const code = stripComments(readFileSync(file, 'utf-8'));
      const hits = [...code.matchAll(/\b[A-Za-zÀ-ÿ]{3,}ez\b/g)]
        .map((m) => m[0])
        .filter((word) => !allowed.has(word.toLowerCase()));
      expect(hits, file).toEqual([]);
    }
  });

  it('pas de « ! » dans les textes, sauf pour un record', () => {
    for (const file of files) {
      const lines = stripComments(readFileSync(file, 'utf-8')).split('\n');
      // « ! » collé à un mot puis fin de texte (guillemet, balise, accolade, fin de ligne) : ni « !== », ni « x! ».
      const hits = lines.filter((line) => /[A-Za-zÀ-ÿ0-9.)»]\s?!(?=\s*(['"`<{]|$))/.test(line) && !/record/i.test(line));
      expect(hits, file).toEqual([]);
    }
  });

  it('pas de pictogrammes Unicode à la place des icônes Lucide', () => {
    for (const file of files.filter((f) => f.endsWith('.tsx'))) {
      const code = readFileSync(file, 'utf-8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
      expect(code, file).not.toMatch(/[✓✕⋯↑↓←]/);
    }
  });
});
