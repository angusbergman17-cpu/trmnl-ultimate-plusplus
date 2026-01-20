const express = require('express');
const app = express();

// 1. Allow the server to read the JSON sent by TRMNL
app.use(express.json());

// 2. The Missing Route (Fixes your terminal error)
app.post('/api/screen', (req, res) => {
  console.log("Incoming Request from TRMNL:", req.body);

  // This HTML is what will appear on your screen.
  // The '{{ markup }}' in your dashboard will pull this EXACT content.
  const content = `
    <div class="view">
      <div class="layout">
        <div class="column">
           <span class="title">My Render Server</span>
           <div class="content">
             <div class="item">
               <span class="label">Connection</span>
               <span class="value">Active</span>
             </div>
             <div class="item">
               <span class="label">Last Update</span>
               <span class="value">${new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</span>
             </div>
           </div>
        </div>
      </div>
    </div>
  `;

  // Respond with the JSON structure TRMNL needs
  res.json({ markup: content });
});

// 3. Keep Render happy with a health check
app.get('/', (req, res) => res.send('TRMNL Server Online'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
