const express = require('express');
const axios = require('axios');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');
const PidsRenderer = require('./pids-renderer');

const app = express();
const PORT = process.env.PORT || 3000;
const MY_PUBLIC_URL = 'https://trmnl-ultimate-plusplus.onrender.com';

const scraper = new DataScraper();
const coffeeLogic = new CoffeeDecision();
const renderer = new PidsRenderer();

// GLOBAL CACHE: Stores the latest image in RAM
let currentImageBuffer = null;
let lastUpdateTime = null;

app.use(express.json());

// Log requests to see if TRMNL is hitting us
app.use((req, res, next) => {
  if (req.url !== '/') console.log(`[${new Date().toLocaleTimeString()}] 📨 ${req.method} ${req.url}`);
  next();
});

// --- CORE: THE REFRESH LOOP ---
// This runs every 20 seconds to update the image in the background
async function refreshCycle() {
  console.log("♻️  Starting Refresh Cycle...");
  
  try {
    // 1. FETCH DATA (Internal Timeout 5s)
    const timeout = new Promise(resolve => setTimeout(resolve, 5000, null));
    const dataFetch = scraper.fetchAllData().catch(e => {
        console.error("Scraper Error:", e.message);
        return null;
    });
    
    const data = await Promise.race([dataFetch, timeout]) || {
        trains: [], trams: [], weather: {temp: '--', icon: '?'}, news: 'Loading Data...'
    };

    // 2. LOGIC
    const nextTrainMin = (data.trains && data.trains[0]) ? data.trains[0].minutes : 99;
    const coffee = coffeeLogic.calculate(nextTrainMin);

    // 3. RENDER & CACHE (This is the heavy lifting)
    const newBuffer = await renderer.render(data, coffee, true);
    
    // Save to global variable
    currentImageBuffer = newBuffer;
    lastUpdateTime = new Date();
    console.log("📸 Image Cache Updated!");

    // 4. BROADCAST (Only after image is ready)
    await broadcastToTrmnl();

  } catch (error) {
    console.error("❌ Cycle Failed:", error);
  }
}

// --- BROADCASTER ---
async function broadcastToTrmnl() {
  if (!process.env.TRMNL_WEBHOOK_URL) return;

  try {
    // Cache Buster forces TRMNL to fetch the new image
    const imageUrl = `${MY_PUBLIC_URL}/api/live-image.png?t=${Date.now()}`;

    const htmlMarkup = `
      <div class="view view--normal" style="padding:0; margin:0; width:100%; height:100%; overflow:hidden; background:white;">
         <img src="${imageUrl}" style="width:100%; height:100%; object-fit:contain;" />
      </div>
    `;

    await axios.post(process.env.TRMNL_WEBHOOK_URL, {
      merge_variables: { markup: htmlMarkup }
    });
    console.log(`🚀 Webhook Sent (Pointing to fresh image)`);

  } catch (e) {
    console.error("Webhook Error:", e.message);
  }
}

// --- ROUTE: INSTANT IMAGE SERVER ---
// TRMNL hits this. We serve the RAM buffer instantly. No waiting.
app.get('/api/live-image.png', (req, res) => {
  if (currentImageBuffer) {
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'no-cache');
      res.send(currentImageBuffer);
      console.log("⚡ Served Cached Image (0ms delay)");
  } else {
      res.status(503).send("Warming up...");
      console.log("⚠️ Image requested but cache empty");
  }
});

// Start the loop (Every 20 seconds)
setInterval(refreshCycle, 20000);

// Initial kick-off
setTimeout(refreshCycle, 2000); // Start 2s after boot

app.get('/', (req, res) => res.send(`TRMNL Server Active. Last Update: ${lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : 'Pending...'}`));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
