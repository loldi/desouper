/**
 * Generates PNG icons for the Desouper extension.
 * Uses raw PNG encoding (no dependencies).
 * Creates a bold "DS" monogram on a vibrant background.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size) {
  const pixels = Buffer.alloc(size * size * 4);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;

  // Color palette
  const bgR = 99, bgG = 102, bgB = 241;   // indigo-500
  const fgR = 255, fgG = 255, fgB = 255;  // white

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        pixels[idx] = bgR;
        pixels[idx + 1] = bgG;
        pixels[idx + 2] = bgB;
        pixels[idx + 3] = 255;
      } else {
        pixels[idx + 3] = 0;
      }
    }
  }

  // Draw "D" and "S" using simple bitmap patterns scaled to size
  drawLetterD(pixels, size);
  drawLetterS(pixels, size);

  return encodePNG(pixels, size, size);
}

function setPixel(pixels, size, x, y, r, g, b, a) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= size || y < 0 || y >= size) return;

  const cx = size / 2;
  const cy = size / 2;
  const dx = x - cx + 0.5;
  const dy = y - cy + 0.5;
  if (Math.sqrt(dx * dx + dy * dy) > size / 2) return;

  const idx = (y * size + x) * 4;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
  pixels[idx + 3] = a;
}

function fillRect(pixels, size, x0, y0, w, h) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(pixels, size, Math.floor(x0 + dx), Math.floor(y0 + dy), 255, 255, 255, 255);
    }
  }
}

function drawLetterD(pixels, size) {
  const s = size / 16;
  const x0 = size * 0.18;
  const y0 = size * 0.28;
  const h = size * 0.44;
  const w = size * 0.28;
  const t = Math.max(1, Math.floor(s * 1.8));

  // Vertical bar
  fillRect(pixels, size, x0, y0, t, h);
  // Top horizontal
  fillRect(pixels, size, x0, y0, w * 0.7, t);
  // Bottom horizontal
  fillRect(pixels, size, x0, y0 + h - t, w * 0.7, t);
  // Right curve approximated with vertical segments
  for (let i = 0; i < h; i++) {
    const frac = i / h;
    const curve = Math.sin(frac * Math.PI);
    const rx = x0 + w * 0.5 + curve * w * 0.35;
    fillRect(pixels, size, rx, y0 + i, t, 1);
  }
}

function drawLetterS(pixels, size) {
  const x0 = size * 0.52;
  const y0 = size * 0.28;
  const h = size * 0.44;
  const w = size * 0.30;
  const t = Math.max(1, Math.floor(size / 16 * 1.8));
  const halfH = h / 2;

  // Top horizontal
  fillRect(pixels, size, x0, y0, w, t);
  // Left vertical (top half)
  fillRect(pixels, size, x0, y0, t, halfH);
  // Middle horizontal
  fillRect(pixels, size, x0, y0 + halfH - t / 2, w, t);
  // Right vertical (bottom half)
  fillRect(pixels, size, x0 + w - t, y0 + halfH, t, halfH);
  // Bottom horizontal
  fillRect(pixels, size, x0, y0 + h - t, w, t);
}

function encodePNG(pixels, width, height) {
  // Build raw image data with filter byte per row
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // no filter
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeB, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData) >>> 0, 0);

  return Buffer.concat([len, typeB, data, crc]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return crc ^ 0xFFFFFFFF;
}

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

for (const size of sizes) {
  const png = createPNG(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`  Created icon${size}.png (${png.length} bytes)`);
}

console.log('Done.');
