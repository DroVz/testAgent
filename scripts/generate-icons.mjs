// Génère les icônes PWA (SVG + PNG 192/512) sans dépendance externe.
// Usage : node scripts/generate-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const BG = [0x12, 0x12, 0x12];
const FG = [0xff, 0x8a, 0x3d];

// Haltère en coordonnées relatives (0..1) : [x, y, largeur, hauteur]
const RECTS = [
  [0.2, 0.47, 0.6, 0.06], // barre
  [0.22, 0.32, 0.08, 0.36], // disque gauche ext.
  [0.31, 0.37, 0.06, 0.26], // disque gauche int.
  [0.7, 0.32, 0.08, 0.36], // disque droit ext.
  [0.63, 0.37, 0.06, 0.26], // disque droit int.
];

function svg() {
  const r = RECTS.map(
    ([x, y, w, h]) =>
      `<rect x="${x * 512}" y="${y * 512}" width="${w * 512}" height="${h * 512}" rx="6" fill="#ff8a3d"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#121212"/>${r}</svg>\n`;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // filtre : aucun
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const inside = RECTS.some(([rx, ry, rw, rh]) => u >= rx && u < rx + rw && v >= ry && v < ry + rh);
      const [r, g, b] = inside ? FG : BG;
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(new URL('icon.svg', OUT), svg());
for (const s of [192, 512]) writeFileSync(new URL(`icon-${s}.png`, OUT), png(s));
console.log('Icônes générées dans public/icons/');
