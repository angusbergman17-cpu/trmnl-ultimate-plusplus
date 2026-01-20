const express = require('express');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize classes
const scraper = new DataScraper();
const coffeeLogic = new CoffeeDecision();

app.use(express.json());

app.post('/api/screen', async (req, res) => {
  console.log("TRMNL Device Requested Update");

  try {
    // 1. Set a 10-second timeout for data fetching
    // (If the scraper hangs, we show the dashboard with '...' instead of crashing)
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 8000, null));
    const dataPromise = scraper.fetchAllData();
    
    // Race: Whichever finishes first wins
    const data = await Promise.race([dataPromise, timeoutPromise]) || {
      trains: [], trams: [], weather: {temp: '--', icon: '?'}, news: 'Loading Data...'
    };
    
    const coffee = coffeeLogic.calculate();

    // 2. HIGH CONTRAST HTML (Black & White Only)
    // We use 'black' and 'white' explicitly to ensure visibility on e-ink.
    const html = `
      <div class="view view--normal">
         
         <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid black; padding-bottom: 5px; margin-bottom: 5px;">
            <span style="font-size: 30px; font-weight: bold; color: black;">
              ${new Date().toLocaleTimeString('en-AU', {hour: '2-digit', minute:'2-digit'})}
            </span>
            <div style="background: black; color: white; padding: 2px 8px; border-radius: 4px;">
               <span style="font-weight: bold; font-size: 18px;">${coffee.decision}</span>
            </div>
         </div>

         <div style="margin-bottom: 10px;">
            <div style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid black;">Trams (No. 58)</div>
            ${data.trams.length > 0 ? data.trams.map(t => `
                <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 22px;">
                   <span>${t.destination}</span>
                   <span style="font-weight: bold;">${t.minutes} min</span>
                </div>
            `).join('') : '<div style="margin-top:4px;">No Trams Found</div>'}
         </div>

         <div style="background: black; color: white; padding: 5px; border-radius: 4px; margin-bottom: 5px;">
            <div style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid white; margin-bottom: 4px;">
               Trains (Loop)
            </div>
            ${data.trains.length > 0 ? data.trains.map(t => `
                <div style="display: flex; justify-content: space-between; margin-top: 2px; font-size: 20px;">
                   <span>${t.destination}</span>
                   <span style="font-weight: bold;">${t.minutes} min</span>
                </div>
            `).join('') : '<div>No Trains</div>'}
         </div>

         <div style="border-top: 2px solid black; padding-top: 5px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 24px; font-weight: bold;">${data.weather.temp}°C</span>
            <span style="font-size: 14px; max-width: 70%; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${data.news}
            </span>
         </div>

      </div>
    `;

    // 3. Log HTML length to confirm it generated
    console.log(`Sending HTML payload (${html.length} chars)`);
    res.json({ markup: html });

  } catch (error) {
    console.error("Critical Error:", error);
    // Emergency Error Screen
    res.json({ markup: `
      <div class="view">
        <div class="title">SYSTEM ERROR</div>
        <div class="content">${error.message}</div>
      </div>
    `});
  }
});

// Browser Check Route
app.get('/', (req, res) => res.send("TRMNL Server Online. Point device to /api/screen"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
