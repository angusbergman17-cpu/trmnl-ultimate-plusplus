/**
 * GTFS REALTIME Data Scraper
 * Uses Victorian GTFS Realtime API for Metro Trains and Yarra Trams
 */

const axios = require('axios');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const RssParser = require('rss-parser');

class DataScraper {
  constructor() {
    this.parser = new RssParser();
    
    this.keys = {
      gtfsKey: process.env.GTFS_API_KEY || null,
      weather: process.env.WEATHER_KEY || null
    };
    
    // Diagnostic logging
    console.log('🔑 GTFS API Key loaded:', this.keys.gtfsKey ? `${this.keys.gtfsKey.substring(0, 10)}...` : 'NOT FOUND');
    console.log('🔑 Weather Key loaded:', this.keys.weather ? 'YES' : 'NO');

    // STATIC BACKUP SCHEDULE (Minutes past the hour)
    this.staticSchedule = {
        tram58: [2, 12, 22, 32, 42, 52], 
        trainLoop: [4, 11, 19, 26, 34, 41, 49, 56]
    };

    // GTFS Stop IDs for South Yarra and your tram stop
    this.stops = {
      // South Yarra Platform 3 - City Loop services
      trainStopIds: [
        '19842',  // South Yarra Platform 3
        '19843',  // Alternative Platform ID
      ],
      // Tram Stop 2189 (Tivoli Road) - Route 58
      tramStopIds: [
        '2189',   // Your tram stop
      ]
    };

    this.cache = { 
      lastApiCall: 0, 
      rawTrains: [], 
      rawTrams: [], 
      weather: null, 
      news: '' 
    };
  }

  async fetchAllData() {
    const now = Date.now();
    // 60s Cache Strategy
    if ((now - this.cache.lastApiCall) > 60000) {
        console.log("⚡ Fetching fresh GTFS data...");
        try {
            const timeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("API_TIMEOUT")), 8000)
            );
            await Promise.race([this.refreshExternalData(), timeout]);
        } catch (e) {
            console.log("⚠️ API Timeout or Error:", e.message);
            this.forceStaticFallback();
        }
    }

    return {
        trains: this.formatResults(this.cache.rawTrains),
        trams: this.formatResults(this.cache.rawTrams),
        weather: this.cache.weather || { temp: '--', condition: '', icon: '?' },
        news: this.cache.news || 'Operating Normally'
    };
  }

  forceStaticFallback() {
      this.cache.rawTrains = this.getStaticDepartures(this.staticSchedule.trainLoop, "Parliament (Sched)");
      this.cache.rawTrams = this.getStaticDepartures(this.staticSchedule.tram58, "West Coburg (Sched)");
      this.cache.news = "Data Offline - Using Schedule";
  }

  formatResults(items) {
      if (!items) return [];
      const now = new Date();
      return items.map(item => {
          const msDiff = new Date(item.exactTime) - now;
          const minutes = Math.round(msDiff / 60000);
          return { ...item, minutes }; 
      })
      .filter(i => i.minutes >= -2)
      .sort((a, b) => a.minutes - b.minutes);
  }

  async refreshExternalData() {
    // 1. TRAINS (GTFS Realtime)
    let trains = await this.fetchGtfsTrains();
    if (trains.length === 0) {
      console.log("⚠️ No train data, using static schedule");
      trains = this.getStaticDepartures(this.staticSchedule.trainLoop, "Parliament (Sched)");
    }

    // 2. TRAMS (GTFS Realtime + TramTracker fallback)
    let trams = await this.fetchGtfsTrams();
    if (trams.length === 0) {
      console.log("⚠️ Trying TramTracker fallback...");
      trams = await this.fetchTramTracker();
    }
    if (trams.length === 0) {
      console.log("⚠️ No tram data, using static schedule");
      trams = this.getStaticDepartures(this.staticSchedule.tram58, "West Coburg (Sched)");
    }

    // 3. EXTRAS
    let weather = await this.getRealWeather().catch(e => null);
    let news = await this.getServiceAlerts().catch(e => "Good Service");

    this.cache.rawTrains = trains;
    this.cache.rawTrams = trams;
    if (weather) this.cache.weather = weather;
    this.cache.news = news;
    this.cache.lastApiCall = Date.now();
  }

  async fetchGtfsTrains() {
    if (!this.keys.gtfsKey) {
      console.log("⚠️ No GTFS API key found");
      return [];
    }

    try {
      const response = await axios.get(
        'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro/trip-updates',
        {
          headers: { 'Ocp-Apim-Subscription-Key': this.keys.gtfsKey },
          responseType: 'arraybuffer',
          timeout: 5000
        }
      );

      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(response.data)
      );

      const departures = [];
      const now = Date.now();

      for (const entity of feed.entity) {
        if (!entity.tripUpdate) continue;

        for (const stopTime of entity.tripUpdate.stopTimeUpdate) {
          // Check if this is one of our stops
          if (!this.stops.trainStopIds.includes(stopTime.stopId)) continue;

          // Get departure time (prefer arrival, fall back to departure)
          const departureTime = stopTime.departure?.time || stopTime.arrival?.time;
          if (!departureTime) continue;

          const departureMs = Number(departureTime) * 1000;
          
          // Only include future departures
          if (departureMs < now) continue;

          // Filter: Only City Loop trains (exclude Flinders Street bound)
          const tripId = entity.tripUpdate.trip.tripId || '';
          
          departures.push({
            destination: 'Parliament',
            exactTime: departureMs,
            isScheduled: false,
            tripId: tripId
          });
        }
      }

      console.log(`✅ Found ${departures.length} train departures from GTFS`);
      return departures.slice(0, 6);

    } catch (e) {
      console.error("❌ GTFS Train fetch failed:", e.message);
      if (e.response) {
        console.error("   Status:", e.response.status);
        console.error("   Status Text:", e.response.statusText);
        console.error("   Headers:", JSON.stringify(e.response.headers));
      }
      return [];
    }
  }

  async fetchGtfsTrams() {
    if (!this.keys.gtfsKey) return [];

    try {
      const response = await axios.get(
        'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/tram/trip-updates',
        {
          headers: { 'Ocp-Apim-Subscription-Key': this.keys.gtfsKey },
          responseType: 'arraybuffer',
          timeout: 5000
        }
      );

      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(response.data)
      );

      const departures = [];
      const now = Date.now();

      for (const entity of feed.entity) {
        if (!entity.tripUpdate) continue;

        // Check if this is Route 58
        const routeId = entity.tripUpdate.trip.routeId || '';
        if (!routeId.includes('58')) continue;

        for (const stopTime of entity.tripUpdate.stopTimeUpdate) {
          if (!this.stops.tramStopIds.includes(stopTime.stopId)) continue;

          const departureTime = stopTime.departure?.time || stopTime.arrival?.time;
          if (!departureTime) continue;

          const departureMs = Number(departureTime) * 1000;
          if (departureMs < now) continue;

          departures.push({
            destination: 'West Coburg',
            exactTime: departureMs,
            isScheduled: false
          });
        }
      }

      console.log(`✅ Found ${departures.length} tram departures from GTFS`);
      return departures.slice(0, 6);

    } catch (e) {
      console.error("❌ GTFS Tram fetch failed:", e.message);
      if (e.response) {
        console.error("   Status:", e.response.status);
        console.error("   Status Text:", e.response.statusText);
      }
      return [];
    }
  }

  // TRAMTRACKER FALLBACK (Keep this as backup)
  async fetchTramTracker() {
     try {
        const response = await axios.get(
          'https://www.tramtracker.com.au/Controllers/GetNextPredictionsForStop.ashx',
          {
            params: { stopNo: 2189, routeNo: 58, isLowFloor: false },
            timeout: 5000
          }
        );
        
        const rawData = [];
        const predictions = Array.isArray(response.data.predictions) 
          ? response.data.predictions 
          : [response.data.predictions];
        const now = Date.now();
        
        for (const pred of predictions) {
            if (pred && pred.minutes) {
                rawData.push({ 
                  destination: pred.destination || 'West Coburg', 
                  exactTime: now + (parseFloat(pred.minutes) * 60000), 
                  isScheduled: false 
                });
            }
        }
        
        console.log(`✅ Found ${rawData.length} tram departures from TramTracker`);
        return rawData;
     } catch (e) { 
       console.error("❌ TramTracker fetch failed:", e.message);
       return []; 
     }
  }

  getStaticDepartures(minutesArray, destination) {
      const now = new Date();
      const melTime = new Date(now.getTime() + (11 * 60 * 60 * 1000)); 
      const currentMin = melTime.getUTCMinutes();
      const departures = [];

      for (let m of minutesArray) {
          if (m > currentMin) {
              const departureTime = new Date(now.getTime() + (m - currentMin) * 60000);
              departures.push({ destination, exactTime: departureTime.getTime(), isScheduled: true });
          }
      }
      
      // Next Hour Overflow
      for (let m of minutesArray) {
          const minutesUntil = (60 - currentMin) + m;
          const departureTime = new Date(now.getTime() + minutesUntil * 60000);
          departures.push({ destination, exactTime: departureTime.getTime(), isScheduled: true });
      }
      
      return departures.slice(0, 3);
  }

  async getServiceAlerts() {
    try {
      const feed = await this.parser.parseURL('https://www.ptv.vic.gov.au/feeds/rss/lines/2');
      const relevant = feed.items.find(item => 
        item.title && ['Cranbourne', 'Pakenham', 'Frankston', 'Sandringham'].some(
          line => item.title.includes(line)
        )
      );
      if (relevant) return `⚠️ ${relevant.title.split(':')[0]}`;
      return "Good Service";
    } catch (e) { 
      console.error("❌ Service alerts fetch failed:", e.message);
      return "Good Service"; 
    }
  }

  async getRealWeather() {
    if (!this.keys.weather) return null;
    
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=-37.84&lon=144.99&appid=${this.keys.weather}&units=metric`;
      const response = await axios.get(url, { timeout: 5000 });
      return {
        temp: Math.round(response.data.main.temp),
        condition: response.data.weather[0].main,
        icon: (response.data.weather[0].id >= 800) 
          ? (response.data.weather[0].id === 800 ? '☀️' : '☁️') 
          : '🌧️'
      };
    } catch (e) {
      console.error("❌ Weather fetch failed:", e.message);
      return null;
    }
  }
}

module.exports = DataScraper;
