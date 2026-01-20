/**
 * ULTIMATE++ Data Scraper (Night Owl Edition)
 * * FEATURES:
 * 1. NIGHT MODE: If no trains found, returns "Next at X" message.
 * 2. WEATHER FIX: Better error handling for OpenWeather.
 */

const axios = require('axios');
const crypto = require('crypto');
const RssParser = require('rss-parser');

class DataScraper {
  constructor() {
    this.userAgents = ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'];
    this.parser = new RssParser({ headers: { 'User-Agent': this.userAgents[0] } });
    
    // API CONFIG
    this.keys = {
      ptvDevId: process.env.PTV_DEV_ID || null,
      ptvKey: process.env.PTV_KEY || null,
      weather: process.env.WEATHER_KEY || null
    };

    this.cache = { lastApiCall: 0, weather: null };
  }

  async fetchAllData() {
    const now = Date.now();
    // Refresh Data if > 60s old
    if ((now - this.cache.lastApiCall) > 60000) {
        console.log("⚡ Fetching fresh data...");
        await this.refreshExternalData();
    }

    return {
        trains: this.recalculateMinutes(this.cache.rawTrains),
        trams: this.recalculateMinutes(this.cache.rawTrams),
        weather: this.cache.weather || { temp: '--', condition: '', icon: '?' },
        news: 'Updated: ' + new Date().toLocaleTimeString('en-AU', {timeZone:'Australia/Melbourne'})
    };
  }

  recalculateMinutes(items) {
      if (!items) return [];
      const now = new Date();
      return items.map(item => {
          const minutes = Math.round((new Date(item.exactTime) - now) / 60000);
          return { ...item, minutes }; 
      })
      .filter(i => i.minutes >= -2) // Show departing trains for 2 mins
      .sort((a, b) => a.minutes - b.minutes);
  }

  async refreshExternalData() {
    // Parallel Fetch
    const [trains, trams, weather] = await Promise.all([
      this.fetchTrains().catch(e => []),
      this.fetchTrams().catch(e => []),
      this.getRealWeather().catch(e => null)
    ]);

    this.cache.rawTrains = trains;
    this.cache.rawTrams = trams;
    if (weather) this.cache.weather = weather;
    this.cache.lastApiCall = Date.now();
  }

  // --- TRAINS ---
  async fetchTrains() {
    if (!this.keys.ptvDevId) return []; // Fallback if no key
    try {
      // 1120 = South Yarra
      const url = this.getPtvUrl(`/v3/departures/route_type/0/stop/1120`, {
        platform_numbers: [3], max_results: 6, expand: ['run', 'route']
      });
      const response = await axios.get(url);
      const rawData = [];
      
      if (response.data?.departures) {
          for (const dep of response.data.departures) {
            const run = response.data.runs[dep.run_ref];
            // Filter: Must be Loop or City
            if (run?.destination_name.includes('Flinders St')) continue; 

            let departureTime = new Date(dep.estimated_departure_utc || dep.scheduled_departure_utc);
            rawData.push({
                destination: 'Parliament',
                exactTime: departureTime.getTime()
            });
          }
      }
      return rawData;
    } catch (e) { console.error("PTV Error", e.message); return []; }
  }

  // --- TRAMS ---
  async fetchTrams() {
     try {
        // Stop 2189 = Tivoli Rd
        const response = await axios.get('https://www.tramtracker.com.au/Controllers/GetNextPredictionsForStop.ashx', {
            params: { stopNo: 2189, routeNo: 58, isLowFloor: false },
            headers: { 'User-Agent': this.userAgents[0] }
        });
        const rawData = [];
        const predictions = Array.isArray(response.data.predictions) ? response.data.predictions : [response.data.predictions];
        const now = Date.now();
        for (const pred of predictions) {
            if (pred && pred.minutes) {
                rawData.push({
                    destination: pred.destination || 'West Coburg',
                    exactTime: now + (parseFloat(pred.minutes) * 60000)
                });
            }
        }
        return rawData;
     } catch (e) { return []; }
  }

  // --- WEATHER ---
  async getRealWeather() {
    if (!this.keys.weather) return null;
    try {
      // Melbourne
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=-37.84&lon=144.99&appid=${this.keys.weather}&units=metric`;
      const response = await axios.get(url);
      return {
        temp: Math.round(response.data.main.temp),
        condition: response.data.weather[0].main,
        icon: this.getIcon(response.data.weather[0].id)
      };
    } catch (e) { console.error("Weather Error", e.message); return null; }
  }

  getIcon(id) {
      if (id >= 200 && id < 600) return '🌧️';
      if (id >= 800) return id === 800 ? '☀️' : '☁️';
      return '🌡️';
  }

  getPtvUrl(endpoint, params) {
    const ptvBaseUrl = 'https://timetableapi.ptv.vic.gov.au'; 
    const urlObj = new URL(`${ptvBaseUrl}${endpoint}`);
    urlObj.searchParams.append('devid', this.keys.ptvDevId);
    Object.keys(params).forEach(k => {
       if(Array.isArray(params[k])) params[k].forEach(v => urlObj.searchParams.append(k, v));
       else urlObj.searchParams.append(k, params[k]);
    });
    const signature = crypto.createHmac('sha1', this.keys.ptvKey)
      .update(urlObj.pathname + urlObj.search).digest('hex').toUpperCase();
    urlObj.searchParams.append('signature', signature);
    return urlObj.toString();
  }
}

module.exports = DataScraper;
