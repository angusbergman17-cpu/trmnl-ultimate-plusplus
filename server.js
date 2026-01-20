const express = require('express');
const axios = require('axios');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize
const scraper = new DataScraper();
const coffeeLogic = new CoffeeDecision();

app.use(express.json());

// --- CORE: GENERATE THE DASHBOARD HTML ---
async function generateDashboardHtml() {
  // 1. Timezone Fix (UTC+11 for Melbourne)
  const now = new Date();
  const melTime = new Date(now.getTime() + (11 * 60 * 60 * 1000));
  const timeStr = melTime.toISOString().substr(11, 5);

  // 2. Fetch Data with Strict 4-Second Timeout
  // (If PTV is slow, we show 'Loading' instead of a blank screen)
  const timeout = new Promise(resolve => setTimeout(resolve, 4000, null));
  const dataFetch = scraper.fetchAllData().catch(() => null);
  
  const data = await Promise.race([dataFetch, timeout]) || {
      trains: [], trams: [], weather: {temp: '--', icon: '?'}, news: 'Loading Data...'
  };

  const nextTrainMin = (data.trains && data.trains[0]) ? data.trains[0].minutes : 99;
  const coffee = coffeeLogic.calculate(nextTrainMin);

  // 3. The High-Contrast HTML
  return `
    <div class="view view--normal" style="background-color: white; color: black; font-family: sans-serif; height: 100%; width: 100%; position: absolute; top:0; left:0; padding: 8px; box-sizing: border-box;">
       
       <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid black; padding-bottom: 4px; margin-bottom: 8px;">
          <span style="font-size: 48px; font-weight: 900; letter-spacing: -2px; line-height: 1;">${timeStr}</span>
          <div style="text-align: right;">
             <span style="background: black; color: white; padding: 2px 6px; font-weight: bold; font-size: 18px; text-transform: uppercase;">${coffee.decision}</span>
             <div style="font-size: 14px; margin-top: 2px; font-weight: 600;">${coffee.subtext}</div>
          </div>
       </div>

       <div style="margin-bottom: 12px;">
          <div style="border-bottom: 2px solid black; margin-bottom: 4px; display: flex; align-items: center;">
            <span style="background: black; color: white; padding: 2px 6px; font-weight: bold; font-size: 14px;">TRAM 58</span>
          </div>
          ${data.trams && data.trams.length > 0 ? data.trams.slice(0,2).map(t => `
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 2px;">
                 <span style="font-size: 22px; font-weight: 500; overflow: hidden; white-space: nowrap;">${t.destination}</span>
                 <span style="font-size: 26px; font-weight: 800;">${t.minutes}<small style="font-size:14px; font-weight:400;">m</small></span>
              </div>
          `).join('') : '<div>No Trams</div>'}
       </div>

       <div style="flex-grow: 1;">
          <div style="border-bottom: 2px solid black; margin-bottom: 4px;">
             <span style="background: black; color: white; padding: 2px 6px; font-weight: bold; font-size: 14px;">LOOP TRAINS</span>
          </div>
          ${data.trains && data.trains.length > 0 ? data.trains.slice(0,2).map(t => `
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 2px;">
                 <span style="font-size: 22px; font-weight: 500;">${t.destination}</span>
                 <span style="font-size: 26px; font-weight: 800;">${t.minutes}<small style="font-size:14px; font-weight:400;">m</small></span>
              </div>
          `).join('') : '<div>No Trains</div>'}
       </div>

       <div style="position: absolute; bottom: 5px; left: 8px; right: 8px; border-top: 4px solid black; padding-top: 4px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 28px; font-weight: bold;">${data.weather.temp}° ${data.weather.icon}</span>
          <span style="font-size: 14px; font-weight: 600; max-width: 60%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.news}</span>
       </div>
    </div>
  `;
}

// --- ROUTE 1: POLLING (The "Backup" Method) ---
app.all('/api/screen', async (req, res) => {
  console.log("⚡ Request Received (Polling)");
  try {
    const html = await generateDashboardHtml();
    res.json({ markup: html }); // Send JSON, NOT Image!
  } catch (e) {
    console.error(e);
    res.json({ markup: "<div>Error generating screen</div>" });
  }
});

// --- ROUTE 2: BROADCASTER (The "Fast" Method) ---
// This loop runs every 15 seconds to Push data to TRMNL
setInterval(async () => {
  if (!process.env.TRMNL_WEBHOOK_URL) return;

  try {
    // Only broadcast if it's "Active Hours" (6am - 11pm Melbourne time) to save logs
    const melHour = new Date(new Date().getTime() + (11*3600000)).getUTCHours();
    if (melHour < 6 || melHour > 23) return;

    const html = await generateDashboardHtml();
    await axios.post(process.env.TRMNL_WEBHOOK_URL, {
      merge_variables: { markup: html }
    });
    console.log(`[${new Date().toLocaleTimeString()}] 🚀 Pushed to TRMNL`);
  } catch (e) {
    console.error("Broadcast failed:", e.message);
  }
}, 15000); // 15 seconds

app.get('/', (req, res) => res.send("TRMNL Server Online"));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
