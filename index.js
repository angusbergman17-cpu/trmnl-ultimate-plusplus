const express = require('express');
const app = express();
app.use(express.json());

app.post('/api/screen', (req, res) => {
  // TRMNL sends metadata like user_uuid and device info in the body
  console.log("Request from TRMNL:", req.body);

  res.json({
    // 'markup' is the primary key TRMNL looks for
    markup: `
      <div class="view">
        <div class="layout">
          <div class="column">
            <span class="title">My Private Plugin</span>
            <div class="content">
              <p>Server Status: Online</p>
              <p>Last Sync: ${new Date().toLocaleTimeString()}</p>
            </div>
            <span class="label">Render + TRMNL</span>
          </div>
        </div>
      </div>
    `
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));