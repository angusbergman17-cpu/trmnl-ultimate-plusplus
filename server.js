require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const DataScraper = require('./data-scraper-ultimate-plus');
const PIDSRenderer = require('./pids-renderer');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize components
const scraper = new DataScraper();
const renderer = new PIDSRenderer();

// Cache for data and image
let cachedData = null;
let cachedImage = null;
let lastFetch = 0;
const CACHE_TTL = 30000; // 30 seconds

// ========== ROUTES ==========

// Root - status page
app.get('/', (req, res) => {
  res.send(`
    <html>
    <head><title>TRMNL Ultimate++</title></head>
    <body style="font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 20px;">
      <h1>🚆 TRMNL Ultimate++ Server</h1>
      <p style="color: green; font-weight: bold;">✅ Online</p>
      <h3>Endpoints:</h3>
      <ul>
        <li><a href="/api/data">/api/data</a> — Raw JSON data</li>
        <li><a href="/api/screen">/api/screen</a> — E-ink PNG image</li>
        <li><a href="/api/preview">/api/preview</a> — HTML preview</li>
        <li><a href="/debug/env">/debug/env</a> — Check environment variables</li>
      </ul>
      <h3>Configuration:</h3>
      <ul>
        <li>GTFS API Key: ${process.env.GTFS_API_KEY ? '✅ Set' : '❌ Not set'}</li>
        <li>Weather Key: ${process.env.WEATHER_KEY ? '✅ Set' : '❌ Not set'}</li>
      </ul>
      <p style="color: #666; font-size: 12px;">Last updated: ${new Date().toISOString()}</p>
    </body>
    </html>
  `);
});

// Debug endpoint to check environment variables
app.get('/debug/env', (req, res) => {
  res.json({
    GTFS_API_KEY_present: !!process.env.GTFS_API_KEY,
    GTFS_API_KEY_length: process.env.GTFS_API_KEY ? process.env.GTFS_API_KEY.length : 0,
    GTFS_API_KEY_preview: process.env.GTFS_API_KEY ? process.env.GTFS_API_KEY.substring(0, 10) + '...' : 'NOT SET',
    WEATHER_KEY_present: !!process.env.WEATHER_KEY,
    all_env_keys: Object.keys(process.env).filter(k => k.includes('GTFS') || k.includes('WEATHER') || k.includes('KEY'))
  });
});

// JSON data endpoint
app.get('/api/data', async (req, res) => {
  try {
    const data = await getDataWithCache();
    res.json(data);
  } catch (e) {
    console.error('Error fetching data:', e);
    res.status(500).json({ error: e.message });
  }
});

// HTML preview endpoint
app.get('/api/preview', async (req, res) => {
  try {
    const data = await getDataWithCache();
    const html = renderer.render(data);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (e) {
    console.error('Error rendering preview:', e);
    res.status(500).send(`<pre>Error: ${e.message}</pre>`);
  }
});

// E-ink image endpoint (for TRMNL device)
app.get('/api/screen', async (req, res) => {
  try {
    const now = Date.now();
    
    // Return cached image if fresh
    if (cachedImage && (now - lastFetch) < CACHE_TTL) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=30');
      return res.send(cachedImage);
    }

    // Fetch fresh data
    const data = await getDataWithCache();
    const html = renderer.render(data);

    // Render to PNG
    console.log('📸 Rendering image...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 480 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const imageBuffer = await page.screenshot({ 
      type: 'png',
      omitBackground: false
    });
    
    await browser.close();
    
    // Cache the result
    cachedImage = imageBuffer;
    lastFetch = now;
    
    console.log('📸 Image rendered successfully');
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.send(imageBuffer);
    
  } catch (e) {
    console.error('Error rendering screen:', e);
    res.status(500).json({ error: e.message });
  }
});

// ========== HELPERS ==========

async function getDataWithCache() {
  const now = Date.now();
  
  if (cachedData && (now - lastFetch) < CACHE_TTL) {
    return cachedData;
  }
  
  cachedData = await scraper.fetchAllData();
  lastFetch = now;
  return cachedData;
}

// ========== START SERVER ==========

app.listen(PORT, () => {
  console.log(`\n🚆 TRMNL Ultimate++ Server`);
  console.log(`   Running on port ${PORT}`);
  console.log(`\n📊 Endpoints:`);
  console.log(`   /           → Status page`);
  console.log(`   /api/data   → JSON data`);
  console.log(`   /api/screen → E-ink image`);
  console.log(`   /api/preview → HTML preview`);
  console.log(`   /debug/env  → Check env vars`);
  console.log(`\n🔑 API Keys:`);
  console.log(`   GTFS: ${process.env.GTFS_API_KEY ? 'Loaded' : 'Not set (using simulation)'}`);
  console.log(`   Weather: ${process.env.WEATHER_KEY ? 'Loaded' : 'Not set (using simulation)'}`);
  console.log('');
});
