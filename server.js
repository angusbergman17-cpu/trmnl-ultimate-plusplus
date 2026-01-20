const express = require('express');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');

const app = express();
const PORT = process.env.PORT || 3000;

const scraper = new DataScraper();
const coffeeLogic = new CoffeeDecision();

// 1. GLOBAL LOGGER: Prints EVERY request immediately
app.use((req, res, next) => {
  console.log(`[INCOMING] ${req.method} request to ${req.path}`);
  next();
});

app.use(express.json());

// 2. UNIVERSAL ROUTE (Handles both GET and POST)
app.all('/api/screen', async (req, res) => {
  console.log("⚡ PROCESSING TRMNL SCREEN...");

  try {
    // A. Manual Timezone Fix (Render servers are UTC)
    const now = new Date();
    const melbourneTime = new Date(now.getTime() + (11 * 60 * 60 * 1000));
    const timeStr = melbourneTime.toISOString().substr(11, 5); 

    // B. Fetch Data (with explicit timeout to prevent hanging)
    // If scraper takes >5 seconds, we return partial data immediately
    const timeout = new Promise(resolve => setTimeout(resolve, 5000, null));
    const dataFetch = scraper.fetchAllData();
    
    const data = await Promise.race([dataFetch, timeout]) || {
        trains: [], trams: [], weather: {temp: '--', icon: '?'}, news: 'Loading...'
    };
    
    // C. Coffee Logic
    const nextTrainMin = (data.trains && data.trains[0]) ? data.trains[0].minutes : 99;
    const coffee = coffeeLogic.calculate(nextTrainMin);

    // D. BULLETPROOF HTML (Explicit White Background)
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body, html { height: 100%; width: 100%; background-color: white !important; font-family: sans-serif; }
          .container { padding: 10px; display: flex; flex-direction: column; height: 100%; }
        </style>
      </head>
      <body>
        <div class="container">
           <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid black; padding-bottom: 5px; margin-bottom: 10px;">
              <span style="font-size: 42px; font-weight: 900; color: black;">${timeStr}</span>
              <div style="text-align: right;">
                 <span style="background: black; color: white; padding: 4px 8px; font-weight: bold; font-size: 18px; display: inline-block;">${coffee.decision}</span>
              </div>
           </div>

           <div style="margin-bottom: 15px;">
              <div style="border-bottom: 2px solid black; margin-bottom: 5px;">
                <span style="background: black; color: white; padding: 2px 6px; font-weight: bold;">TRAM 58</span>
              </div>
              ${data.trams && data.trams.length > 0 ? data.trams.map(t => `
                  <div style="display: flex; justify-content: space-between; font-size: 24px; margin-bottom: 4px;">
                     <span>${t.destination}</span>
                     <span style="font-weight: 700;">${t.minutes} min</span>
                  </div>
              `).join('') : '<div>No Trams</div>'}
           </div>

           <div style="flex-grow: 1;">
              <div style="border-bottom: 2px solid black; margin-bottom: 5px;">
                 <span style="background: black; color: white; padding: 2px 6px; font-weight: bold;">LOOP TRAINS</span>
              </div>
              ${data.trains && data.trains.length > 0 ? data.trains.map(t => `
                  <div style="display: flex; justify-content: space-between; font-size: 24px; margin-bottom: 4px;">
                     <span>${t.destination}</span>
                     <span style="font-weight: 700;">${t.minutes} min</span>
                  </div>
              `).join('') : '<div>No Trains</div>'}
           </div>

           <div style="border-top: 4px solid black; padding-top: 5px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 28px; font-weight: bold;">${data.weather.temp}°C ${data.weather.icon}</span>
              <span style="font-size: 14px;">${data.news}</span>
           </div>
        </div>
      </body>
      </html>
    `;

    res.json({ markup: html });

  } catch (error) {
    console.error("❌ CRITICAL ERROR:", error);
    res.json({ markup: `
      <body style="background:white; padding: 20px;">
        <h1>ERROR</h1>
        <p>${error.message}</p>
      </body>` 
    });
  }
});

// Health Check
app.get('/', (req, res) => res.send('TRMNL Server Online'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
