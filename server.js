const express = require('express');
const axios = require('axios');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize classes
const scraper = new DataScraper();
const coffeeLogic = new CoffeeDecision();

// 1. DATA GENERATOR (Reusable)
async function generateMarkup() {
  // Manual Timezone Fix (UTC+11)
  const now = new Date();
  const melbourneTime = new Date(now.getTime() + (11 * 60 * 60 * 1000));
  const timeStr = melbourneTime.toISOString().substr(11, 5); 

  // Fetch Data (with 5s timeout)
  const timeout = new Promise(resolve => setTimeout(resolve, 5000, null));
  const dataFetch = scraper.fetchAllData();
  const data = await Promise.race([dataFetch, timeout]) || {
      trains: [], trams: [], weather: {temp: '--', icon: '?'}, news: 'Loading...'
  };
  
  const nextTrainMin = (data.trains && data.trains[0]) ? data.trains[0].minutes : 99;
  const coffee = coffeeLogic.calculate(nextTrainMin);

  // HIGH VISIBILITY HTML
  return `
    <div class="view view--normal" style="background-color: white; color: black; height: 100%; width: 100%; position: absolute; top:0; left:0; padding: 5px;">
       
       <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid black; padding-bottom: 5px; margin-bottom: 10px;">
          <span style="font-size: 46px; font-weight: 900; color: black; letter-spacing: -1px;">${timeStr}</span>
          <div style="text-align: right;">
             <span style="background: black; color: white; padding: 4px 8px; font-weight: bold; font-size: 20px; display: inline-block;">${coffee.decision}</span>
             <div style="font-size: 14px; margin-top: 2px; font-weight:bold;">${coffee.subtext}</div>
          </div>
       </div>

       <div style="margin-bottom: 15px;">
          <div style="border-bottom: 2px solid black; margin-bottom: 5px;">
            <span style="background: black; color: white; padding: 2px 6px; font-weight: bold; font-size: 16px;">TRAM 58</span>
          </div>
          ${data.trams && data.trams.length > 0 ? data.trams.map(t => `
              <div style="display: flex; justify-content: space-between; font-size: 26px; margin-bottom: 4px; font-weight: 500;">
                 <span>${t.destination}</span>
                 <span style="font-weight: 800;">${t.minutes} min</span>
              </div>
          `).join('') : '<div style="font-size: 20px;">No Trams</div>'}
       </div>

       <div style="flex-grow: 1;">
          <div style="border-bottom: 2px solid black; margin-bottom: 5px;">
             <span style="background: black; color: white; padding: 2px 6px; font-weight: bold; font-size: 16px;">LOOP TRAINS</span>
          </div>
          ${data.trains && data.trains.length > 0 ? data.trains.map(t => `
              <div style="display: flex; justify-content: space-between; font-size: 26px; margin-bottom: 4px; font-weight: 500;">
                 <span>${t.destination}</span>
                 <span style="font-weight: 800;">${t.minutes} min</span>
              </div>
          `).join('') : '<div style="font-size: 20px;">No Trains</div>'}
       </div>

       <div style="border-top: 4px solid black; padding-top: 5px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 32px; font-weight: bold;">${data.weather.temp}° ${data.weather.icon}</span>
          <span style="font-size: 14px; font-weight: bold;">${data.news}</span>
       </div>
    </div>
  `;
}

// 2. THE BROADCASTER (Pushes to TRMNL)
async function broadcastToTrmnl() {
  if (!process.env.TRMNL_WEBHOOK_URL) {
    console.log("⚠️ No Webhook URL found. Skipping broadcast.");
    return;
  }

  try {
    const html = await generateMarkup();
    
    // PUSH to TRMNL
    await axios.post(process.env.TRMNL_WEBHOOK_URL, {
      merge_variables: {
        markup: html
      }
    });
    console.log(`[${new Date().toLocaleTimeString()}] 🚀 Pushed update to TRMNL`);
  } catch (error) {
    console.error("❌ Broadcast Failed:", error.message);
  }
}

// 3. START THE TIMER (Every 20 Seconds)
// We use 20s to be safe. 10s might hit rate limits or drain battery too fast.
setInterval(broadcastToTrmnl, 20000);

// 4. SERVER SETUP (Keep this to satisfy Render health checks)
app.get('/', (req, res) => res.send('TRMNL Broadcaster Active'));

// Allow manual trigger for testing
app.post('/trigger', async (req, res) => {
    await broadcastToTrmnl();
    res.send('Triggered');
});

app.listen(PORT, () => console.log(`Broadcaster running on port ${PORT}`));
