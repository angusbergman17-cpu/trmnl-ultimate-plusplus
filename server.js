
// server.js
const express = require('express');
const path = require('path');
const { scrapeAll } = require('./data-scraper-ultimate-plus');
const config = require('./config');

const app = express();

// simple in-memory cache
let lastData = null;
let lastRendered = 0;

app.get('/api/status', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get('/api/data', async (req, res) => {
  try {
    // refresh each cycle
    if (!lastData || (Date.now() - lastRendered) > (config.app.refreshSeconds * 1000)) {
      lastData = await scrapeAll();
      lastRendered = Date.now();
      console.log('♻️  Refreshing Data...');
    }
    res.json(lastData);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Example TRMNL endpoints (stubbed)
app.post('/api/screen', (req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] 📨 POST /api/screen`);
  res.json({ ok: true });
});
app.get('/api/live-image.png', (req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] 📨 GET /api/live-image.png${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`);
  // You can integrate rendering pipeline here; for now, return 1x1 PNG
  const png1x1 = Buffer.from('89504E470D0A1A0A0000000D494844520000000100000001010300000025DB56CA00000003504C5445000000A7A7A7C5', 'hex');
  res.setHeader('Content-Type', 'image/png');
  res.send(png1x1);
});

// Root page: basic info
app.get('/', (req, res) => {
  res.type('text/plain').send('TRMNL ULTIMATE++ is running.\nSee /api/data for JSON.');
});

const port = config.app.port;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
