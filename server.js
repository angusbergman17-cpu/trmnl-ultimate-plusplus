const express = require('express');
const config = require('./config');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');
const PidsRenderer = require('./pids-renderer');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize our classes
const scraper = new DataScraper();
const coffeeDecision = new CoffeeDecision();
const renderer = new PidsRenderer();

// --- 1. CONFIG DASHBOARD (Optional web view) ---
app.get('/config', (req, res) => {
  res.send(`<h1>TRMNL Config</h1><p>Display: ${config.display.width}x${config.display.height}</p><p>Refresh: ${config.behavior.partialRefresh/1000}s</p>`);
});

// --- 2. STATUS PAGE (For debugging) ---
app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; padding: 2rem; background: #222; color: #fff;">
        <h1>🚂 TRMNL Melbourne PT Server</h1>
        <p>Status: <span style="color: #4ade80; font-weight: bold;">ONLINE</span></p>
        <p>Use the TRMNL device URL below:</p>
        <code style="background: #333; padding: 10px; display: block;">${req.protocol}://${req.get('host')}/api/screen</code>
      </body>
    </html>
  `);
});

// --- 3. DATA API (JSON) ---
app.get('/api/data', async (req, res) => {
  try {
    const data = await scraper.fetchAllData();
    const coffee = coffeeDecision.calculate();
    res.json({
      timestamp: new Date().toISOString(),
      coffee,
      data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 4. SCREEN RENDER API (The critical part for TRMNL) ---
app.get('/api/screen', async (req, res) => {
  try {
    console.log('Rendering screen for TRMNL...');
    
    // A. Fetch all live data
    const data = await scraper.fetchAllData();
    const coffee = coffeeDecision.calculate();
    
    // B. Render the image (SVG -> Sharp -> PNG)
    // This calls your updated pids-renderer.js
    const imageBuffer = await renderer.render(data, coffee, true);
    
    // C. Calculate Refresh Times
    const now = new Date();
    const nextPartial = new Date(now.getTime() + config.behavior.partialRefresh); // +20s
    const nextFull = new Date(now.getTime() + config.behavior.fullRefresh);       // +5m
    
    // D. Send Response with TRMNL Headers
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // CRITICAL: These tell the device when to wake up next
    res.set('X-TRMNL-Partial-Refresh', nextPartial.toISOString());
    res.set('X-TRMNL-Full-Refresh', nextFull.toISOString());
    
    res.send(imageBuffer);
    console.log('✓ Screen sent successfully');
    
  } catch (error) {
    console.error('Screen Render Failed:', error);
    res.status(500).send('Render Error');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 TRMNL Server running on port ${PORT}`);
  console.log(`⏱  Refresh Rates: Partial=${config.behavior.partialRefresh/1000}s, Full=${config.behavior.fullRefresh/1000}s`);
});