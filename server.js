const express = require('express');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');

const app = express();
const PORT = process.env.PORT || 3000;

const scraper = new DataScraper();
const coffeeLogic = new CoffeeDecision();

app.use(express.json());

app.post('/api/screen', async (req, res) => {
  // 1. Force Melbourne Time
  const now = new Date().toLocaleString("en-US", {timeZone: "Australia/Melbourne"});
  const timeStr = new Date(now).toLocaleTimeString('en-AU', {hour: '2-digit', minute:'2-digit'});
  
  console.log(`[${timeStr}] Device Update Request`);

  try {
    const data = await scraper.fetchAllData();
    
    // 2. Coffee Logic (Passes the next train minutes to the decision engine)
    const nextTrainMin = data.trains[0] ? data.trains[0].minutes : 99;
    const coffee = coffeeLogic.calculate(nextTrainMin);

    // 3. HIGH CONTRAST RENDER
    const html = `
      <div class="view view--normal">
         
         <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid black; padding-bottom: 5px; margin-bottom: 5px;">
            <span style="font-size: 34px; font-weight: bold; color: black;">${timeStr}</span>
            <div style="text-align: right;">
               <div style="font-weight: bold; font-size: 16px; background: black; color: white; padding: 2px 6px;">${coffee.decision}</div>
               <div style="font-size: 12px; margin-top: 2px;">${coffee.subtext}</div>
            </div>
         </div>

         <div style="margin-bottom: 8px;">
            <div style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid black; font-size: 14px;">Trams (No. 58)</div>
            ${data.trams.length > 0 ? data.trams.map(t => `
                <div style="display: flex; justify-content: space-between; margin-top: 2px; font-size: 20px;">
                   <span>${t.destination}</span>
                   <span style="font-weight: bold;">${t.minutes} min</span>
                </div>
            `).join('') : '<div style="margin-top:2px;">No Trams</div>'}
         </div>

         <div style="background: black; color: white; padding: 4px; border-radius: 4px; margin-bottom: 5px;">
            <div style="font-weight: bold; text-transform: uppercase; border-bottom: 1px solid white; font-size: 14px; margin-bottom: 2px;">
               Trains (Parliament)
            </div>
            ${data.trains.length > 0 ? data.trains.map(t => `
                <div style="display: flex; justify-content: space-between; margin-top: 2px; font-size: 18px;">
                   <span>${t.destination}</span>
                   <span style="font-weight: bold;">${t.minutes} min</span>
                </div>
            `).join('') : '<div>No Trains</div>'}
         </div>

         <div style="border-top: 2px solid black; padding-top: 5px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 22px; font-weight: bold;">${data.weather.temp}°C ${data.weather.icon}</span>
            <span style="font-size: 12px; max-width: 60%; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${data.news}
            </span>
         </div>
      </div>
    `;

    // 4. RAPID REFRESH HEADERS
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Refresh', '10');      // Tells browser/device to reload in 10s
    res.set('X-TRMNL-Timer', '10'); // TRMNL hint

    res.json({ markup: html });

  } catch (error) {
    console.error("Error:", error);
    res.json({ markup: `<div>ERROR: ${error.message}</div>` });
  }
});

app.get('/', (req, res) => res.send("TRMNL Server Online."));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
