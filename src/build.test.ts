import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PRIVACY_BLOCKS, PRIVACY_PLACEHOLDER, PRIVACY_TITLE, privacyBlockText } from './lib/privacyText';

/**
 * Les deux builds (lot 4, §4.1 critères 1 et 2, §4.8 critère 2), produits dans un dossier
 * temporaire : `dist/` n'est pas touché.
 */

const ROOT = process.cwd();
const VITE = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const PWA_FILES = ['sw.js', 'registerSW.js', 'manifest.webmanifest'];
const dirs: Record<'web' | 'native', string> = { web: '', native: '' };

function build(mode: 'production' | 'native'): string {
  const outDir = mkdtempSync(join(tmpdir(), `muscutrack-${mode}-`));
  execFileSync(process.execPath, [VITE, 'build', '--mode', mode, '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], {
    cwd: ROOT,
    stdio: 'pipe',
  });
  return outDir;
}

const decode = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

beforeAll(() => {
  dirs.web = build('production');
  dirs.native = build('native');
}, 120_000);

afterAll(() => {
  for (const dir of Object.values(dirs)) if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('build web (PWA)', () => {
  it('service worker et manifeste présents, comme avant le lot 4', () => {
    for (const file of PWA_FILES) expect(existsSync(join(dirs.web, file)), file).toBe(true);
    const index = readFileSync(join(dirs.web, 'index.html'), 'utf8');
    expect(index).toContain('manifest.webmanifest');
    expect(index).toContain('registerSW.js');
  });
});

describe('build natif (--mode native)', () => {
  it('ni service worker, ni registerSW.js, ni manifeste, et index.html n’y fait pas référence', () => {
    for (const file of PWA_FILES) expect(existsSync(join(dirs.native, file)), file).toBe(false);
    const index = readFileSync(join(dirs.native, 'index.html'), 'utf8');
    for (const file of ['sw.js', 'registerSW', 'manifest.webmanifest']) expect(index).not.toContain(file);
  });
});

describe('confidentialite.html', () => {
  for (const mode of ['web', 'native'] as const) {
    it(`${mode} : présente, autonome, avec le texte de l’app`, () => {
      const html = readFileSync(join(dirs[mode], 'confidentialite.html'), 'utf8');
      expect(html).not.toContain(PRIVACY_PLACEHOLDER);
      // Aucune ressource externe (ni script, ni feuille de style, ni police, ni lien absolu).
      expect(html).not.toMatch(/(src|href)\s*=\s*["']?\s*(https?:)?\/\//i);
      expect(html).not.toMatch(/<(script|link)\b/i);
      const text = decode(html);
      expect(text).toContain(PRIVACY_TITLE);
      for (const block of PRIVACY_BLOCKS) expect(text).toContain(privacyBlockText(block));
    });
  }
});
