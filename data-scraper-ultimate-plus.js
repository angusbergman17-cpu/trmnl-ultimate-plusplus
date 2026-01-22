
// data-scraper-ultimate-plus.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const { parse } = require('csv-parse/sync');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

const config = require('./config');

// --- tiny helper: GET as Buffer with timeout ---
function httpGetBuffer(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error(`timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
  });
}

function loadCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return parse(raw, { columns: true, skip_empty_lines: true });
}

function buildStopCodeToIdMap(stops) {
  const map = new Map();
  for (const s of stops) {
    if (s.stop_code && s.stop_id) {
      map.set(String(s.stop_code).trim(), String(s.stop_id).trim());
    }
  }
  return map;
}

function resolveGtfsStopIdsFromCodes(stopCodes, stopCodeToId) {
  const ids = new Set();
  for (const code of stopCodes || []) {
    const id = stopCodeToId.get(String(code).trim());
    if (id) ids.add(id);
  }
  return Array.from(ids);
}

function nowEpochSeconds() {
  return Math.floor(Date.now() / 1000);
}
function minutesFromNow(targetEpoch) {
  return Math.round((targetEpoch - nowEpochSeconds()) / 60);
}

// --------- GTFS STATIC LOADER ----------
function loadStaticGtfs() {
  const baseDir = path.join(__dirname, 'gtfs'); // <-- GTFS files must be here
  const req = (name) => path.join(baseDir, name);
  const missing = ['stops.txt', 'trips.txt', 'stop_times.txt'].filter(f => !fs.existsSync(req(f)));
  if (missing.length) {
    throw new Error(`GTFS files missing in ./gtfs: ${missing.join(', ')}. Place DataVic GTFS Schedule here.`);
  }
  const stops = loadCsv(req('stops.txt'));
  const trips = loadCsv(req('trips.txt'));
  const stopTimes = loadCsv(req('stop_times.txt'));
  return { stops, trips, stopTimes };
}

// stop_id -> array of stop_times rows (subset)
function indexStopTimesByStop(stopTimes) {
  const idx = new Map();
  for (const st of stopTimes) {
    const key = String(st.stop_id).trim();
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(st);
  }
  return idx;
}

// very light static schedule: next departures within ~3 hours
function upcomingDeparturesFromStatic({ stopIds, stopTimesIdx, maxDepartures }) {
  const out = [];
  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  for (const stopId of stopIds) {
    const arr = (stopTimesIdx.get(stopId) || []);
    for (const st of arr) {
      const [h, m, s] = String(st.departure_time).split(':').map(Number);
      const sec = (h * 3600 + m * 60 + (s || 0));
      const deltaMin = Math.round((sec - nowSec) / 60);
      if (deltaMin >= -2 && deltaMin <= 180) {
        out.push({ stop_id: stopId, trip_id: st.trip_id, scheduledDepartureMin: deltaMin });
      }
    }
  }
  out.sort((a, b) => a.scheduledDepartureMin - b.scheduledDepartureMin);
  return out.slice(0, maxDepartures);
}

// --------- YARRA TRAMS GTFS-REALTIME (PUBLIC) ----------
const YARRA_TRAMS = {
  tripUpdatesUrl: 'https://data.ptv.vic.gov.au/yarratrams/tripupdates.pb',
  vehiclePositionsUrl: 'https://data.ptv.vic.gov.au/yarratrams/vehiclepositions.pb',
  serviceAlertsUrl: 'https://data.ptv.vic.gov.au/yarratrams/servicealerts.pb'
  // Public GTFS-R feeds published by DTP for Yarra Trams (no keys). [3](https://www.data.vic.gov.au/gtfs-realtime-apis-yarra-tram-services)
};

async function fetchGtfsR(url) {
  const buf = await httpGetBuffer(url, config.timeouts.defaultMs);
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf);
}

// Merge GTFS-R TripUpdates with requested stop_ids
function liveDeparturesFromTripUpdates(feed, requestedStopIds, maxDepartures) {
  const want = new Set(requestedStopIds.map(String));
  const out = [];
  for (const ent of feed.entity) {
    const tu = ent.tripUpdate;
    if (!tu || !tu.stopTimeUpdate) continue;

    const tripId = tu.trip?.tripId || '';
    for (const stu of tu.stopTimeUpdate) {
      const stopId = (stu.stopId || '').trim();
      if (!stopId || !want.has(stopId)) continue;
      const ts = (stu.departure?.time || stu.arrival?.time || 0);
      if (!ts) continue;
      out.push({ stop_id: stopId, trip_id: tripId, liveDepartureMin: minutesFromNow(Number(ts)) });
    }
  }
  out.sort((a, b) => a.liveDepartureMin - b.liveDepartureMin);
  return out.filter(d => d.liveDepartureMin >= -2).slice(0, maxDepartures);
}

function normalizeAlertsFromGtfsR(feed) {
  const alerts = [];
  for (const ent of feed.entity) {
    const alert = ent.alert;
    if (!alert) continue;
    const header = (alert.headerText?.translation?.[0]?.text) || 'Service alert';
    const desc = (alert.descriptionText?.translation?.[0]?.text) || '';
    alerts.push({ title: header, description: desc });
  }
  return alerts;
}

// --------- MAIN SCRAPE -----------
async function scrapeAll() {
  const { stops, trips, stopTimes } = loadStaticGtfs();
  const stopTimesIdx = indexStopTimesByStop(stopTimes);
  const stopCodeToId = buildStopCodeToIdMap(stops);

  // TRAINS (static unless you enable gtfsRealtimeTrains/PTV)
  const trainStopIds = resolveGtfsStopIdsFromCodes(config.trains.stopCodes, stopCodeToId);
  let trainDepartures = upcomingDeparturesFromStatic({
    stopIds: trainStopIds, stopTimesIdx, maxDepartures: config.trains.maxDepartures
  });

  // TRAMS: GTFS-R first, static fallback
  const tramStopIds = resolveGtfsStopIdsFromCodes(config.trams.stopCodes, stopCodeToId);
  let tramDepartures = [];
  let serviceAlerts = [];

  if (config.sources.gtfsRealtimeTrams.enabled) {
    try {
      const tuFeed = await fetchGtfsR(YARRA_TRAMS.tripUpdatesUrl);
      tramDepartures = liveDeparturesFromTripUpdates(tuFeed, tramStopIds, config.trams.maxDepartures);
    } catch (e) {
      console.warn('GTFS-R TripUpdates (trams) failed:', e.message);
    }
    try {
      const saFeed = await fetchGtfsR(YARRA_TRAMS.serviceAlertsUrl);
      serviceAlerts = normalizeAlertsFromGtfsR(saFeed);
    } catch (e) {
      console.warn('GTFS-R ServiceAlerts (trams) failed:', e.message);
    }
  }

  if (tramDepartures.length === 0) {
    tramDepartures = upcomingDeparturesFromStatic({
      stopIds: tramStopIds, stopTimesIdx, maxDepartures: config.trams.maxDepartures
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    trains: { label: config.trains.label, stopCodes: config.trains.stopCodes, departures: trainDepartures },
    trams:  { label: config.trams.label,  stopCodes: config.trams.stopCodes, departures: tramDepartures },
    alerts: serviceAlerts
  };
}

module.exports = { scrapeAll };
``
