/**

- TRMNL Melbourne PT Server - ULTIMATE++ Edition
- with Auto-Configuration Support
  */

const express = require(‘express’);
const config = require(’./config’);
const DataScraper = require(’./data-scraper-ultimate-plus’);
const CoffeeDecision = require(’./coffee-decision’);
const PidsRenderer = require(’./pids-renderer’);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize components
const scraper = new DataScraper();
const coffeeDecision = new CoffeeDecision();
const renderer = new PidsRenderer();

// Serve config editor
app.get(’/config’, (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<title>TRMNL Config Editor</title>
<style>
body {
font-family: monospace;
max-width: 1200px;
margin: 20px auto;
padding: 20px;
background: #1e1e1e;
color: #d4d4d4;
}
h1 { color: #569cd6; }
h2 { color: #4ec9b0; margin-top: 30px; }
.section {
background: #252526;
padding: 20px;
margin: 10px 0;
border-radius: 5px;
border-left: 3px solid #007acc;
}
.config-item {
margin: 10px 0;
padding: 10px;
background: #2d2d30;
}
label {
display: inline-block;
width: 200px;
color: #9cdcfe;
}
input, select {
background: #3c3c3c;
color: #d4d4d4;
border: 1px solid #007acc;
padding: 5px 10px;
border-radius: 3px;
}
.hint {
color: #608b4e;
font-size: 12px;
margin-left: 210px;
}
button {
background: #007acc;
color: white;
border: none;
padding: 10px 20px;
border-radius: 3px;
cursor: pointer;
margin: 10px 5px;
}
button:hover { background: #005a9e; }
.success { color: #4ec9b0; }
.warning { color: #ce9178; }
</style>
</head>
<body>
<h1>🎨 TRMNL Melbourne PT - Configuration</h1>
<p class="warning">⚠️ Note: This is a read-only view. To change config, edit config.js and redeploy.</p>

```
  <div class="section">
    <h2>📊 Display Settings</h2>
    <div class="config-item">
      <label>Width:</label> ${config.display.width}px
    </div>
    <div class="config-item">
      <label>Height:</label> ${config.display.height}px
    </div>
  </div>

  <div class="section">
    <h2>🎨 Layout</h2>
    <div class="config-item">
      <label>Top Bar Height:</label> ${config.layout.topBar.height}px
      <div class="hint">Contains time and coffee decision</div>
    </div>
    <div class="config-item">
      <label>Show Time:</label> ${config.layout.topBar.showTime}
    </div>
    <div class="config-item">
      <label>Show Coffee Decision:</label> ${config.layout.topBar.showCoffeeDecision}
    </div>
    <div class="config-item">
      <label>Trams Section:</label> ${config.layout.tramsSection.height}px
      <div class="hint">Max departures: ${config.layout.tramsSection.maxDepartures}</div>
    </div>
    <div class="config-item">
      <label>Trains Section:</label> ${config.layout.trainsSection.height}px
      <div class="hint">Max departures: ${config.layout.trainsSection.maxDepartures}</div>
    </div>
  </div>

  <div class="section">
    <h2>✍️ Typography</h2>
    <div class="config-item">
      <label>Main Font:</label> ${config.fonts.main}
    </div>
    <div class="config-item">
      <label>Title Size:</label> ${config.fonts.sizes.title}px
    </div>
    <div class="config-item">
      <label>Time Size:</label> ${config.fonts.sizes.time}px
    </div>
    <div class="config-item">
      <label>Destination Size:</label> ${config.fonts.sizes.destination}px
    </div>
  </div>

  <div class="section">
    <h2>🚉 Stop Configuration</h2>
    <div class="config-item">
      <label>Train Stop:</label> ${config.stops.train.name}
      <div class="hint">Stop ID: ${config.stops.train.stopId}, Platform: ${config.stops.train.platform}</div>
    </div>
    <div class="config-item">
      <label>Tram Stop:</label> ${config.stops.tram.name}
      <div class="hint">Stop ID: ${config.stops.tram.stopId}, Route: ${config.stops.tram.route}</div>
    </div>
    <div class="config-item">
      <label>Destination:</label> ${config.stops.destination.name}
      <div class="hint">Walk time: ${config.stops.destination.walkTime} minutes</div>
    </div>
  </div>

  <div class="section">
    <h2>⚙️ Behavior</h2>
    <div class="config-item">
      <label>Partial Refresh:</label> ${config.behavior.partialRefresh / 1000}s
    </div>
    <div class="config-item">
      <label>Full Refresh:</label> ${config.behavior.fullRefresh / 1000}s
    </div>
    <div class="config-item">
      <label>Show Data Source:</label> ${config.behavior.showDataSource}
    </div>
    <div class="config-item">
      <label>Coffee Arrival Time:</label> ${config.behavior.coffeeArrivalTime}
    </div>
  </div>

  <div class="section">
    <h2>🔄 Data Sources Priority</h2>
    <div class="config-item">
      <label>Trains:</label> ${config.dataSources.trainsPriority.join(' → ')}
    </div>
    <div class="config-item">
      <label>Trams:</label> ${config.dataSources.tramsPriority.join(' → ')}
    </div>
  </div>

  <div class="section">
    <p class="success">✅ To modify these settings, edit config.js in your project and redeploy to Render.</p>
    <p>Changes will take effect immediately after deployment!</p>
  </div>

  <div style="margin-top: 30px;">
    <button onclick="location.href='/'">← Back to Dashboard</button>
    <button onclick="location.href='/api/data'">View Raw Data</button>
    <button onclick="location.href='/api/screen'">View Display</button>
  </div>
</body>
</html>
```

`);
});

app.get(’/’, (req, res) => {
const dataSources = {
tramTracker: ‘✓ Enabled (no auth)’,
ptv: ‘✓ Enabled (no auth)’,
gtfs: process.env.GTFS_API_KEY ? ‘✓ Enabled’ : ‘○ Disabled (optional)’,
simulations: ‘✓ Always available’
};

res.send(`
<!DOCTYPE html>
<html>
<head>
<title>TRMNL Melbourne PT - ULTIMATE++</title>
<style>
body {
font-family: Arial, sans-serif;
max-width: 1000px;
margin: 50px auto;
padding: 20px;
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
color: white;
}
.container {
background: rgba(255, 255, 255, 0.1);
backdrop-filter: blur(10px);
border-radius: 20px;
padding: 40px;
box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
}
h1 { margin: 0 0 10px 0; font-size: 2.5em; }
.subtitle { color: #ddd; margin-bottom: 30px; }
.status {
background: rgba(255, 255, 255, 0.2);
padding: 20px;
border-radius: 10px;
margin: 20px 0;
}
.status-item {
display: flex;
justify-content: space-between;
padding: 10px 0;
border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.status-item:last-child { border-bottom: none; }
.badge {
background: #4ade80;
color: #000;
padding: 5px 15px;
border-radius: 20px;
font-size: 0.9em;
font-weight: bold;
}
.badge.optional {
background: #fbbf24;
}
.links {
display: grid;
grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
gap: 15px;
margin-top: 30px;
}
.link-card {
background: rgba(255, 255, 255, 0.15);
padding: 20px;
border-radius: 10px;
text-align: center;
text-decoration: none;
color: white;
transition: all 0.3s;
}
.link-card:hover {
background: rgba(255, 255, 255, 0.25);
transform: translateY(-5px);
}
.link-card h3 { margin: 0 0 10px 0; }
.link-card p { margin: 0; font-size: 0.9em; opacity: 0.8; }
</style>
</head>
<body>
<div class="container">
<h1>🚂 TRMNL Melbourne PT</h1>
<div class="subtitle">ULTIMATE++ Edition - Quad-Tier Fallback System</div>

```
    <div class="status">
      <div class="status-item">
        <span>Server Status</span>
        <span class="badge">ONLINE</span>
      </div>
      <div class="status-item">
        <span>Port</span>
        <span>${PORT}</span>
      </div>
    </div>

    <div class="status">
      <h3 style="margin-top: 0;">🎯 Data Sources</h3>
      <div class="status-item">
        <span>TramTracker API</span>
        <span>${dataSources.tramTracker}</span>
      </div>
      <div class="status-item">
        <span>PTV Timetable API</span>
        <span>${dataSources.ptv}</span>
      </div>
      <div class="status-item">
        <span>GTFS Realtime</span>
        <span>${dataSources.gtfs}</span>
      </div>
      <div class="status-item">
        <span>Smart Simulations</span>
        <span>${dataSources.simulations}</span>
      </div>
    </div>

    <div class="status">
      <h3 style="margin-top: 0;">⚙️ Configuration</h3>
      <div class="status-item">
        <span>Refresh Interval</span>
        <span>${config.behavior.partialRefresh / 1000}s partial, ${config.behavior.fullRefresh / 1000}s full</span>
      </div>
      <div class="status-item">
        <span>Display Size</span>
        <span>${config.display.width}x${config.display.height}</span>
      </div>
      <div class="status-item">
        <span>Train Stop</span>
        <span>${config.stops.train.name} (Platform ${config.stops.train.platform})</span>
      </div>
      <div class="status-item">
        <span>Tram Stop</span>
        <span>${config.stops.tram.name} (Route ${config.stops.tram.route})</span>
      </div>
    </div>

    <div class="links">
      <a href="/api/screen" class="link-card">
        <h3>📺 View Display</h3>
        <p>See the rendered e-ink screen</p>
      </a>
      <a href="/api/data" class="link-card">
        <h3>🔍 Raw Data</h3>
        <p>Debug JSON output</p>
      </a>
      <a href="/api/status" class="link-card">
        <h3>💚 Health Check</h3>
        <p>API status report</p>
      </a>
      <a href="/config" class="link-card">
        <h3>⚙️ Configuration</h3>
        <p>View current settings</p>
      </a>
    </div>

    <div style="margin-top: 40px; text-align: center; opacity: 0.7; font-size: 0.9em;">
      <p>🎨 Configure TRMNL device:</p>
      <p><strong>URL:</strong> ${req.protocol}://${req.get('host')}/api/screen</p>
      <p><strong>Refresh:</strong> ${config.behavior.partialRefresh / 1000} seconds</p>
    </div>
  </div>
</body>
</html>
```

`);
});

app.get(’/api/status’, (req, res) => {
res.json({
status: ‘online’,
server: ‘TRMNL Melbourne PT - ULTIMATE++ Edition’,
version: ‘4.0.0’,
config: {
display: config.display,
stops: config.stops,
behavior: config.behavior
},
dataSources: {
tramTracker: {
enabled: true,
requiresAuth: false,
status: ‘Primary (trams)’
},
ptv: {
enabled: true,
requiresAuth: false,
status: ‘Primary (trains) / Secondary (trams)’
},
gtfs: {
enabled: !!process.env.GTFS_API_KEY,
requiresAuth: true,
status: process.env.GTFS_API_KEY ? ‘Tertiary (fallback)’ : ‘Disabled (optional)’
},
simulations: {
enabled: true,
requiresAuth: false,
status: ‘Quaternary (always available)’
}
}
});
});

app.get(’/api/data’, async (req, res) => {
try {
const data = await scraper.fetchAllData();
const coffee = coffeeDecision.calculate();

```
res.json({
  timestamp: new Date().toISOString(),
  config: {
    stops: config.stops,
    behavior: config.behavior
  },
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
```

} catch (error) {
console.error(‘Error fetching data:’, error);
res.status(500).json({ error: ‘Failed to fetch data’ });
}
});

app.get(’/api/screen’, async (req, res) => {
try {
const data = await scraper.fetchAllData();
const coffee = coffeeDecision.calculate();

```
const imageBuffer = await renderer.render({
  coffee,
  trains: data.trains,
  trams: data.trams,
  weather: data.weather,
  news: data.news,
  disruptions: data.disruptions
});

const now = new Date();
const nextPartial = new Date(now.getTime() + config.behavior.partialRefresh);
const nextFull = new Date(now.getTime() + config.behavior.fullRefresh);

res.setHeader('Content-Type', 'image/png');
res.setHeader('X-TRMNL-Partial-Refresh', nextPartial.toISOString());
res.setHeader('X-TRMNL-Full-Refresh', nextFull.toISOString());
res.send(imageBuffer);
```

} catch (error) {
console.error(‘Error rendering screen:’, error);
res.status(500).json({ error: ‘Failed to render screen’ });
}
});

app.listen(PORT, () => {
console.log(`\n🚀 TRMNL Melbourne PT Server - ULTIMATE++ Edition`);
console.log(`📡 Server running on port ${PORT}`);
console.log(`\n🎯 Data Sources:`);
console.log(`  ✓ TramTracker API (no auth) - Trams primary!`);
console.log(`  ✓ PTV API (no auth) - Trains primary!`);
console.log(`  ${process.env.GTFS_API_KEY ? '✓' : '○'} GTFS Realtime - ${process.env.GTFS_API_KEY ? 'Enabled' : 'Disabled (optional)'}`);
console.log(`  ✓ Smart Simulations - Always available`);
console.log(`\n⚙️ Configuration:`);
console.log(`  Train: ${config.stops.train.name} (Platform ${config.stops.train.platform})`);
console.log(`  Tram: ${config.stops.tram.name} (Route ${config.stops.tram.route})`);
console.log(`  Refresh: ${config.behavior.partialRefresh/1000}s partial, ${config.behavior.fullRefresh/1000}s full`);
console.log(`\n🔗 Endpoints:`);
console.log(`  http://localhost:${PORT}/`);
console.log(`  http://localhost:${PORT}/config`);
console.log(`  http://localhost:${PORT}/api/screen`);
console.log(`  http://localhost:${PORT}/api/data`);
console.log(`\n🎨 Edit config.js to customize your display!\n`);
});

module.exports = app;
