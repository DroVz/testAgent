// Génère les icônes PWA à partir de l'icône de marque docs/brand/hybride-b/icon.svg (B · Améthyste).
// Rendu fidèle du SVG avec Playwright (dépendance de dev, Chromium : `npx playwright install chromium`).
// Usage : node scripts/generate-icons.mjs
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SOURCE = new URL('../docs/brand/hybride-b/icon.svg', import.meta.url);
const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const icon = readFileSync(SOURCE, 'utf-8');
const BRAND = /<rect[^>]*fill="(#[0-9A-Fa-f]{6})"/.exec(icon)[1];
const glyph = icon.replace(/^[\s\S]*?<rect[^>]*\/>/, '').replace(/<\/svg>\s*$/, '');

/** Fond plein carré (pas de coins arrondis : le système applique son propre masque), glyphe mis à l'échelle. */
const fullBleed = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${BRAND}"/>` +
  `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${glyph}</g></svg>`;

const TARGETS = [
  { file: 'icon-192.png', size: 192, svg: icon },
  { file: 'icon-512.png', size: 512, svg: icon },
  // Maskable : glyphe réduit à 80 % pour tenir dans la zone sûre (cercle de rayon 40 % du côté, soit un diamètre de 80 %).
  { file: 'icon-maskable-512.png', size: 512, svg: fullBleed(0.8) },
  // iOS arrondit lui-même les coins : fond plein.
  { file: 'apple-touch-icon.png', size: 180, svg: fullBleed(1) },
];

copyFileSync(SOURCE, new URL('icon.svg', OUT));

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { file, size, svg } of TARGETS) {
    await page.setViewportSize({ width: size, height: size });
    const sized = svg.replace('<svg ', `<svg style="display:block;width:${size}px;height:${size}px" `);
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`);
    await page.screenshot({ path: fileURLToPath(new URL(file, OUT)), omitBackground: true });
  }
} finally {
  await browser.close();
}
console.log('Icônes générées dans public/icons/');
