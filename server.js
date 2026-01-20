const express = require('express');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');
const PidsRenderer = require('./pids-renderer');
const sharp = require('sharp'); 

const app = express();
const PORT = process.env.PORT || 3000;

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

async function refreshCycle() {
  console.log("♻️  Refreshing Data...");
  try {
    const timeout = new Promise((resolve, reject) => setTimeout(() => reject(new Error("Timeout")), 15000));
    
    const data = await Promise.race([scraper.fetchAllData(), timeout]).catch(e => {
        console.error("Scraper Error:", e.message);
        return { trains: [], trams: [], weather: {temp: '--', condition: 'Data Offline', icon: '?'}, news: 'Connection Error' };
    });

    const nextTrainMin = (data.trains && data.trains[0]) ? data.trains[0].minutes : 99;
    const coffee = coffeeLogic.calculate(nextTrainMin, data.trams, data.news);

    currentImageBuffer = await renderer.render(data, coffee, true);
    lastUpdateTime = new Date();
    console.log("📸 Image Updated Successfully");

  } catch (error) {
    console.error("CRITICAL CYCLE FAILURE:", error.message);
  }
}

app.get('/api/live-image.png', async (req, res) => {
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (currentImageBuffer) {
      res.send(currentImageBuffer);
  } else {
      console.log("⚠️ Cache empty. Serving Loading Placeholder.");
      try {
        const loadingSvg = `<svg width="800" height="480" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="400" y="240" font-size="50" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="black">SYSTEM STARTING</text></svg>`;
        const buffer = await sharp(Buffer.from(loadingSvg)).png().toBuffer();
        res.send(buffer);
        if (!lastUpdateTime) refreshCycle();
      } catch (e) { res.status(500).send("Server Error"); }
  }
});

app.all('/api/screen', (req, res) => {
   const imageUrl = `https://trmnl-ultimate-plusplus.onrender.com/api/live-image.png?t=${Date.now()}`;
   res.json({ markup: `<div class="view" style="padding:0; margin:0; background:white;"><img src="${imageUrl}" style="width:100%;" /></div>` });
});

setInterval(refreshCycle, 60000); 
setTimeout(refreshCycle, 1000);   

app.get('/', (req, res) => res.send("TRMNL Server Online"));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));