/**
 * ULTIMATE++ Data Scraper (Crash Proof Edition)
 * * Feature: If API times out, it INSTANTLY loads the static schedule.
 */

const axios = require('axios');
const crypto = require('crypto');
const RssParser = require('rss-parser');

class DataScraper {
  constructor() {
    this.userAgents = ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'];
    this.parser = new RssParser({ headers: { 'User-Agent': this.userAgents[0] } });
    
    this.keys = {
      ptvDevId: process.env.PTV_DEV_ID || null,
      ptvKey: process.env.PTV_KEY || null,
      weather: process.env.WEATHER_KEY || null
    };

    // STATIC BACKUP SCHEDULE (Minutes past the hour)
    this.staticSchedule = {
        tram58: [2, 12, 22, 32, 42, 52], 
        trainLoop: [4, 11, 19, 26, 34, 41, 49, 56]
    };

    this.cache = { lastApiCall: 0, rawTrains: [], rawTrams: [], weather: null, news: '' };
    this.ids = { trainStop: 1120, tramStop: 2189 };
  }

  async fetchAllData() {
    const now = Date.now();
    // 60s Cache Strategy
    if ((now - this.cache.lastApiCall) > 60000) {
        console.log("⚡ Fetching fresh data...");
        try {
            // Timeout Wrapper: If fetch takes > 5s, throw error to trigger fallback
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("API_TIMEOUT")), 5000));
            await Promise.race([this.refreshExternalData(), timeout]);
        } catch (e) {
            console.log("⚠️ API Timeout or Error. Forcing Static Fallback.");
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

  // FORCE FALLBACK (Used when API dies)
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
    // 1. TRAINS
    let trains = await this.fetchPtvDepartures(0, this.ids.trainStop, [3]);
    if (trains.length === 0) trains = this.getStaticDepartures(this.staticSchedule.trainLoop, "Parliament (Sched)");

    // 2. TRAMS
    let trams = await this.fetchTramTracker();
    if (trams.length === 0) trams = this.getStaticDepartures(this.staticSchedule.tram58, "West Coburg (Sched)");

    // 3. EXTRAS
    let weather = await this.getRealWeather().catch(e => null);
    let news = await this.getServiceAlerts().catch(e => "Good Service");

    this.cache.rawTrains = trains;
    this.cache.rawTrams = trams;
    if (weather) this.cache.weather = weather;
    this.cache.news = news;
    this.cache.lastApiCall = Date.now();
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

  // --- API CALLS (Kept same as before) ---
  async fetchPtvDepartures(routeType, stopId, platforms) {
    if (!this.keys.ptvDevId) return [];
    try {
      let urlStr = `/v3/departures/route_type/${routeType}/stop/${stopId}?max_results=6&expand=run&expand=route`;
      if (platforms) platforms.forEach(p => urlStr += `&platform_numbers=${p}`);
      const url = this.getPtvUrl(urlStr);
      const response = await axios.get(url);
      const rawData = [];
      if (response.data?.departures) {
          for (const dep of response.data.departures) {
            const run = response.data.runs[dep.run_ref];
            if (routeType === 0 && run?.destination_name.includes('Flinders St')) continue;
            let departureTime = new Date(dep.estimated_departure_utc || dep.scheduled_departure_utc);
            rawData.push({ destination: 'Parliament', exactTime: departureTime.getTime(), isScheduled: false });
          }
      }
      return rawData;
    } catch (e) { return []; }
  }

  async fetchTramTracker() {
     try {
        const response = await axios.get('https://www.tramtracker.com.au/Controllers/GetNextPredictionsForStop.ashx', {
            params: { stopNo: this.ids.tramStop, routeNo: 58, isLowFloor: false },
            headers: { 'User-Agent': this.userAgents[0] }
        });
        const rawData = [];
        const predictions = Array.isArray(response.data.predictions) ? response.data.predictions : [response.data.predictions];
        const now = Date.now();
        for (const pred of predictions) {
            if (pred && pred.minutes) {
                rawData.push({ destination: pred.destination || 'West Coburg', exactTime: now + (parseFloat(pred.minutes) * 60000), isScheduled: false });
            }
        }
        return rawData;
     } catch (e) { return []; }
  }

  async getServiceAlerts() {
    try {
      const feed = await this.parser.parseURL('https://www.ptv.vic.gov.au/feeds/rss/lines/2');
      const relevant = feed.items.find(item => item.title && ['Cranbourne', 'Pakenham', 'Frankston', 'Sandringham'].some(line => item.title.includes(line)));
      if (relevant) return `⚠️ ${relevant.title.split(':')[0]}`;
      return "Good Service";
    } catch (e) { return "Good Service"; }
  }

  async getRealWeather() {
    if (!this.keys.weather) return null;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=-37.84&lon=144.99&appid=${this.keys.weather}&units=metric`;
    const response = await axios.get(url);
    return {
      temp: Math.round(response.data.main.temp),
      condition: response.data.weather[0].main,
      icon: (response.data.weather[0].id >= 800) ? (response.data.weather[0].id === 800 ? '☀️' : '☁️') : '🌧️'
    };
  }

  getPtvUrl(requestPath) {
    const ptvBaseUrl = 'https://timetableapi.ptv.vic.gov.au'; 
    const urlObj = new URL(`${ptvBaseUrl}${requestPath}`);
    urlObj.searchParams.append('devid', this.keys.ptvDevId);
    const signature = crypto.createHmac('sha1', this.keys.ptvKey)
      .update(urlObj.pathname + urlObj.search).digest('hex').toUpperCase();
    urlObj.searchParams.append('signature', signature);
    return urlObj.toString();
  }
}

module.exports = DataScraper;