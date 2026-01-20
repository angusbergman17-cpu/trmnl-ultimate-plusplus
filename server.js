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

app.get('/api/test', async (req, res) => {
  try {
    const { createCanvas } = require('canvas');
    
    const canvas = createCanvas(800, 480);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 800, 480);
    
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('TRMNL TEST - If you see this, rendering works!', 50, 240);
    
    ctx.fillStyle = '#78be20';
    ctx.fillRect(50, 300, 700, 100);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Green box = Canvas working perfectly', 100, 360);
    
    const buffer = canvas.toBuffer('image/png');
    
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
    
  } catch (error) {
    console.error('Test render error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.get('/api/screen', async (req, res) => {
  try {
    const data = await scraper.fetchAllData();
    const coffee = coffeeDecision.calculate();
    
    console.log('Rendering with data:', {
      trainsCount: data.trains ? data.trains.length : 0,
      tramsCount: data.trams ? data.trams.length : 0,
      coffeeDecision: coffee ? coffee.decision : 'undefined'
    });
    
    if (!data.trains || !data.trams) {
      throw new Error('Missing trains or trams data');
    }
    
    if (!coffee || !coffee.color) {
      throw new Error('Invalid coffee data structure');
    }
    
    const imageBuffer = await renderer.render(data, coffee, true);
    
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Renderer returned empty buffer');
    }
    
    console.log('Successfully rendered image, buffer size:', imageBuffer.length);
    
    res.setHeader('Content-Type', 'image/png');
    res.send(imageBuffer);
    
  } catch (error) {
    console.error('Render error:', error.message);
    console.error('Full error:', error);
    
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(800, 480);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 800, 480);
    
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(0, 0, 800, 80);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('ERROR - Check Render logs', 50, 50);
    
    ctx.fillStyle = '#000000';
    ctx.font = '24px sans-serif';
    ctx.fillText('Error: ' + error.message, 50, 150);
    
    const errorBuffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.send(errorBuffer);
  }
});

app.get('/', (req, res) => {
  res.send(`
    <html>
    <head>
      <title>TRMNL Melbourne PT - ULTIMATE++</title>
      <style>
        body { font-family: sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #78be20; }
        .link { display: block; margin: 10px 0; padding: 15px; background: #f0f0f0; text-decoration: none; color: #333; border-radius: 5px; }
        .link:hover { background: #e0e0e0; }
        .test { background: #fff3cd; border-left: 4px solid #ffc107; }
      </style>
    </head>
    <body>
      <h1>🚂 TRMNL Melbourne PT - ULTIMATE++</h1>
      <p>Server is running! Test the endpoints below:</p>
      
      <a href="/api/test" class="link test">
        <strong>🧪 TEST RENDER</strong><br>
        Simple test to verify canvas/text rendering works
      </a>
      
      <a href="/api/screen" class="link">
        <strong>📺 MAIN DISPLAY</strong><br>
        Full Melbourne PT dashboard
      </a>
      
      <a href="/api/data" class="link">
        <strong>🔍 RAW DATA</strong><br>
        JSON data dump for debugging
      </a>
      
      <a href="/api/status" class="link">
        <strong>💚 STATUS CHECK</strong><br>
        Server health and version info
      </a>
      
      <p style="margin-top: 40px; color: #666;">
        <strong>Debug Steps:</strong><br>
        1. Click TEST RENDER - should show text and green box<br>
        2. If test works but MAIN DISPLAY doesn't, check Render logs<br>
        3. Compare RAW DATA structure with what renderer expects
      </p>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log('===========================================');
  console.log('TRMNL Melbourne PT Server - ULTIMATE++');
  console.log('Server running on port', PORT);
  console.log('===========================================');
  console.log('Endpoints:');
  console.log('  / - Dashboard');
  console.log('  /api/test - Canvas test (START HERE)');
  console.log('  /api/screen - Main display');
  console.log('  /api/data - Raw data JSON');
  console.log('  /api/status - Health check');
  console.log('===========================================');
});

module.exports = app;
