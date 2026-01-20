
import express from 'express';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { fetch } from 'undici';

const router = express.Router();

// ---- Utils --------------------------------------------------------------

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function sanitizeHex(hex, fallback) {
  const v = String(hex || '').replace(/[^0-9a-f]/gi, '');
  return v.length === 3 || v.length === 6 ? `#${v}` : fallback;
}

function etag(buf) {
  return '"' + crypto.createHash('md5').update(buf).digest('hex') + '"';
}

// Tiny gray PNG fallback (1×1) so we never 500 just for content
const TINY_FALLBACK = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/VDmJ9kAAAAASUVORK5CYII=',
  'base64'
);

// Render an SVG with centered text, then rasterize with sharp
function textSvg({ w, h, text, color }) {
  const fontSize = Math.floor(Math.min(w, h) * 0.18);
  const safeText = (text || '').slice(0, 120).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect width="100%" height="100%" fill="none"/>
      <style>
        @supports (font-variation-settings: normal) {
          text { font-family: "Inter var", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
        }
      </style>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-size="${fontSize}" fill="${color}" font-weight="700">
        ${safeText || ''}
      </text>
    </svg>`;
}

// Normalize/transform to a consistent PNG
async function toPng({ input, w, h, grayscale, quality = 9, background = '#111827', text, color }) {
  const width = clamp(Number(w) || 480, 64, 2048);
  const height = clamp(Number(h) || 480, 64, 2048);
  const bg = sanitizeHex(background, '#111827');
  const fg = sanitizeHex(color, '#ffffff');

  let img;

  if (input) {
    // Start from remote image buffer
    img = sharp(input, { failOn: false }).resize(width, height, { fit: 'cover', position: 'entropy' });
  } else {
    // Start from a solid background
    img = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: bg
      }
    });
  }

  if (grayscale === '1' || grayscale === 'true') {
    img = img.grayscale();
  }

  // Overlay text if any
  if (text) {
    const svg = Buffer.from(textSvg({ w: width, h: height, text, color: fg }));
    img = img.composite([{ input: svg, top: 0, left: 0 }]);
  }

  // PNG output
  const out = await img.png({ compressionLevel: clamp(Number(quality) || 9, 0, 9) }).toBuffer();
  return out;
}

// Fetch a remote image safely with timeout
async function fetchRemote(url, timeoutMs = 7000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Remote fetch failed: ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } finally {
    clearTimeout(t);
  }
}

// ---- Route --------------------------------------------------------------

/**
 * GET /api/screen
 * Examples:
 *   /api/screen
 *   /api/screen?text=Hello
 *   /api/screen?url=https://picsum.photos/800/600.jpg&w=512&h=512
 *   /api/screen?text=Hi&bg=0ea5e9&color=001219
 */
router.get('/screen', async (req, res) => {
  try {
    const { url, w, h, grayscale, quality, bg, text, color } = req.query;

    let baseBuf = null;
    if (url) {
      try {
        baseBuf = await fetchRemote(url);
      } catch (e) {
        // Fall back to tiny pixel if remote fails; still return a valid PNG
        baseBuf = TINY_FALLBACK;
      }
    }

    const png = await toPng({
      input: baseBuf,
      w,
      h,
      grayscale,
      quality,
      background: bg,
      text,
      color
    });

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
      ETag: etag(png)
    });

    // If If-None-Match matches, honor it
    if (req.headers['if-none-match'] === etag(png)) {
      return res.status(304).end();
    }

    return res.status(200).send(png);
  } catch (err) {
    // As a last resort, always return *some* PNG
    res.set('Content-Type', 'image/png');
    return res.status(200).send(TINY_FALLBACK);
  }
});

export default router;
``
