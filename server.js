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

// --- PART 1: THE IMAGE GENERATOR (The "Renderer") ---
// This route generates the actual PNG file on demand
app.get('/api/live-image.png', async (req, res) => {
  console.log("🎨 Generating PIDS Image...");
  try {
    // 1. Fetch Data (Fast Timeout)
    const timeout = new Promise(resolve => setTimeout(resolve, 4500, null));
    const dataFetch = scraper.fetchAllData().catch(() => null);
    const data = await Promise.race([dataFetch, timeout]) || {
        trains: [], trams: [], weather: {temp: '--', icon: '?'}, news: 'Loading...'
    };

    // 2. Coffee Logic
    const nextTrainMin = (data.trains && data.trains[0]) ? data.trains[0].minutes : 99;
    const coffee = coffeeLogic.calculate(nextTrainMin);

    // 3. Render Image (Using your pids-renderer.js)
    const imageBuffer = await renderer.render(data, coffee, true);

    // 4. Send Image
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-cache');
    res.send(imageBuffer);
    console.log("✓ Image Sent");

  } catch (error) {
    console.error("Render Error:", error);
    res.status(500).send("Error");
  }
});

// --- PART 2: THE BROADCASTER (The "Webhook") ---
// This loop pushes HTML to TRMNL every 15 seconds.
// The HTML is just a container holding the Image from Part 1.
setInterval(async () => {
  if (!process.env.TRMNL_WEBHOOK_URL) return;

  try {
    // Active Hours Only (6am - 11pm Melbourne Time)
    const melHour = new Date(new Date().getTime() + (11 * 3600000)).getUTCHours();
    if (melHour < 6 || melHour > 23) return;

    // Cache Buster: Adds ?t=12345 to URL to force TRMNL to re-fetch the image
    const imageUrl = `${MY_PUBLIC_URL}/api/live-image.png?t=${Date.now()}`;

    // The "Trojan Horse" HTML
    const htmlMarkup = `
      <div class="view view--normal" style="padding:0; margin:0; width:100%; height:100%; overflow:hidden; background:white;">
         <img src="${imageUrl}" style="width:100%; height:100%; object-fit:contain;" />
      </div>
    `;

    // Push to TRMNL
    await axios.post(process.env.TRMNL_WEBHOOK_URL, {
      merge_variables: { markup: htmlMarkup }
    });
    console.log(`[${new Date().toLocaleTimeString()}] 🚀 Webhook Pushed (Image Mode)`);

  } catch (e) {
    console.error("Webhook Failed:", e.message);
  }
}, 15000); // 15 Seconds

// --- PART 3: FALLBACK POLLING ---
// If you switch back to Polling in settings, this handles it
app.all('/api/screen', async (req, res) => {
    const imageUrl = `${MY_PUBLIC_URL}/api/live-image.png?t=${Date.now()}`;
    res.json({ 
        markup: `<div class="view" style="padding:0; margin:0; background:white;"><img src="${imageUrl}" style="width:100%;" /></div>` 
    });
});

app.get('/', (req, res) => res.send("TRMNL Image Server Active"));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
