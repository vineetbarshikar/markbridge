/**
 * Icon Generator for MarkBridge Extension
 *
 * Generates PNG icons at 16x16, 48x48, and 128x128 from an SVG template.
 * Requires Node.js — no external dependencies (uses built-in canvas workaround).
 *
 * Usage: node scripts/generate-icons.js
 *
 * If the `canvas` npm package is not available, this script generates
 * simple valid PNG files programmatically (no anti-aliasing, but works
 * perfectly as Chrome extension icons).
 */

const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

/**
 * Creates a minimal valid PNG file with a simple icon design.
 * This uses raw PNG encoding without any dependencies.
 */
function createPNG(size) {
  // We'll create a simple icon: blue rounded rectangle with "M↓" text feel
  // Using raw pixel manipulation

  const pixels = new Uint8Array(size * size * 4); // RGBA

  const bgColor = [0, 82, 204, 255]; // #0052CC (Atlassian blue)
  const fgColor = [255, 255, 255, 255]; // White

  // Fill background with rounded corners
  const radius = Math.max(2, Math.floor(size * 0.18));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let inside = true;

      // Check rounded corners
      if (x < radius && y < radius) {
        inside = (radius - x) ** 2 + (radius - y) ** 2 <= radius ** 2;
      } else if (x >= size - radius && y < radius) {
        inside =
          (x - (size - radius - 1)) ** 2 + (radius - y) ** 2 <= radius ** 2;
      } else if (x < radius && y >= size - radius) {
        inside =
          (radius - x) ** 2 + (y - (size - radius - 1)) ** 2 <= radius ** 2;
      } else if (x >= size - radius && y >= size - radius) {
        inside =
          (x - (size - radius - 1)) ** 2 + (y - (size - radius - 1)) ** 2 <=
          radius ** 2;
      }

      if (inside) {
        pixels[idx] = bgColor[0];
        pixels[idx + 1] = bgColor[1];
        pixels[idx + 2] = bgColor[2];
        pixels[idx + 3] = bgColor[3];
      } else {
        pixels[idx + 3] = 0; // Transparent
      }
    }
  }

  // Draw a simple "Md" / arrow-down symbol using thick lines
  const margin = Math.max(3, Math.floor(size * 0.22));
  const lineW = Math.max(1, Math.floor(size * 0.08));

  // Draw three horizontal lines (representing text/markdown lines)
  const lineYPositions = [0.30, 0.50, 0.70];
  const lineWidths = [0.60, 0.45, 0.60];

  for (let li = 0; li < 3; li++) {
    const cy = Math.floor(size * lineYPositions[li]);
    const lw = Math.floor(size * lineWidths[li]);
    const startX = margin;
    const endX = startX + lw;

    for (let dy = -Math.floor(lineW / 2); dy <= Math.floor(lineW / 2); dy++) {
      const y = cy + dy;
      if (y < 0 || y >= size) continue;
      for (let x = startX; x < endX && x < size - 2; x++) {
        const idx = (y * size + x) * 4;
        if (pixels[idx + 3] > 0) {
          // Only draw on the background
          pixels[idx] = fgColor[0];
          pixels[idx + 1] = fgColor[1];
          pixels[idx + 2] = fgColor[2];
          pixels[idx + 3] = fgColor[3];
        }
      }
    }
  }

  // Draw a down-arrow on the right side
  if (size >= 32) {
    const arrowCX = Math.floor(size * 0.75);
    const arrowTop = Math.floor(size * 0.30);
    const arrowBot = Math.floor(size * 0.70);
    const arrowW = Math.max(1, Math.floor(size * 0.06));

    // Vertical line
    for (let y = arrowTop; y <= arrowBot; y++) {
      for (let dx = -arrowW; dx <= arrowW; dx++) {
        const x = arrowCX + dx;
        if (x >= 0 && x < size && y >= 0 && y < size) {
          const idx = (y * size + x) * 4;
          if (pixels[idx + 3] > 0) {
            pixels[idx] = fgColor[0];
            pixels[idx + 1] = fgColor[1];
            pixels[idx + 2] = fgColor[2];
          }
        }
      }
    }

    // Arrow head (chevron)
    const chevronH = Math.floor(size * 0.12);
    for (let i = 0; i <= chevronH; i++) {
      const y = arrowBot - chevronH + i;
      for (let dx = -(i + arrowW); dx <= i + arrowW; dx++) {
        const x = arrowCX + dx;
        if (x >= 0 && x < size && y >= 0 && y < size) {
          const idx = (y * size + x) * 4;
          if (pixels[idx + 3] > 0) {
            pixels[idx] = fgColor[0];
            pixels[idx + 1] = fgColor[1];
            pixels[idx + 2] = fgColor[2];
          }
        }
      }
    }
  }

  return encodePNG(size, size, pixels);
}

/**
 * Minimal PNG encoder (no dependencies).
 * Creates a valid PNG from RGBA pixel data.
 */
function encodePNG(width, height, pixels) {
  const zlib = require('zlib');

  // Build raw image data (filter byte + row data)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // No filter
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = rowOffset + 1 + x * 4;
      rawData[dstIdx] = pixels[srcIdx];
      rawData[dstIdx + 1] = pixels[srcIdx + 1];
      rawData[dstIdx + 2] = pixels[srcIdx + 2];
      rawData[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG file structure
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── Generate Icons ──────────────────────────────────────────────
const sizes = [16, 48, 128];

sizes.forEach((size) => {
  const png = createPNG(size);
  const filepath = path.join(ICONS_DIR, `icon${size}.png`);
  fs.writeFileSync(filepath, png);
  console.log(`✓ Generated ${filepath} (${size}×${size}, ${png.length} bytes)`);
});

console.log('\nDone! Icons saved to icons/ directory.');
