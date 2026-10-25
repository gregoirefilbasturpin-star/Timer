// Génère les icônes PNG de la PWA sans dépendance externe (rendu par champs de distance + zlib).
// Usage : npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const BG = [11, 13, 16];
const GREEN = [34, 197, 94];
const TRACK = [42, 50, 60];
const WHITE = [238, 242, 246];

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
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const coverage = (d) => Math.min(1, Math.max(0, 0.5 - d));

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdSegment(px, py, ax, ay, bx, by, r) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h) - r;
}

/**
 * @param size taille en pixels
 * @param maskable fond plein et contenu réduit à la zone de sécurité (80 %)
 */
function drawIcon(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const s = size;
  const scale = maskable ? 0.72 : 0.9;
  const cx = s / 2;
  const cy = s * (maskable ? 0.53 : 0.54);
  const R = s * 0.3 * scale;
  const ring = s * 0.075 * scale;
  const arcEnd = (300 / 360) * 2 * Math.PI; // arc vert de 300°
  const handAngle = arcEnd - Math.PI / 2;

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let color = [0, 0, 0];
      let alpha = 0;
      const paint = (c, a) => {
        if (a <= 0) return;
        color = color.map((v, i) => v * (1 - a) + c[i] * a);
        alpha = alpha + a * (1 - alpha);
      };

      const bgDist = maskable ? -1 : sdRoundRect(px, py, cx, s / 2, s / 2, s / 2, s * 0.22);
      paint(BG, coverage(bgDist));

      // Anneau : arc vert depuis midi dans le sens horaire, reste en gris.
      const dist = Math.hypot(px - cx, py - cy);
      const ringCov = coverage(Math.abs(dist - R) - ring / 2);
      let angle = Math.atan2(px - cx, -(py - cy));
      if (angle < 0) angle += 2 * Math.PI;
      paint(angle <= arcEnd ? GREEN : TRACK, ringCov);

      // Bouton du chronomètre
      paint(WHITE, coverage(sdRoundRect(px, py, cx, cy - R - ring * 1.6, ring * 0.9, ring * 0.55, ring * 0.3)));

      // Aiguille et axe
      const hx = cx + Math.cos(handAngle) * R * 0.62;
      const hy = cy + Math.sin(handAngle) * R * 0.62;
      paint(WHITE, coverage(sdSegment(px, py, cx, cy, hx, hy, ring * 0.32)));
      paint(WHITE, coverage(dist - ring * 0.6));

      const i = (y * s + x) * 4;
      // Couleur stockée non prémultipliée
      rgba[i] = alpha ? Math.round(color[0] / alpha) : 0;
      rgba[i + 1] = alpha ? Math.round(color[1] / alpha) : 0;
      rgba[i + 2] = alpha ? Math.round(color[2] / alpha) : 0;
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, rgba);
}

const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['maskable-512.png', 512, true],
];

for (const [name, size, maskable] of targets) {
  writeFileSync(new URL(name, OUT), drawIcon(size, maskable));
  console.log(`public/icons/${name}`);
}
