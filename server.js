const express = require('express');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');

const app = express();
const PORT = process.env.PORT || 3000;

const scraper = new DataScraper();
const coffeeLogic = new CoffeeDecision();

app.use(express.json());

app.post('/api/screen', async (req, res) => {
  console.log("Device Requested Update");

  try {
    // 1. SAFE TIME CALCULATION (Avoids Server Crash)
    // Manually adjust UTC to Melbourne Time (UTC+11 for DST)
    const now = new Date();
    const melbourneTime = new Date(now.getTime() + (11 * 60 * 60 * 1000));
    const timeStr = melbourneTime.toISOString().substr(11, 5); // HH:MM

    // 2. FETCH DATA (With Error Safety)
    const data = await scraper.fetchAllData().catch(e => ({
        trains: [], trams: [], weather: {temp: '--', icon: '?'}, news: 'Data Error'
    }));
    
    // 3. COFFEE LOGIC
    const nextTrainMin = (data.trains && data.trains[0]) ? data.trains[0].minutes : 99;
    const coffee = coffeeLogic.calculate(nextTrainMin);

    // 4. HIGH VISIBILITY HTML (Forces White Background)
    const html = `
      <div class="view view--normal" style="background-color: white; color: black; height: 100%; width: 100%; position: absolute; top:0; left:0; padding: 5px;">
         
         <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid black; padding-bottom: 5px; margin-bottom: 10px;">
            <span style="font-size: 38px; font-weight: bold; color: black;">${timeStr}</span>
            <div style="text-align: right;">
               <div style="font-weight: bold; font-size: 18px; background: black; color: white; padding: 4px 8px; border-radius: 4px;">${coffee.decision}</div>
               <div style="font-size: 14px; margin-top: 2px;">${coffee.subtext}</div>
            </div>
         </div>

         <div style="margin-bottom: 15px;">
            <div style="font-weight: bold; text-transform: uppercase; border-bottom: 2px solid black; font-size: 16px; margin-bottom: 5px;">Trams (No. 58)</div>
            ${data.trams.length > 0 ? data.trams.map(t => `
                <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 24px; font-weight: 500;">
                   <span>${t.destination}</span>
                   <span style="font-weight: bold;">${t.minutes} min</span>
                </div>
            `).join('') : '<div style="font-size: 20px;">No Trams Found</div>'}
         </div>

         <div style="background: black; color: white; padding: 8px; border-radius: 6px; margin-bottom: 10px;">
            <div style="font-weight: bold; text-transform: uppercase; border-bottom: 2px solid white; font-size: 16px; margin-bottom: 5px;">
               Trains (Parliament)
            </div>
            ${data.trains.length > 0 ? data.trains.map(t => `
                <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 22px;">
                   <span>${t.destination}</span>
                   <span style="font-weight: bold;">${t.minutes} min</span>
                </div>
            `).join('') : '<div style="font-size: 20px;">No Trains</div>'}
         </div>

         <div style="border-top: 3px solid black; padding-top: 5px; display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 28px; font-weight: bold;">${data.weather.temp}°C ${data.weather.icon}</span>
            <span style="font-size: 14px; max-width: 55%; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${data.news}
            </span>
         </div>
      </div>
    `;

    // 5. STABLE REFRESH (60s to prevent 'black screen' loops)
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Refresh', '60'); 

    res.json({ markup: html });

  } catch (error) {
    console.error("Critical Error:", error);
    // Print the error on the screen so we can see WHAT is failing
    res.json({ markup: `<div style="background:white; color:black; font-size: 20px; padding: 20px;">SYSTEM ERROR:<br>${error.message}</div>` });
  }
});

app.get('/', (req, res) => res.send("TRMNL Server Online."));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
