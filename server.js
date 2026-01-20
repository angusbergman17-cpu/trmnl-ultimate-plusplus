const express = require('express');
const config = require('./config');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');
const PidsRenderer = require('./pids-renderer');

const app = express();
const PORT = process.env.PORT || 3000;

const scraper = new DataScraper();
const coffeeDecision = new CoffeeDecision();
const renderer = new PidsRenderer();

// --- [KEEP YOUR EXISTING CONFIG ROUTES HERE] ---
// (I am omitting the long HTML strings for brevity, they are fine to keep as-is)
// Just ensure the /api/screen route looks like this:

app.get('/api/screen', async (req, res) => {
  try {
    console.log('Rendering screen...');
    const data = await scraper.fetchAllData();
    const coffee = coffeeDecision.calculate();
    
    // Render using the new SVG->Sharp renderer
    const imageBuffer = await renderer.render(data, coffee, true);
    
    res.set('Content-Type', 'image/png');
    // TRMNL headers
    res.set('X-TRMNL-Partial-Refresh', new Date(Date.now() + 20000).toISOString());
    res.send(imageBuffer);
    
  } catch (error) {
    console.error('Render failed:', error);
    res.status(500).send('Render Error');
  }
});

// Keep your other endpoints (/api/data, etc.)
app.get('/api/data', async (req, res) => {
    const data = await scraper.fetchAllData();
    res.json(data);
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));