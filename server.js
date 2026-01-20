
import express from 'express';
import compression from 'compression';
import screenRouter from './routes/screen.js';

const app = express();

// Recommended for reverse proxy setups like Render
app.set('trust proxy', 1);

// Light JSON for other endpoints if you need
app.use(express.json({ limit: '1mb' }));
app.use(compression());

// Health check for Render
app.get('/healthz', (req, res) => {
  res.status(200).type('text/plain').send('ok');
});

// Image API
app.use('/api', screenRouter);

// Simple root info
app.get('/', (req, res) => {
  res.type('text/plain').send('Image service is running. Try /api/screen');
});

// Port: Render injects PORT
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on :${port}`);
});
``
