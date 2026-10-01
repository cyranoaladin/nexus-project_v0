import { deflateSync } from 'node:zlib';

/** 5x7 bitmap glyphs for the synthetic canary text (no student data, no font dependency). */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  X: ['10001', '01010', '00100', '00100', '00100', '01010', '10001'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Renders `text` (only the characters in GLYPHS) as a black-on-white greyscale PNG. */
export function renderTextPng(text: string, scale = 10, margin = 20): Buffer {
  const glyphs = [...text].map((character) => {
    const glyph = GLYPHS[character];
    if (!glyph) throw new Error(`Unsupported canary glyph: ${character}`);
    return glyph;
  });
  const width = margin * 2 + glyphs.length * 6 * scale;
  const height = margin * 2 + 7 * scale;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width, 0xff);
    row[0] = 0;
    const glyphRow = Math.floor((y - margin) / scale);
    if (glyphRow >= 0 && glyphRow < 7) {
      glyphs.forEach((glyph, index) => {
        for (let column = 0; column < 5; column += 1) {
          if (glyph[glyphRow][column] !== '1') continue;
          const startX = margin + (index * 6 + column) * scale;
          for (let dx = 0; dx < scale; dx += 1) row[1 + startX + dx] = 0x00;
        }
      });
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 0; // greyscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
