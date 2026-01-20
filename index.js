const express = require('express');
const app = express();

// 1. Allow Express to read JSON data from TRMNL
app.use(express.json());

// 2. The Critical "POST" Route
// TRMNL sends data here. We must reply with JSON containing "markup".
app.post('/api/screen', (req, res) => {
  console.log("TRMNL Requested Update:", req.body);

  // This HTML is what will appear on your screen.
  // Edit this HTML string to change your device's display.
  const myHtml = `
    <div class="view">
       <div class="layout">
         <div class="column">
           <span class="title">Render Direct</span>
           <div class="content">
             <div class="item">
               <span class="label">Status</span>
               <span class="value">Online</span>
             </div>
             <div class="item">
               <span class="label">Time</span>
               <span class="value">${new Date().toLocaleTimeString()}</span>
             </div>
           </div>
           <span class="description">Powered by Render & WiFi</span>
         </div>
       </div>
    </div>
  `;

  // Send the response exactly how TRMNL needs it
  res.json({ markup: myHtml });
});

// 3. Health Check (Keep Render Happy)
app.get('/', (req, res) => res.send('TRMNL Plugin Server is Running.'));

// 4. Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
