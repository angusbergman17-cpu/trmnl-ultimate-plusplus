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

let currentImageBuffer = null;
let lastUpdateTime = null;

app.use(express.json());

app.use((req, res, next) => {
  if (req.url !== '/') console.log(`[${new Date().toLocaleTimeString()}] 📨 ${req.method} ${req.url}`);
  next();
});

// --- TIMER 1: INTERNAL DATA ENGINE (Every 20s) ---
async function refreshCycle() {
  console.log("♻️  [Internal] Refreshing Data & Image Cache...");
  
  try {
    const timeout = new Promise(resolve => setTimeout(resolve, 5000, null));
    const dataFetch = scraper.fetchAllData().catch(e => {
        console.error("Scraper Error:", e.message);
        return null;
    });
    
    const data = await Promise.race([dataFetch, timeout]) || {
        trains: [], trams: [], weather: {temp: '--', condition: 'Loading...', icon: '?'}, news: 'Loading Data...'
    };

    // --- COFFEE LOGIC UPGRADE ---
    const nextTrainMin = (data.trains && data.trains[0]) ? data.trains[0].minutes : 99;
    
    // We now pass the TRAMS to the decision engine
    const coffee = coffeeLogic.calculate(nextTrainMin, data.trams);
    // -----------------------------

    const newBuffer = await renderer.render(data, coffee, true);
    currentImageBuffer = newBuffer;
    lastUpdateTime = new Date();
    console.log("📸 [Internal] Image Cache Updated!");

  } catch (error) {
    console.error("❌ Cycle Failed:", error);
  }
}

// --- TIMER 2: EXTERNAL BROADCASTER (Every 70s) ---
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

app.get('/api/live-image.png', (req, res) => {
  if (currentImageBuffer) {
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'no-cache');
      res.send(currentImageBuffer);
  } else {
      res.status(503).send("Warming up...");
  }
});

setInterval(refreshCycle, 20000);
setInterval(broadcastToTrmnl, 70000);
setTimeout(refreshCycle, 2000); 
setTimeout(broadcastToTrmnl, 10000);

app.get('/', (req, res) => res.send(`TRMNL Server Active. Last Update: ${lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : 'Pending...'}`));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
