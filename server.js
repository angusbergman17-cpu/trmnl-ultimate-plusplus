const express = require('express');
const config = require('./config');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');
const PidsRenderer = require('./pids-renderer');

const app = express();
const PORT = process.env.PORT || 3000;

const scraper = new DataScraper();
const coffeeDecision = new CoffeeDecision();
const renderer = new PidsRenderer();

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    server: 'TRMNL Melbourne PT - ULTIMATE++',
    version: '4.0.0'
  });
});

app.get('/api/data', async (req, res) => {
  try {
    const data = await scraper.fetchAllData();
    const coffee = coffeeDecision.calculate();
    
    res.json({
      timestamp: new Date().toISOString(),
      coffee: coffee,
      trains: data.trains,
      trams: data.trams,
      weather: data.weather,
      news: data.news,
      disruptions: data.disruptions
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/screen', async (req, res) => {
  try {
    const data = await scraper.fetchAllData();
    const coffee = coffeeDecision.calculate();
    
    const imageBuffer = await renderer.render(data, coffee, true);
    
    res.setHeader('Content-Type', 'image/png');
    res.send(imageBuffer);
    
  } catch (error) {
    console.error('Error rendering screen:', error);
    res.status(500).json({ error: 'Failed to render screen' });
  }
});

app.get('/', (req, res) => {
  res.send('<h1>TRMNL Melbourne PT - ULTIMATE++</h1><p>Server is running!</p><p><a href="/api/screen">View Display</a> | <a href="/api/data">Raw Data</a> | <a href="/api/status">Status</a></p>');
});

app.listen(PORT, () => {
  console.log('TRMNL Server running on port', PORT);
});

module.exports = app;
