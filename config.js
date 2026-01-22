
// config.js
module.exports = {
  app: {
    port: process.env.PORT || 10000,
    refreshSeconds: 60,           // how often to refresh data
    imageRefreshSeconds: 60,      // how often to re-render image
    timezone: 'Australia/Melbourne'
  },

  // IMPORTANT: these are the PUBLIC stop codes users see at stops/apps (PTV/TramTracker).
  // We will translate them to GTFS stop_id at runtime. Keep using the numbers you know.
  trains: {
    label: 'Trains',
    // Example: South Yarra platforms (public codes). Replace with yours if needed.
    stopCodes: ['19842','19843','19840','19841','19844','19845'],
    maxDepartures: 6
  },

  trams: {
    label: 'Trams',
    // Example: Route 58 Tivoli Rd stop public code
    stopCodes: ['2189'],
    routesFilter: [],            // optional, e.g. ['aus:vic:vic-03-58:']
    maxDepartures: 6
  },

  weather: {
    enabled: true,
    city: 'Melbourne',
    // If you have an API key, set WEATHER_API_KEY env var; otherwise it will skip gracefully
  },

  news: { enabled: false },

  // Feature toggles for data sources
  sources: {
    gtfsStatic: { enabled: true },         // Always needed for base schedule & stop mapping
    gtfsRealtimeTrams: { enabled: true },  // Uses DTP Yarra Trams public GTFS-R (no keys)
    gtfsRealtimeTrains: { enabled: false },// Off by default unless you wire train GTFS-R
    ptvTimetable: { enabled: false },      // Requires dev ID & HMAC (403 without it)
    tramTracker:  { enabled: false }       // Unreliable server-to-server; keep off by default
  },

  // Advanced
  timeouts: {
    defaultMs: 8000,
    tramTrackerMs: 12000
  },

  ui: {
    screen: { width: 800, height: 480 },
    fonts: { base: 20, small: 14, large: 28 },
    theme: { fg: '#000', bg: '#fff', accent: '#000' }
  }
};
``
