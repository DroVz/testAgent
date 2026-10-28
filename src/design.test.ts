import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Garde-fous de l'identité (docs/identity.md) : jetons, échelle typo, cibles tactiles, ton des textes. */

const SRC = join(process.cwd(), 'src');
const css = readFileSync(join(SRC, 'styles.css'), 'utf-8');

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

describe('identité visuelle', () => {
  it('jetons de couleur exacts du §6, clair par défaut et sombre via prefers-color-scheme', () => {
    const light = block(css, ':root {');
    const dark = block(css, '@media (prefers-color-scheme: dark)');
    const expected: Record<string, [string, string]> = {
      '--bg': ['#f7f7f4', '#0f1114'],
      '--surface': ['#ffffff', '#181b20'],
      '--text': ['#111418', '#f2f3f5'],
      '--text-muted': ['#5b636e', '#9aa3af'],
      '--border': ['#e3e5e8', '#2a2f36'],
      '--accent': ['#e8481c', '#ff6a3d'],
      '--success': ['#137a4b', '#34c27c'],
      '--danger': ['#c62828', '#ff6b6b'],
    };
    for (const [name, [l, d]] of Object.entries(expected)) {
      expect(token(light, name), name).toBe(l);
      expect(token(dark, name), name).toBe(d);
    }
  });

  it('Inter en premier, chiffres tabulaires, cibles 48 / 56 px, rayons 12 / 999 px', () => {
    const light = block(css, ':root {');
    expect(token(light, '--font-sans')).toMatch(/^'inter variable'/);
    expect(light).toContain('font-variant-numeric: tabular-nums');
    expect(token(light, '--touch')).toBe('48px');
    expect(token(light, '--touch-primary')).toBe('56px');
    expect(token(light, '--radius')).toBe('12px');
    expect(token(light, '--radius-pill')).toBe('999px');
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

  it('respecte prefers-reduced-motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('ton des textes', () => {
  const files = sourceFiles(SRC);

  it('tutoiement partout, jamais « OK »', () => {
    for (const file of files) {
      expect(readFileSync(file, 'utf-8'), file).not.toMatch(/\bvous\b|\bvos\b|\bvotre\b|>OK<|'OK'/i);
    }
  });

  it('pas de pictogrammes Unicode à la place des icônes Lucide', () => {
    for (const file of files.filter((f) => f.endsWith('.tsx'))) {
      const code = readFileSync(file, 'utf-8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
      expect(code, file).not.toMatch(/[✓✕⋯↑↓←]/);
    }
  });
});
