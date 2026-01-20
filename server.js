const express = require('express');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');
const PidsRenderer = require('./pids-renderer');

const app = express();
const PORT = process.env.PORT || 3000;

const scraper = new DataScraper();
const coffeeLogic = new CoffeeDecision();
const renderer = new PidsRenderer();

// GLOBAL CACHE: Stores the latest image in RAM
let currentImageBuffer = null;
let lastUpdateTime = null;

// --- 1. INTERNAL ENGINE (Runs every 60s) ---
// Keeps data fresh in the background so there is NO waiting when TRMNL asks.
async function refreshCycle() {
  console.log("♻️  Refueling Cache...");
  
  try {
    // Fetch Data (Timeout 10s)
    const data = await scraper.fetchAllData().catch(e => ({
        trains: [], trams: [], weather: {temp: '--', condition: 'Offline', icon: '?'}, news: 'Offline'
    }));

    // Logic
    const nextTrainMin = (data.trains && data.trains[0]) ? data.trains[0].minutes : 99;
    const coffee = coffeeLogic.calculate(nextTrainMin, data.trams);

    // Render & Save to RAM
    currentImageBuffer = await renderer.render(data, coffee, true);
    lastUpdateTime = new Date();
    console.log("📸 Image Ready (" + lastUpdateTime.toLocaleTimeString('en-AU', {timeZone:'Australia/Melbourne'}) + ")");

  } catch (error) {
    console.error("❌ Cycle Failed:", error.message);
  }
}

// --- 2. THE ENDPOINT (TRMNL visits this) ---
app.get('/api/live-image.png', (req, res) => {
  if (currentImageBuffer) {
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate'); // Force fresh load
      res.send(currentImageBuffer);
      console.log("⚡ Served Image to TRMNL");
  } else {
      res.status(503).send("Booting up...");
  }
});

// For Manual Refresh button in Dashboard
app.all('/api/screen', (req, res) => {
   // Points TRMNL to the image route
   const imageUrl = `https://trmnl-ultimate-plusplus.onrender.com/api/live-image.png?t=${Date.now()}`;
   res.json({ 
       markup: `<div class="view" style="padding:0; margin:0; background:white;"><img src="${imageUrl}" style="width:100%;" /></div>` 
   });
});

// Start Engine
setInterval(refreshCycle, 60000); // Update cache every 60s
setTimeout(refreshCycle, 2000);   // First run on boot

app.get('/', (req, res) => res.send("TRMNL Server Online"));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));