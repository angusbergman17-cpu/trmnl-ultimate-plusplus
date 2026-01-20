const express = require('express');
const app = express();

// Required to parse the JSON data TRMNL sends
app.use(express.json());

// This fixes the "Cannot POST /api/screen" error
app.post('/api/screen', (req, res) => {
  console.log("Received request from TRMNL:", req.body);

  // This JSON structure is what the TRMNL Cloud expects
  res.json({
    markup: `
      <div class="view">
        <div class="layout">
          <div class="column">
            <span class="title">PLUGIN ACTIVE</span>
            <div class="content">
              <p>Device UUID: ${req.body.device_uuid || 'Unknown'}</p>
              <p>Status: <span class="state--success">Connected</span></p>
              <p class="text--bold">Server Time: ${new Date().toLocaleTimeString()}</p>
            </div>
            <span class="label">TRMNL-ULTIMATE-PLUSPLUS</span>
          </div>
        </div>
      </div>
    `
  });
});

// Basic health check for Render
app.get('/', (req, res) => res.send('Server is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
