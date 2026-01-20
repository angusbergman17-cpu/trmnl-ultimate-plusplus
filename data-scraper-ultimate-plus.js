/**
 * ULTIMATE++ Data Scraper (Fan Edition)
 * * Improvements for PT Fans:
 * 1. PTV API Authentication (HMAC-SHA1) - Gets REAL data
 * 2. Live Disruptions - Knows when lines are down
 * 3. Run References - Shows the specific Trip ID
 */

const axios = require('axios');
const crypto = require('crypto'); // Required for PTV Signature

class DataScraper {
  constructor() {
    this.cache = {
      trains: null,
      trams: null,
      weather: null,
      news: null,
      disruptions: null,
      lastUpdate: null
    };
    this.cacheTimeout = 30000; // 30 seconds
    
    // Auth Credentials from Render Environment
    this.ptvCreds = {
      devId: process.env.PTV_DEV_ID || null,
      key: process.env.PTV_KEY || null
    };

    // TramTracker (Still works without Auth)
    this.tramTrackerConfig = {
      baseUrl: 'https://www.tramtracker.com.au/Controllers',
    };
    
    // PTV API Config
    this.ptvConfig = {
      baseUrl: 'https://timetableapi.ptv.vic.gov.au/v3',
    };
    
    // Configurable Stops (Defaults to South Yarra / Tivoli Rd if config fails)
    this.stops = {
      southYarra: 1120,
      tivoliRoad: 2189,
    };
  }

  /**
   * Generates the HMAC-SHA1 Signature required by PTV
   */
  getPtvUrl(endpoint, params = {}) {
    if (!this.ptvCreds.devId || !this.ptvCreds.key) {
      console.warn('[PTV] Missing Credentials - Requests will likely fail (403)');
      return `${this.ptvConfig.baseUrl}${endpoint}`;
    }

    // 1. Construct the URL with DevID
    const urlObj = new URL(`${this.ptvConfig.baseUrl}${endpoint}`);
    urlObj.searchParams.append('devid', this.ptvCreds.devId);
    
    // Add all other params
    Object.keys(params).forEach(key => {
        // Handle array params (e.g. platform_numbers)
        if (Array.isArray(params[key])) {
            params[key].forEach(val => urlObj.searchParams.append(key, val));
        } else {
            urlObj.searchParams.append(key, params[key]);
        }
    });

    // 2. Sign the "Path + Query" part
    const requestPath = urlObj.pathname + urlObj.search;
    const signature = crypto.createHmac('sha1', this.ptvCreds.key)
                            .update(requestPath)
                            .digest('hex')
                            .toUpperCase();

    // 3. Append signature
    urlObj.searchParams.append('signature', signature);
    return urlObj.toString();
  }

  async fetchAllData() {
    const now = Date.now();
    if (this.cache.lastUpdate && (now - this.cache.lastUpdate) < this.cacheTimeout) {
      return this.cache;
    }

    try {
      // Parallel fetch for speed
      const [trains, trams, weather, news, disruptions] = await Promise.all([
        this.fetchTrains(),
        this.fetchTrams(),
        this.fetchWeather(),
        this.fetchNews(),
        this.fetchDisruptions() // Now fetching REAL disruptions
      ]);

      this.cache = { trains, trams, weather, news, disruptions, lastUpdate: now };
      return this.cache;
    } catch (error) {
      console.error('Error fetching data:', error);
      return this.cache.lastUpdate ? this.cache : this.getPlaceholderData();
    }
  }

  // ===== TRAINS (PTV API V3) =====
  
  async fetchTrains() {
    try {
      console.log('[TRAINS] Fetching PTV API v3...');
      // Requesting Route 0 (Train), Stop 1120 (South Yarra)
      const url = this.getPtvUrl(`/v3/departures/route_type/0/stop/${this.stops.southYarra}`, {
        platform_numbers: [3], // City bound
        max_results: 6,
        expand: ['run', 'route', 'direction'] // Expand for "Fan" details
      });

      const response = await axios.get(url);
      const departures = [];
      const now = new Date();

      if (response.data && response.data.departures) {
          for (const dep of response.data.departures) {
            const scheduled = new Date(dep.scheduled_departure_utc);
            const estimated = dep.estimated_departure_utc ? new Date(dep.estimated_departure_utc) : scheduled;
            const minutes = Math.round((estimated - now) / 60000);

            if (minutes >= 0 && minutes <= 60) {
                const run = response.data.runs[dep.run_ref];
                const route = response.data.routes[dep.route_id];
                
                // "Fan" Data: Run ID (e.g., 9421)
                const runId = dep.run_ref; 
                
                departures.push({
                    destination: this.cleanDestination(run?.destination_name),
                    platform: dep.platform_number,
                    minutes: minutes,
                    stopsAll: !dep.flags.includes('Express'),
                    line: {
                        name: route?.route_name || 'Metro',
                        color: this.getLineColor(route?.route_name)
                    },
                    runRef: runId, // New field for fans
                    realtime: true,
                    source: 'PTV-API'
                });
            }
          }
      }
      
      // Sort and take top 3
      departures.sort((a, b) => a.minutes - b.minutes);
      return departures.slice(0, 3);

    } catch (error) {
      console.log(`[TRAINS] PTV API Failed: ${error.message}`);
      return this.fetchTrainsFallback(); // Fallback to simulation
    }
  }

  // ===== TRAMS (TramTracker) =====
  async fetchTrams() {
     // Your existing TramTracker logic is solid and requires no auth.
     // I've kept it here to ensure continuity.
     try {
        const url = `${this.tramTrackerConfig.baseUrl}/GetNextPredictionsForStop.ashx`;
        const response = await axios.get(url, {
            params: { stopNo: this.stops.tivoliRoad, routeNo: 58, isLowFloor: false }
        });

        const departures = [];
        const predictions = Array.isArray(response.data.predictions) ? response.data.predictions : [response.data.predictions];

        for (const pred of predictions) {
            if (pred) {
                const minutes = Math.round(pred.minutes || 0);
                if (minutes >= 0 && minutes <= 60) {
                    departures.push({
                        route: '58',
                        destination: pred.destination || 'West Coburg',
                        minutes: minutes,
                        vehicleNo: pred.vehicleNo, // Fan Detail: Tram ID!
                        realtime: true,
                        source: 'TramTracker'
                    });
                }
            }
        }
        return departures.sort((a, b) => a.minutes - b.minutes).slice(0, 3);
     } catch (e) {
         return this.fetchTramsFallback();
     }
  }

  // ===== DISRUPTIONS (New!) =====
  async fetchDisruptions() {
      if (!this.ptvCreds.devId) return null; // Can't fetch without keys

      try {
          // Fetch disruptions for Metro Trains (Route Type 0)
          const url = this.getPtvUrl(`/v3/disruptions/route_type/0`, {
              status: 'current'
          });
          const response = await axios.get(url);
          
          if (response.data && response.data.disruptions) {
              // Find "Metro Train" disruptions that contain "Sandringham", "Cranbourne", or "Pakenham"
              const relevant = response.data.disruptions.find(d => 
                  d.routes && d.routes.some(r => 
                      ['Cranbourne', 'Pakenham', 'Frankston', 'Sandringham'].some(line => r.route_name.includes(line))
                  )
              );

              if (relevant) {
                  // Return the title (e.g., "Buses replace trains...")
                  return relevant.title; 
              }
          }
          return null; // No relevant disruptions
      } catch (error) {
          console.log('[DISRUPTIONS] Failed:', error.message);
          return null;
      }
  }

  // ===== WEATHER & NEWS =====
  async fetchWeather() { return this.getRealisticMelbourneWeather(); }
  async fetchNews() { 
      // Fan feature: If there is a disruption, return that. Else return generic news.
      if (this.cache.disruptions) return this.cache.disruptions;
      return "Metro Trains operating normally • Good Service"; 
  }

  // ===== HELPERS =====
  cleanDestination(name) {
      if (!name) return 'City';
      if (name.includes('Flinders')) return 'Flinders St';
      if (name.includes('Southern Cross')) return 'Sth Cross';
      return 'City Loop';
  }

  getLineColor(routeName) {
    if (!routeName) return '#279FD5';
    const name = routeName.toLowerCase();
    if (name.includes('cranbourne') || name.includes('pakenham')) return '#279FD5'; // Blue
    if (name.includes('frankston')) return '#028430'; // Green
    if (name.includes('sandringham')) return '#F178AF'; // Pink
    return '#279FD5';
  }

  // Fallbacks (Simulation)
  fetchTrainsFallback() {
      // (Keep your existing simulation logic here just in case keys fail)
      return [
        { destination: 'City Loop', platform: '3', minutes: 4, stopsAll: true, line: {name: 'Simulated', color: '#666'}, realtime: false, source: 'Sim' },
        { destination: 'Flinders St', platform: '3', minutes: 12, stopsAll: false, line: {name: 'Simulated', color: '#666'}, realtime: false, source: 'Sim' }
      ];
  }
  
  fetchTramsFallback() {
      return [{ route: '58', destination: 'West Coburg', minutes: 5, realtime: false, source: 'Sim' }];
  }
  
  getRealisticMelbourneWeather() {
      // (Keep your existing weather logic)
      return { temp: 16, condition: 'Cloudy', icon: '☁️' };
  }
}

module.exports = DataScraper;