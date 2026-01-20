const express = require('express');
const axios = require('axios');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');
const PidsRenderer = require('./pids-renderer');

const app = express();
const PORT = process.env.PORT || 3000;
const MY_PUBLIC_URL = 'https://trmnl-ultimate-plusplus.onrender.com'; // Your Render URL

// Initialize
const scraper = new DataScraper();
const coffeeLogic = new CoffeeDecision();
const renderer = new PidsRenderer();

app.use(express.json());

// Log everything so we know the server is alive
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] 📨 Incoming ${req.method} to ${req.url}`);
  next();
});

// --- PART 1: THE IMAGE GENERATOR (Returns PNG) ---
app.get('/api/live-image.png', async (req, res) => {
  console.log("🎨 Generating Image...");
  try {
    const timeout = new Promise(resolve => setTimeout(resolve, 4500, null));
    const dataFetch = scraper.fetchAllData().catch(() => null);
    const data = await Promise.race([dataFetch, timeout]) || {
        trains: [], trams: [], weather: {temp: '--', icon: '?'}, news: 'Loading...'
    };

    const nextTrainMin = (data.trains && data.trains[0]) ? data.trains[0].minutes : 99;
    const coffee = coffeeLogic.calculate(nextTrainMin);

    const imageBuffer = await renderer.render(data, coffee, true);

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-cache');
    res.send(imageBuffer);
    console.log("✓ Image Served");

  } catch (error) {
    console.error("Render Error:", error);
    res.status(500).send("Error");
  }
});

// --- PART 2: THE BROADCASTER (Webhook Pushes) ---
async function broadcast() {
  if (!process.env.TRMNL_WEBHOOK_URL) {
      console.log("⚠️ SKIPPING BROADCAST: No TRMNL_WEBHOOK_URL found in Environment Variables.");
      return;
  }

  try {
    console.log("🚀 Attempting Broadcast to TRMNL...");
    
    // Add timestamp to URL to prevent caching on the device
    const imageUrl = `${MY_PUBLIC_URL}/api/live-image.png?t=${Date.now()}`;

    // The "Trojan Horse" HTML: Just an image tag pointing to Part 1
    const htmlMarkup = `
      <div class="view view--normal" style="padding:0; margin:0; width:100%; height:100%; overflow:hidden; background:white;">
         <img src="${imageUrl}" style="width:100%; height:100%; object-fit:contain;" />
      </div>
    `;

    await axios.post(process.env.TRMNL_WEBHOOK_URL, {
      merge_variables: { markup: htmlMarkup }
    });
    console.log(`[${new Date().toLocaleTimeString()}] ✅ SUCCESS: Pushed update to TRMNL`);

  } catch (e) {
    console.error("❌ Broadcast Failed:", e.message);
  }
}

// Run every 20 seconds (Active 24/7 now)
setInterval(broadcast, 20000);

// --- PART 3: MANUAL TRIGGER & FALLBACK ---
app.all('/api/screen', async (req, res) => {
    const imageUrl = `${MY_PUBLIC_URL}/api/live-image.png?t=${Date.now()}`;
    res.json({ 
        markup: `<div class="view" style="padding:0; margin:0; background:white;"><img src="${imageUrl}" style="width:100%;" /></div>` 
    });
});

app.get('/', (req, res) => res.send("TRMNL Image Server Active"));
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log("⏰ Broadcaster Timer Started (Every 20s)");
});
