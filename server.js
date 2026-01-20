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

app.get('/config', (req, res) => {
  res.send(\`<!DOCTYPE html><html><head><title>TRMNL Config</title><style>body{font-family:monospace;max-width:1200px;margin:20px auto;padding:20px;background:#1e1e1e;color:#d4d4d4}h1{color:#569cd6}.section{background:#252526;padding:20px;margin:10px 0;border-radius:5px}.config-item{margin:10px 0;padding:10px;background:#2d2d30}label{display:inline-block;width:200px;color:#9cdcfe}button{background:#007acc;color:white;border:none;padding:10px 20px;border-radius:3px;cursor:pointer}button:hover{background:#005a9e}</style></head><body><h1>🎨 TRMNL Config</h1><div class="section"><h2>Display</h2><div class="config-item"><label>Size:</label>\${config.display.width}x\${config.display.height}</div></div><div class="section"><h2>Stops</h2><div class="config-item"><label>Train:</label>\${config.stops.train.name}</div><div class="config-item"><label>Tram:</label>\${config.stops.tram.name}</div></div><div><button onclick="location.href='/'">← Home</button></div></body></html>\`);
});

app.get('/', (req, res) => {
  res.send(\`<!DOCTYPE html><html><head><title>TRMNL PT</title><style>body{font-family:Arial,sans-serif;max-width:1000px;margin:50px auto;padding:20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white}.container{background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);border-radius:20px;padding:40px}h1{font-size:2.5em;margin:0 0 10px}.subtitle{color:#ddd;margin-bottom:30px}.status{background:rgba(255,255,255,0.2);padding:20px;border-radius:10px;margin:20px 0}.status-item{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.1)}.status-item:last-child{border-bottom:none}.badge{background:#4ade80;color:#000;padding:5px 15px;border-radius:20px;font-weight:bold}.links{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-top:30px}.link-card{background:rgba(255,255,255,0.15);padding:20px;border-radius:10px;text-align:center;text-decoration:none;color:white;transition:all 0.3s}.link-card:hover{background:rgba(255,255,255,0.25);transform:translateY(-5px)}.link-card h3{margin:0 0 10px}.link-card p{margin:0;font-size:0.9em;opacity:0.8}</style></head><body><div class="container"><h1>🚂 TRMNL Melbourne PT</h1><div class="subtitle">ULTIMATE++ Edition - Melbourne Metro & TramTracker PIDS Style</div><div class="status"><div class="status-item"><span>Server Status</span><span class="badge">ONLINE</span></div><div class="status-item"><span>Port</span><span>\${PORT}</span></div></div><div class="status"><h3 style="margin-top:0">⚙️ Configuration</h3><div class="status-item"><span>Display</span><span>\${config.display.width}x\${config.display.height} (4-bit grayscale)</span></div><div class="status-item"><span>Train Stop</span><span>\${config.stops.train.name} Platform \${config.stops.train.platform}</span></div><div class="status-item"><span>Tram Stop</span><span>\${config.stops.tram.name} Route \${config.stops.tram.route}</span></div><div class="status-item"><span>Refresh</span><span>\${config.behavior.partialRefresh/1000}s</span></div></div><div class="links"><a href="/api/screen?v=\${Date.now()}" class="link-card"><h3>📺 View Display</h3><p>Melbourne PIDS style</p></a><a href="/api/data" class="link-card"><h3>🔍 Raw Data</h3><p>JSON output</p></a><a href="/api/status" class="link-card"><h3>💚 Status</h3><p>Health check</p></a><a href="/config" class="link-card"><h3>⚙️ Config</h3><p>Settings</p></a></div><div style="margin-top:40px;text-align:center;opacity:0.7;font-size:0.9em"><p>🎨 TRMNL Device Configuration:</p><p><strong>URL:</strong> http://\${req.get('host')}/api/screen</p><p><strong>Refresh:</strong> \${config.behavior.partialRefresh/1000} seconds</p></div></div></body></html>\`);
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    server: 'TRMNL Melbourne PT - ULTIMATE++',
    version: '4.0.0',
    display: \`\${config.display.width}x\${config.display.height}\`,
    style: 'Melbourne Metro & TramTracker PIDS'
  });
});

app.get('/api/data', async (req, res) => {
  try {
    const data = await scraper.fetchAllData();
    const coffee = coffeeDecision.calculate();
    res.json({
      timestamp: new Date().toISOString(),
      coffee,
      trains: data.trains,
      trams: data.trams,
      weather: data.weather,
      news: data.news,
      disruptions: data.disruptions,
      dataSources: {
        trains: data.trains[0]?.source || 'unknown',
        trams: data.trams[0]?.source || 'unknown'
      }
    });
  } catch (error) {
    console.error('Data fetch error:', error);
    res.status(500).json({error: 'Failed to fetch data'});
  }
});

app.get('/api/screen', async (req, res) => {
  try {
    console.log('=== SCREEN RENDER START ===');
    console.log('Timestamp:', new Date().toISOString());
    
    const data = await scraper.fetchAllData();
    console.log('✓ Data fetched - Trains:', data.trains.length, 'Trams:', data.trams.length);
    
    const coffee = coffeeDecision.calculate();
    console.log('✓ Coffee calculated:', coffee.decision, '(' + coffee.color + ')');
    
    console.log('Calling renderer.render(data, coffee, true)...');
    const imageBuffer = await renderer.render(data, coffee, true);
    console.log('✓ Render complete - Buffer size:', imageBuffer.length, 'bytes');
    
    const now = new Date();
    const nextPartial = new Date(now.getTime() + config.behavior.partialRefresh);
    const nextFull = new Date(now.getTime() + config.behavior.fullRefresh);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-TRMNL-Partial-Refresh', nextPartial.toISOString());
    res.setHeader('X-TRMNL-Full-Refresh', nextFull.toISOString());
    res.send(imageBuffer);
    
    console.log('=== SCREEN RENDER SUCCESS ===');
    
  } catch (error) {
    console.error('=== SCREEN RENDER FAILED ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      error: 'Failed to render screen',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 TRMNL Melbourne PT Server - ULTIMATE++ Edition');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📡 Server running on port:', PORT);
  console.log('');
  console.log('🎨 Display Style: Melbourne Metro & TramTracker PIDS');
  console.log('📐 Display Size:', config.display.width + 'x' + config.display.height, '(4-bit grayscale)');
  console.log('');
  console.log('🎯 Data Sources:');
  console.log('  ✓ TramTracker API (no auth)');
  console.log('  ✓ PTV Timetable API (no auth)');
  console.log('  ✓ Smart Simulations (fallback)');
  console.log('');
  console.log('🚉 Stops:');
  console.log('  Train:', config.stops.train.name, '(Platform ' + config.stops.train.platform + ')');
  console.log('  Tram:', config.stops.tram.name, '(Route ' + config.stops.tram.route + ')');
  console.log('');
  console.log('⚙️  Refresh Interval:', config.behavior.partialRefresh/1000 + 's');
  console.log('');
  console.log('🔗 Endpoints:');
  console.log('  http://localhost:' + PORT + '/');
  console.log('  http://localhost:' + PORT + '/api/screen');
  console.log('  http://localhost:' + PORT + '/api/data');
  console.log('  http://localhost:' + PORT + '/config');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
});

module.exports = app;
