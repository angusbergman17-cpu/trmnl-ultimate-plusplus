# 🚆 TRMNL Ultimate++ 

E-ink display for Melbourne public transport - South Yarra to Parliament commute.

## Features

- **Live tram departures** via TramTracker API (no auth needed!)
- **Live train departures** via GTFS API (optional - falls back to simulation)
- **Weather** via OpenWeatherMap (optional)
- **Coffee decision** - tells you if you have time to grab a coffee
- **Route planner** - shows your journey timeline to 80 Collins

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | Status page |
| `/api/data` | Raw JSON data |
| `/api/screen` | E-ink PNG image (for TRMNL device) |
| `/api/preview` | HTML preview |
| `/debug/env` | Check environment variables |

## Deploy to Render

1. Push this code to a GitHub repo
2. Connect to Render
3. **Build Command:** `npm install && npx puppeteer browsers install chrome`
4. **Start Command:** `npm start`

### Optional Environment Variables

| Variable | Description |
|----------|-------------|
| `GTFS_API_KEY` | PTV GTFS API key (get free from opendata.transport.vic.gov.au) |
| `WEATHER_KEY` | OpenWeatherMap API key |

**Without these keys, the app uses simulated data - still fully functional!**

## TRMNL Configuration

Point your TRMNL device to:
```
https://your-app.onrender.com/api/screen
```

Refresh rate: 20-60 seconds recommended.

## Local Development

```bash
npm install
npm start
```

Visit http://localhost:10000

## License

MIT
