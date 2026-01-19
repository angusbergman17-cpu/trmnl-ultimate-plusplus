/**
 * ULTIMATE++ Data Scraper for Melbourne PT
 * 
 * Quad-tier fallback system:
 * 1. TramTracker API (trams only, NO AUTH!)
 * 2. PTV Timetable API v3 (NO AUTH!)
 * 3. GTFS Realtime (optional key)
 * 4. Smart simulations (always works)
 */

const axios = require('axios');

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
    
    // TramTracker API (trams only, NO AUTH!)
    this.tramTrackerConfig = {
      baseUrl: 'https://www.tramtracker.com.au/Controllers',
      enabled: true
    };
    
    // PTV Timetable API V3 (NO AUTH!)
    this.ptvConfig = {
      baseUrl: 'https://timetableapi.ptv.vic.gov.au/v3',
      enabled: true
    };
    
    // GTFS Realtime (fallback)
    this.gtfsConfig = {
      baseUrl: 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1',
      apiKey: process.env.GTFS_API_KEY || null,
      enabled: !!process.env.GTFS_API_KEY
    };
    
    // Stop IDs
    this.stops = {
      southYarra: 1120,        // PTV stop ID
      southYarraGTFS: '19842', // GTFS stop ID
      tivoliRoad: 2189,        // TramTracker ID
    };
  }

  async fetchAllData() {
    const now = Date.now();
    
    if (this.cache.lastUpdate && (now - this.cache.lastUpdate) < this.cacheTimeout) {
      return this.cache;
    }

    try {
      const [trains, trams, weather, news, disruptions] = await Promise.all([
        this.fetchTrains(),
        this.fetchTrams(),
        this.fetchWeather(),
        this.fetchNews(),
        this.fetchDisruptions()
      ]);

      this.cache = {
        trains,
        trams,
        weather,
        news,
        disruptions,
        lastUpdate: now
      };

      return this.cache;
    } catch (error) {
      console.error('Error fetching data:', error);
      return this.cache.lastUpdate ? this.cache : this.getPlaceholderData();
    }
  }

  // ===== TRAINS =====
  
  async fetchTrains() {
    // Try PTV API (no auth)
    try {
      console.log('[TRAINS] Attempting PTV API (no auth)...');
      const trains = await this.fetchTrainsPTV();
      if (trains && trains.length > 0) {
        console.log(`[TRAINS] ✓ PTV API SUCCESS - ${trains.length} departures`);
        return trains;
      }
    } catch (error) {
      console.log(`[TRAINS] PTV API failed: ${error.message}`);
    }

    // Try GTFS
    if (this.gtfsConfig.enabled) {
      try {
        console.log('[TRAINS] Attempting GTFS Realtime...');
        const trains = await this.fetchTrainsGTFS();
        if (trains && trains.length > 0) {
          console.log(`[TRAINS] ✓ GTFS SUCCESS - ${trains.length} departures`);
          return trains;
        }
      } catch (error) {
        console.log(`[TRAINS] GTFS failed: ${error.message}`);
      }
    }

    // Fallback
    console.log('[TRAINS] Using simulations');
    return this.fetchTrainsFallback();
  }

  async fetchTrainsPTV() {
    const url = `${this.ptvConfig.baseUrl}/departures/route_type/0/stop/${this.stops.southYarra}`;
    
    const response = await axios.get(url, {
      params: {
        platform_numbers: [3],
        max_results: 5,
        expand: ['run', 'route']
      },
      timeout: 5000
    });

    if (!response.data || !response.data.departures) {
      throw new Error('Invalid response');
    }

    const departures = [];
    const now = new Date();

    for (const dep of response.data.departures) {
      const scheduled = new Date(dep.scheduled_departure_utc);
      const estimated = dep.estimated_departure_utc 
        ? new Date(dep.estimated_departure_utc) 
        : scheduled;
      
      const minutes = Math.round((estimated - now) / 60000);
      
      if (minutes >= 0 && minutes <= 30) {
        const run = response.data.runs?.[dep.run_ref];
        const route = response.data.routes?.[dep.route_id];
        
        departures.push({
          destination: run?.destination_name || 'City Loop',
          platform: dep.platform_number || '3',
          minutes,
          stopsAll: !dep.flags?.includes('Express'),
          line: {
            name: route?.route_name || 'Metro',
            color: this.getLineColor(route?.route_name)
          },
          realtime: true,
          source: 'PTV-API'
        });
      }
    }

    departures.sort((a, b) => a.minutes - b.minutes);
    return departures.slice(0, 3);
  }

  async fetchTrainsGTFS() {
    const url = `${this.gtfsConfig.baseUrl}/metro/trip-updates`;
    
    const response = await axios.get(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': this.gtfsConfig.apiKey
      },
      responseType: 'arraybuffer',
      timeout: 5000
    });

    const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(response.data)
    );

    const departures = [];
    const now = Math.floor(Date.now() / 1000);

    for (const entity of feed.entity) {
      if (entity.tripUpdate && entity.tripUpdate.stopTimeUpdate) {
        for (const stopTime of entity.tripUpdate.stopTimeUpdate) {
          if (stopTime.stopId === this.stops.southYarraGTFS) {
            const depTime = stopTime.departure?.time || stopTime.arrival?.time;
            
            if (depTime) {
              const minutes = Math.round((depTime - now) / 60);
              
              if (minutes >= 0 && minutes <= 30) {
                departures.push({
                  destination: this.getTrainDestination(entity.tripUpdate.trip),
                  platform: '3',
                  minutes,
                  stopsAll: this.isStopsAll(entity.tripUpdate.trip),
                  line: this.getTrainLine(entity.tripUpdate.trip),
                  realtime: true,
                  source: 'GTFS'
                });
              }
            }
          }
        }
      }
    }

    departures.sort((a, b) => a.minutes - b.minutes);
    return departures.slice(0, 3);
  }

  fetchTrainsFallback() {
    const now = new Date();
    const isPeak = this.isPeakHour(now);
    const freq = isPeak ? 7 : 15;
    
    const departures = [];
    for (let i = 0; i < 3; i++) {
      departures.push({
        destination: i % 2 === 0 ? 'City Loop' : 'Flinders Street',
        platform: '3',
        minutes: Math.ceil(Math.random() * 3) + (i * freq) + 2,
        stopsAll: i === 0 || Math.random() > 0.3,
        line: this.getLineForTime(now, i),
        realtime: false,
        source: 'Simulation'
      });
    }
    return departures;
  }

  // ===== TRAMS =====
  
  async fetchTrams() {
    // Tier 1: TramTracker API (NO AUTH!)
    try {
      console.log('[TRAMS] Attempting TramTracker API (no auth)...');
      const trams = await this.fetchTramsTramTracker();
      if (trams && trams.length > 0) {
        console.log(`[TRAMS] ✓ TramTracker SUCCESS - ${trams.length} departures`);
        return trams;
      }
    } catch (error) {
      console.log(`[TRAMS] TramTracker failed: ${error.message}`);
    }

    // Tier 2: PTV API
    try {
      console.log('[TRAMS] Attempting PTV API (no auth)...');
      const trams = await this.fetchTramsPTV();
      if (trams && trams.length > 0) {
        console.log(`[TRAMS] ✓ PTV API SUCCESS - ${trams.length} departures`);
        return trams;
      }
    } catch (error) {
      console.log(`[TRAMS] PTV API failed: ${error.message}`);
    }

    // Tier 3: GTFS
    if (this.gtfsConfig.enabled) {
      try {
        console.log('[TRAMS] Attempting GTFS Realtime...');
        const trams = await this.fetchTramsGTFS();
        if (trams && trams.length > 0) {
          console.log(`[TRAMS] ✓ GTFS SUCCESS - ${trams.length} departures`);
          return trams;
        }
      } catch (error) {
        console.log(`[TRAMS] GTFS failed: ${error.message}`);
      }
    }

    // Tier 4: Fallback
    console.log('[TRAMS] Using simulations');
    return this.fetchTramsFallback();
  }

  async fetchTramsTramTracker() {
    // TramTracker API endpoint
    const url = `${this.tramTrackerConfig.baseUrl}/GetNextPredictionsForStop.ashx`;
    
    const response = await axios.get(url, {
      params: {
        stopNo: this.stops.tivoliRoad,
        routeNo: 58, // Route 58 only
        isLowFloor: false
      },
      timeout: 5000
    });

    if (!response.data || !response.data.predictions) {
      throw new Error('Invalid TramTracker response');
    }

    const departures = [];
    const predictions = Array.isArray(response.data.predictions) 
      ? response.data.predictions 
      : [response.data.predictions];

    for (const pred of predictions) {
      if (!pred) continue;
      
      // pred.HasArrived etc
      const minutes = Math.round(pred.minutes || 0);
      
      if (minutes >= 0 && minutes <= 30) {
        departures.push({
          route: '58',
          destination: pred.destination || 'West Coburg',
          minutes,
          realtime: true,
          source: 'TramTracker'
        });
      }
    }

    departures.sort((a, b) => a.minutes - b.minutes);
    return departures.slice(0, 3);
  }

  async fetchTramsPTV() {
    const url = `${this.ptvConfig.baseUrl}/departures/route_type/1/stop/${this.stops.tivoliRoad}`;
    
    const response = await axios.get(url, {
      params: {
        max_results: 5,
        expand: ['run', 'route']
      },
      timeout: 5000
    });

    if (!response.data || !response.data.departures) {
      throw new Error('Invalid response');
    }

    const departures = [];
    const now = new Date();

    for (const dep of response.data.departures) {
      const route = response.data.routes?.[dep.route_id];
      
      if (!route || route.route_number !== '58') {
        continue;
      }

      const scheduled = new Date(dep.scheduled_departure_utc);
      const estimated = dep.estimated_departure_utc 
        ? new Date(dep.estimated_departure_utc) 
        : scheduled;
      
      const minutes = Math.round((estimated - now) / 60000);
      
      if (minutes >= 0 && minutes <= 30) {
        const run = response.data.runs?.[dep.run_ref];
        
        departures.push({
          route: '58',
          destination: run?.destination_name || 'West Coburg',
          minutes,
          realtime: true,
          source: 'PTV-API'
        });
      }
    }

    departures.sort((a, b) => a.minutes - b.minutes);
    return departures.slice(0, 3);
  }

  async fetchTramsGTFS() {
    const url = `${this.gtfsConfig.baseUrl}/yarra-trams/trip-updates`;
    
    const response = await axios.get(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': this.gtfsConfig.apiKey
      },
      responseType: 'arraybuffer',
      timeout: 5000
    });

    const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(response.data)
    );

    const departures = [];
    const now = Math.floor(Date.now() / 1000);

    for (const entity of feed.entity) {
      if (entity.tripUpdate && entity.tripUpdate.stopTimeUpdate) {
        for (const stopTime of entity.tripUpdate.stopTimeUpdate) {
          if (stopTime.stopId === String(this.stops.tivoliRoad)) {
            const depTime = stopTime.departure?.time || stopTime.arrival?.time;
            
            if (depTime) {
              const minutes = Math.round((depTime - now) / 60);
              
              if (minutes >= 0 && minutes <= 30) {
                const routeId = entity.tripUpdate.trip.routeId || '';
                
                if (routeId.includes('58')) {
                  departures.push({
                    route: '58',
                    destination: 'West Coburg',
                    minutes,
                    realtime: true,
                    source: 'GTFS'
                  });
                }
              }
            }
          }
        }
      }
    }

    departures.sort((a, b) => a.minutes - b.minutes);
    return departures.slice(0, 3);
  }

  fetchTramsFallback() {
    const now = new Date();
    const isPeak = this.isPeakHour(now);
    const freq = isPeak ? 11 : 17;
    
    const departures = [];
    for (let i = 0; i < 3; i++) {
      departures.push({
        route: '58',
        destination: 'West Coburg',
        minutes: Math.ceil(Math.random() * 2) + (i * freq) + 1,
        realtime: false,
        source: 'Simulation'
      });
    }
    return departures;
  }

  // ===== WEATHER =====
  
  async fetchWeather() {
    return this.getRealisticMelbourneWeather();
  }

  getRealisticMelbourneWeather() {
    const now = new Date();
    const month = now.getMonth();
    const hour = now.getHours();
    
    let tempRange, conditions;
    
    if (month >= 11 || month <= 1) {
      tempRange = { min: 18, max: 28 };
      conditions = [
        { condition: 'Sunny', icon: '☀️', weight: 50 },
        { condition: 'Partly Cloudy', icon: '⛅', weight: 30 },
        { condition: 'Cloudy', icon: '☁️', weight: 15 },
        { condition: 'Light Rain', icon: '🌦️', weight: 5 }
      ];
    } else if (month >= 2 && month <= 4) {
      tempRange = { min: 14, max: 20 };
      conditions = [
        { condition: 'Partly Cloudy', icon: '⛅', weight: 35 },
        { condition: 'Cloudy', icon: '☁️', weight: 30 },
        { condition: 'Sunny', icon: '☀️', weight: 20 },
        { condition: 'Light Rain', icon: '🌦️', weight: 15 }
      ];
    } else if (month >= 5 && month <= 7) {
      tempRange = { min: 10, max: 14 };
      conditions = [
        { condition: 'Cloudy', icon: '☁️', weight: 40 },
        { condition: 'Light Rain', icon: '🌦️', weight: 30 },
        { condition: 'Partly Cloudy', icon: '⛅', weight: 20 },
        { condition: 'Sunny', icon: '☀️', weight: 10 }
      ];
    } else {
      tempRange = { min: 14, max: 21 };
      conditions = [
        { condition: 'Partly Cloudy', icon: '⛅', weight: 35 },
        { condition: 'Sunny', icon: '☀️', weight: 25 },
        { condition: 'Cloudy', icon: '☁️', weight: 25 },
        { condition: 'Light Rain', icon: '🌦️', weight: 15 }
      ];
    }
    
    const dayMultiplier = Math.sin(((hour - 6) / 12) * Math.PI);
    const temp = Math.round(tempRange.min + ((tempRange.max - tempRange.min) * Math.max(0, dayMultiplier)));
    
    const random = Math.random() * 100;
    let cumulative = 0;
    let selected = conditions[0];
    
    for (const cond of conditions) {
      cumulative += cond.weight;
      if (random <= cumulative) {
        selected = cond;
        break;
      }
    }
    
    return {
      temp,
      condition: selected.condition,
      icon: selected.icon
    };
  }

  // ===== NEWS =====
  
  async fetchNews() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    if (hour >= 7 && hour < 9) {
      return 'Morning peak - allow extra travel time';
    } else if (hour >= 17 && hour < 19) {
      return 'Evening peak - trains and trams busy';
    } else if (day === 0 || day === 6) {
      return 'Weekend services - check timetables';
    }
    
    const messages = [
      'Melbourne PT operating normally',
      'Check your myki balance before boarding',
      'Remember to tap on and off'
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
  }

  async fetchDisruptions() {
    return null;
  }

  // ===== HELPERS =====
  
  getLineColor(routeName) {
    if (!routeName) return '#279FD5';
    
    const name = routeName.toLowerCase();
    if (name.includes('cranbourne') || name.includes('pakenham')) return '#279FD5';
    if (name.includes('frankston')) return '#028430';
    if (name.includes('sandringham')) return '#F178AF';
    if (name.includes('glen waverley')) return '#0072CE';
    
    return '#279FD5';
  }

  getTrainDestination(trip) {
    const routeId = trip.routeId || '';
    if (routeId.includes('City') || routeId.includes('Loop')) return 'City Loop';
    if (routeId.includes('Flinders')) return 'Flinders Street';
    return 'City Loop';
  }

  isStopsAll(trip) {
    const tripId = trip.tripId || '';
    return !tripId.includes('Express') && !tripId.includes('Limited');
  }

  getTrainLine(trip) {
    const routeId = trip.routeId || '';
    
    if (routeId.includes('Cranbourne')) return { name: 'Cranbourne', color: '#279FD5' };
    if (routeId.includes('Pakenham')) return { name: 'Pakenham', color: '#279FD5' };
    if (routeId.includes('Frankston')) return { name: 'Frankston', color: '#028430' };
    if (routeId.includes('Sandringham')) return { name: 'Sandringham', color: '#F178AF' };

    return { name: 'Cranbourne', color: '#279FD5' };
  }

  isPeakHour(date) {
    const hour = date.getHours();
    const day = date.getDay();
    
    if (day >= 1 && day <= 5) {
      return (hour >= 7 && hour < 9) || (hour >= 17 && hour < 19);
    }
    
    return false;
  }

  getLineForTime(date, index) {
    const lines = [
      { name: 'Cranbourne', color: '#279FD5' },
      { name: 'Pakenham', color: '#279FD5' },
      { name: 'Frankston', color: '#028430' },
      { name: 'Sandringham', color: '#F178AF' }
    ];
    
    return lines[index % lines.length];
  }

  getPlaceholderData() {
    return {
      trains: [
        { destination: 'City Loop', platform: '3', minutes: 5, stopsAll: true, line: { name: 'Cranbourne', color: '#279FD5' }, realtime: false, source: 'Placeholder' },
        { destination: 'Flinders Street', platform: '3', minutes: 12, stopsAll: false, line: { name: 'Pakenham', color: '#279FD5' }, realtime: false, source: 'Placeholder' },
        { destination: 'City Loop', platform: '3', minutes: 19, stopsAll: true, line: { name: 'Frankston', color: '#028430' }, realtime: false, source: 'Placeholder' }
      ],
      trams: [
        { route: '58', destination: 'West Coburg', minutes: 4, realtime: false, source: 'Placeholder' },
        { route: '58', destination: 'West Coburg', minutes: 15, realtime: false, source: 'Placeholder' },
        { route: '58', destination: 'West Coburg', minutes: 26, realtime: false, source: 'Placeholder' }
      ],
      weather: { temp: 18, condition: 'Cloudy', icon: '☁️' },
      news: 'Service operating normally',
      disruptions: null,
      lastUpdate: Date.now()
    };
  }
}

module.exports = DataScraper;
