/**
 * ULTIMATE++ Data Scraper (Ghost Edition)
 * * FEATURES:
 * 1. PARLIAMENT FILTER: Keeps only City Loop trains (South Yarra -> Parliament).
 * 2. GHOST MODE: Rotates User-Agents and sends "Human" headers to bypass blocks.
 * 3. HYBRID ALERTS: Scrapes PTV RSS + HTML Fallback with Referrer spoofing.
 */

const axios = require('axios');
const crypto = require('crypto');
const RssParser = require('rss-parser');

class DataScraper {
  constructor() {
    // 1. POOL OF MODERN BROWSERS (We pick one at random)
    this.userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];

    // Pick a random identity for this session
    this.currentIdentity = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];

    // Initialize RSS Parser with this identity
    this.parser = new RssParser({
        headers: { 
            'User-Agent': this.currentIdentity,
            'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9',
        }
    });
    
    this.publicFeeds = {
      metro: 'https://www.ptv.vic.gov.au/feeds/rss/lines/2',
      metroBackup: 'https://www.metrotrains.com.au/'
    };

    this.cache = {
      trains: null,
      trams: null,
      weather: null,
      news: null,
      lastUpdate: null
    };
    
    this.ptvCreds = {
      devId: process.env.PTV_DEV_ID || null,
      key: process.env.PTV_KEY || null
    };

    this.tramTrackerUrl = 'https://www.tramtracker.com.au/Controllers/GetNextPredictionsForStop.ashx';
    this.ptvBaseUrl = 'https://timetableapi.ptv.vic.gov.au'; 
    
    this.stops = {
      southYarra: 1120,
      tivoliRoad: 2189,
    };
  }

  // --- HELPER: GENERATE "HUMAN" HEADERS ---
  getGhostHeaders(referer = 'https://www.google.com/') {
      return {
          'User-Agent': this.currentIdentity,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-AU,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': referer, // Spoofs where we came from
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'cross-site',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0'
      };
  }

  async fetchAllData() {
    const now = Date.now();
    if (this.cache.lastUpdate && (now - this.cache.lastUpdate) < 30000) {
      return this.cache;
    }

    const [trains, trams, weather, news] = await Promise.all([
      this.getTrains(),
      this.getTrams(),
      this.getWeather(),
      this.getServiceAlerts()
    ]);

    this.cache = { trains, trams, weather, news, lastUpdate: now };
    return this.cache;
  }

  // --- 1. TRAINS (Parliament Filter) ---
  async getTrains() {
    if (this.ptvCreds.devId && this.ptvCreds.key) {
      return this.fetchPtvTrains();
    }
    
    // FALLBACK SIMULATION (Parliament Specific)
    // We only simulate trains going to City Loop (Parliament)
    return [
      { destination: 'City Loop', platform: '3', minutes: this.getStaticMinutes(4), stopsAll: true },
      { destination: 'City Loop', platform: '3', minutes: this.getStaticMinutes(14), stopsAll: true },
      { destination: 'City Loop', platform: '3', minutes: this.getStaticMinutes(22), stopsAll: false }
    ];
  }

  getStaticMinutes(offset) {
    const now = new Date();
    const currentMin = now.getMinutes();
    let mins = (offset - (currentMin % 10)); 
    if (mins < 0) mins += 10;
    return mins;
  }

  async fetchPtvTrains() {
    try {
      const url = this.getPtvUrl(`/v3/departures/route_type/0/stop/${this.stops.southYarra}`, {
        platform_numbers: [3],
        max_results: 8, // Get extras to allow filtering
        expand: ['run', 'route']
      });
      
      const response = await axios.get(url);
      const departures = [];
      const now = new Date();

      if (response.data?.departures) {
          for (const dep of response.data.departures) {
            const run = response.data.runs[dep.run_ref];
            const destName = this.cleanDestination(run?.destination_name);
            
            // --- PARLIAMENT FILTER ---
            // Only keep "City Loop" (Parliament) trains. 
            // Reject "Flinders St" (Direct)
            if (destName === 'Flinders St') continue;

            const scheduled = new Date(dep.scheduled_departure_utc);
            const estimated = dep.estimated_departure_utc ? new Date(dep.estimated_departure_utc) : scheduled;
            const minutes = Math.round((estimated - now) / 60000);

            if (minutes >= 0 && minutes < 90) {
                departures.push({
                    destination: 'Parliament', 
                    platform: dep.platform_number,
                    minutes: minutes,
                    stopsAll: !dep.flags.includes('Express'),
                    realtime: true
                });
            }
          }
      }
      return departures.sort((a, b) => a.minutes - b.minutes).slice(0, 3);
    } catch (e) { return []; }
  }

  cleanDestination(name) {
      if (!name) return 'City';
      if (name.includes('Flinders')) return 'Flinders St';
      if (name.includes('Southern Cross')) return 'City Loop';
      return 'City Loop';
  }

  // --- 2. LIVE TRAMS (With Stealth Headers) ---
  async getTrams() {
     try {
        const response = await axios.get(this.tramTrackerUrl, {
            params: { stopNo: this.stops.tivoliRoad, routeNo: 58, isLowFloor: false },
            // Make TramTracker think we are a real phone/browser
            headers: this.getGhostHeaders('https://www.tramtracker.com.au/')
        });
        const departures = [];
        const predictions = Array.isArray(response.data.predictions) ? response.data.predictions : [response.data.predictions];

        for (const pred of predictions) {
            if (pred) {
                const minutes = Math.round(pred.minutes || 0);
                if (minutes >= 0 && minutes < 60) {
                    departures.push({
                        route: '58',
                        destination: pred.destination || 'West Coburg',
                        minutes: minutes,
                        realtime: true 
                    });
                }
            }
        }
        return departures.sort((a, b) => a.minutes - b.minutes).slice(0, 3);
     } catch (e) {
         return [{ route: '58', destination: 'West Coburg', minutes: 5, realtime: false }];
     }
  }

  // --- 3. ALERTS (Ghost Mode) ---
  async getServiceAlerts() {
    try {
      // Try RSS first (Official)
      const feed = await this.parser.parseURL(this.publicFeeds.metro);
      const relevant = feed.items.find(item => 
        item.title && ['Cranbourne', 'Pakenham', 'Frankston', 'Sandringham'].some(line => item.title.includes(line))
      );
      if (relevant) return `⚠️ ${relevant.title.split(':')[0]}`;
      return "Metro Trains operating normally • Good Service";
    } catch (rssError) {
      try {
        // FALLBACK: Scrape HTML with full stealth headers
        // We set the Referer to their own site so it looks internal
        const { data: html } = await axios.get(this.publicFeeds.metroBackup, { 
            headers: this.getGhostHeaders('https://www.metrotrains.com.au/') 
        });
        
        if (html.includes('Good Service')) return "Metro Trains operating normally • Good Service";
        if (html.includes('Major Delays')) return "⚠️ Major Delays reported on Metro";
        return "Metro Trains operating normally"; 
      } catch (e) { return "Metro Trains operating normally • Good Service"; }
    }
  }

  getPtvUrl(endpoint, params) {
    const urlObj = new URL(`${this.ptvBaseUrl}${endpoint}`);
    urlObj.searchParams.append('devid', this.ptvCreds.devId);
    Object.keys(params).forEach(k => {
       if(Array.isArray(params[k])) params[k].forEach(v => urlObj.searchParams.append(k, v));
       else urlObj.searchParams.append(k, params[k]);
    });
    const signature = crypto.createHmac('sha1', this.ptvCreds.key)
      .update(urlObj.pathname + urlObj.search).digest('hex').toUpperCase();
    urlObj.searchParams.append('signature', signature);
    return urlObj.toString();
  }

  async getWeather() { return { temp: 16, condition: 'Cloudy', icon: '☁️' }; }
}

module.exports = DataScraper;
