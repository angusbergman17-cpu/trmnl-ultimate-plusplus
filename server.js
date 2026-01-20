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

// Log requests
app.use((req, res, next) => {
  if (req.url !== '/') console.log(`[${new Date().toLocaleTimeString()}] 📨 ${req.method} ${req.url}`);
  next();
});

// --- TIMER 1: INTERNAL DATA ENGINE (Every 20s) ---
// This keeps the image "fresh" in memory, ready for manual or auto-refresh
async function refreshCycle() {
  console.log("♻️  [Internal] Refreshing Data & Image Cache...");
  
  try {
    // 1. FETCH DATA (Internal Timeout 5s)
    const timeout = new Promise(resolve => setTimeout(resolve, 5000, null));
    const dataFetch = scraper.fetchAllData().catch(e => {
        console.error("Scraper Error:", e.message);
        return null;
    });
    
    // SAFE FALLBACK
    const data = await Promise.race([dataFetch, timeout]) || {
        trains: [], 
        trams: [], 
        weather: {temp: '--', condition: 'Loading...', icon: '?'},
        news: 'Loading Data...'
    };

    // 2. LOGIC
    const nextTrainMin = (data.trains && data.trains[0]) ? data.trains[0].minutes : 99;
    const coffee = coffeeLogic.calculate(nextTrainMin);

    // 3. RENDER & CACHE
    const newBuffer = await renderer.render(data, coffee, true);
    
    // Save to global variable
    currentImageBuffer = newBuffer;
    lastUpdateTime = new Date();
    console.log("📸 [Internal] Image Cache Updated!");

  } catch (error) {
    console.error("❌ Cycle Failed:", error);
  }
}

// --- TIMER 2: EXTERNAL BROADCASTER (Every 70s) ---
// We slow this down to avoid the 429 Rate Limit Error
async function broadcastToTrmnl() {
  if (!process.env.TRMNL_WEBHOOK_URL) return;

  try {
    const imageUrl = `${MY_PUBLIC_URL}/api/live-image.png?t=${Date.now()}`;
    const htmlMarkup = `
      <div class="view view--normal" style="padding:0; margin:0; width:100%; height:100%; overflow:hidden; background:white;">
         <img src="${imageUrl}" style="width:100%; height:100%; object-fit:contain;" />
      </div>
    `;

    await axios.post(process.env.TRMNL_WEBHOOK_URL, {
      merge_variables: { markup: htmlMarkup }
    });
    console.log(`🚀 [External] Webhook Sent (Next in 70s)`);

  } catch (e) {
    if (e.response && e.response.status === 429) {
        console.error("⚠️ RATE LIMITED (429): Skipping this broadcast to cool down.");
    } else {
        console.error("Webhook Error:", e.message);
    }
  }
}

// --- ROUTE: INSTANT IMAGE SERVER ---
app.get('/api/live-image.png', (req, res) => {
  if (currentImageBuffer) {
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'no-cache');
      res.send(currentImageBuffer);
      console.log("⚡ Served Cached Image (0ms delay)");
  } else {
      res.status(503).send("Warming up...");
  }
});

// START TIMERS
// 1. Data Refresh: Every 20 seconds (Keep cache hot)
setInterval(refreshCycle, 20000);

// 2. Broadcast: Every 70 seconds (Avoid 429 Bans)
setInterval(broadcastToTrmnl, 70000);

// Kickstart immediately
setTimeout(refreshCycle, 2000); 
setTimeout(broadcastToTrmnl, 10000); // Wait 10s for first image before broadcasting

app.get('/', (req, res) => res.send(`TRMNL Server Active. Last Update: ${lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : 'Pending...'}`));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
