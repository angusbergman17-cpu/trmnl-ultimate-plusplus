
// routes/screen.js (CommonJS)
const crypto = require('crypto');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Normalize any input buffer to TRMNL OG spec:
 * - 800x480 resolution (fit: fill)
 * - grayscale
 * - no alpha
 * - PNG output
 */
async function normalizeToTrmnlOG(buf) {
  return await sharp(buf)
    .resize(800, 480, { fit: 'fill' })
    .removeAlpha()
    .grayscale()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function etagOf(buf) {
  return '"' + crypto.createHash('md5').update(buf).digest('hex') + '"';
}

/**
 * Local fallback image (preferred) or a known-good remote PNG.
 * You can generate a local fallback with:
 *   magick -size 800x480 canvas:white -colorspace Gray -alpha off public/fallback-800x480-gray.png
 */
async function loadLocalFallback() {
  const p = path.join(process.cwd(), 'public', 'fallback-800x480-gray.png');
  if (fs.existsSync(p)) {
    const raw = fs.readFileSync(p);
    return await normalizeToTrmnlOG(raw);
  }
  // Remote fallback: a small, public, e-ink-friendly PNG
  const r = await fetch('https://usetrmnl.com/images/kindle.png');
  if (!r.ok) throw new Error(`Remote fallback fetch failed: ${r.status}`);
  const raw = Buffer.from(await r.arrayBuffer());
  return await normalizeToTrmnlOG(raw);
}

/**
 * Mounts the image + diagnostics endpoints on an existing Express app instance.
 *
 * Endpoints:
 *   GET /api/screen       -> image/png (always returns an image, never HTML)
 *   GET /api/diagnostics  -> JSON timings and byte sizes (helps confirm server-side correctness)
 *
 * Environment (optional):
 *   SCREEN_SRC_URL        -> upstream image URL to proxy+normalize (e.g. a PNG you already host)
 *                            If unset, a local/remote fallback image is served so devices still render.
 */
module.exports = function mountScreenRoutes(app) {
  const SCREEN_SRC_URL = process.env.SCREEN_SRC_URL;

  app.get('/api/screen', async (req, res) => {
    const lm = new Date();
    try {
      let srcBuf;

      if (SCREEN_SRC_URL) {
        // Node 18+ has global fetch; Render runs on a modern Node by default.
        const r = await fetch(SCREEN_SRC_URL, { redirect: 'follow' });
        if (!r.ok) throw new Error(`Upstream ${r.status} ${SCREEN_SRC_URL}`);
        srcBuf = Buffer.from(await r.arrayBuffer());
      } else {
        srcBuf = await loadLocalFallback();
      }

      const png = await normalizeToTrmnlOG(srcBuf);

      // Headers to help TRMNL re-process on change (and to prevent stale caching)
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'no-cache');
      res.set('ETag', etagOf(png));
      res.set('Last-Modified', lm.toUTCString());

      res.status(200).send(png);
    } catch (err) {
      console.error('[api/screen] error:', err);

      // Always send a valid image so e-ink devices still render something
      try {
        const png = await loadLocalFallback();
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'no-cache');
        res.set('ETag', etagOf(png));
        res.set('Last-Modified', new Date().toUTCString());
        res.status(200).send(png);
      } catch (fallbackErr) {
        console.error('[api/screen] fallback error:', fallbackErr);
        res.status(503).set('Content-Type', 'text/plain').send('Service temporarily unavailable');
      }
    }
  });

  app.get('/api/diagnostics', async (req, res) => {
    const started = Date.now();
    const out = { now: new Date().toISOString(), ok: false, steps: [] };

    try {
      // Fetch (either upstream or fallback)
      const f0 = Date.now();
      let src;
      if (process.env.SCREEN_SRC_URL) {
        const r = await fetch(process.env.SCREEN_SRC_URL);
        if (!r.ok) throw new Error(`Upstream ${r.status} ${process.env.SCREEN_SRC_URL}`);
        src = Buffer.from(await r.arrayBuffer());
      } else {
        src = await loadLocalFallback();
      }
      out.steps.push({
        name: 'fetch',
        ms: Date.now() - f0,
        bytes: src?.length || 0,
        ok: !!src && src.length > 1000
      });

      // Normalize
      const n0 = Date.now();
      const png = await normalizeToTrmnlOG(src);
      out.steps.push({
        name: 'normalize',
        ms: Date.now() - n0,
        bytes: png.length,
        ok: png.length > 1000
      });

      out.total_ms = Date.now() - started;
      out.ok = out.steps.every(s => s.ok);
      res.json(out);
    } catch (e) {
      out.error = String(e);
      out.total_ms = Date.now() - started;
      res.status(200).json(out);
    }
  });
};
