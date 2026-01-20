const express = require('express');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize your data logic
const scraper = new DataScraper();
const coffeeLogic = new CoffeeDecision();

// 1. Allow JSON parsing (Critical for TRMNL)
app.use(express.json());

// 2. The Main Route (POST) for the Device
app.post('/api/screen', async (req, res) => {
  console.log("TRMNL Device Requested Update");

  try {
    // A. Fetch Real Data
    const data = await scraper.fetchAllData();
    const coffee = coffeeLogic.calculate();

    // B. Generate HTML (This mimics your 'Browser View' which looked perfect)
    const html = `
      <div class="view">
         <div class="layout">
           <div class="header">
              <span class="title">${new Date().toLocaleTimeString('en-AU', {hour: '2-digit', minute:'2-digit'})}</span>
              <div class="status-box" style="background-color: ${coffee.color || '#000'}">
                 <span class="status-title" style="color: #fff">${coffee.decision}</span>
                 <span class="status-sub" style="color: #fff">${coffee.timeToSpare}min to spare</span>
              </div>
           </div>

           <div class="section tram" style="border-top: 4px solid #78be20;">
              <div class="title" style="background: #78be20; color: white; padding: 2px 5px;">TRAMS FROM TIVOLI RD</div>
              ${data.trams.slice(0, 3).map(t => `
                <div class="row">
                   <span class="route-badge" style="background: #78be20; color: white; padding: 0 4px;">${t.route}</span>
                   <span class="dest">${t.destination}</span>
                   <span class="time">${t.minutes} min</span>
                </div>
              `).join('')}
           </div>

           <div class="section train" style="border-top: 4px solid #0072CE;">
              <div class="title" style="background: #0072CE; color: white; padding: 2px 5px;">TRAINS FROM SOUTH YARRA</div>
              ${data.trains.slice(0, 3).map(t => `
                <div class="row">
                   <span class="route-badge" style="background: #0072CE; color: white; padding: 0 4px;">${t.platform}</span>
                   <span class="dest">${t.destination}</span>
                   <div class="time-group">
                      <span class="status-text">${t.stopsAll ? 'Stops All' : 'Express'}</span>
                      <span class="time">${t.minutes} min</span>
                   </div>
                </div>
              `).join('')}
           </div>

           <div class="footer" style="margin-top: 10px; border-top: 1px solid #ccc; padding-top: 5px;">
              <span class="temp" style="font-size: 24px; font-weight: bold;">${data.weather.icon} ${data.weather.temp}°C</span>
              <span class="desc">${data.news}</span>
           </div>
         </div>
      </div>
    `;

    // C. Send as JSON (The Format TRMNL Polling Expects)
    res.json({ markup: html });

  } catch (error) {
    console.error("Error generating screen:", error);
    res.json({ markup: '<div class="view"><div class="title">ERROR LOADING DATA</div></div>' });
  }
});

// 3. Browser Test Route (GET)
// Visit your URL in Chrome to verify data is fetching
app.get('/', async (req, res) => {
  try {
    const data = await scraper.fetchAllData();
    res.send(`
      <h1>Server Online</h1>
      <p>TRMNL URL: <code>/api/screen</code></p>
      <pre>${JSON.stringify(data, null, 2)}</pre>
    `);
  } catch (e) {
    res.send("Server Error: " + e.message);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));