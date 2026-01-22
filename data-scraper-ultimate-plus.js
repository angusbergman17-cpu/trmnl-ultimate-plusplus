const axios = require('axios');
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
    
    // Melbourne coordinates
    this.melbourneLat = -37.8136;
    this.melbourneLon = 144.9631;
    
    // Your commute config
    this.config = {
      trainStation: 'South Yarra',
      trainDestination: 'Parliament',
      trainLine: 'Pakenham/Cranbourne',
      tramStop: 'Tivoli Road/Toorak Road',
      tramStopId: 3122, // Stop ID for Tivoli Road
      tramRoute: 58
    };
  }

  async fetchAllData() {
    console.log('♻️  Refreshing Data...');
    
    const [trains, trams, weather, news, disruptions] = await Promise.all([
      this.fetchTrains(),
      this.fetchTrams(),
      this.fetchWeather(),
      this.fetchNews(),
      this.fetchDisruptions()
    ]);
    
    const coffeeDecision = this.calculateCoffeeDecision(trains, trams);
    
    return {
      trains,
      trams,
      weather,
      news,
      disruptions,
      coffeeDecision,
      lastUpdated: new Date().toISOString()
    };
  }

  // ========== TRAINS (via GTFS API) ==========
  async fetchTrains() {
    if (!this.keys.gtfsKey) {
      console.log('⚠️  No GTFS API key - using simulated train data');
      return this.simulateTrains();
    }

    try {
      console.log('⚡ Fetching train departures from GTFS API...');
      
      // Use the PTV GTFS-R API to get real-time departures
      const response = await axios.get(
        'https://data-exchange-api.vicroads.vic.gov.au/opendata/gtfs/v1/metrotrain/departures',
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.keys.gtfsKey
          },
          timeout: 10000
        }
      );

      if (response.data && response.data.departures) {
        const departures = response.data.departures
          .filter(d => 
            d.stop_name?.toLowerCase().includes('south yarra') &&
            d.direction?.toLowerCase().includes('city')
          )
          .slice(0, 5)
          .map(d => ({
            line: d.route_name || 'Metro',
            destination: d.headsign || 'City',
            departureTime: d.departure_time,
            minutesAway: this.getMinutesAway(d.departure_time),
            platform: d.platform || '3',
            status: d.delay ? 'Delayed' : 'On Time',
            isExpress: d.stop_pattern === 'express'
          }));

        if (departures.length > 0) {
          console.log(`✅ Found ${departures.length} train departures from GTFS`);
          return departures;
        }
      }

      // Fallback to simulation if API returns no relevant data
      console.log('⚠️  GTFS returned no South Yarra departures - using simulation');
      return this.simulateTrains();

    } catch (e) {
      console.error('❌ GTFS Train fetch failed:', e.message);
      if (e.response) {
        console.error('   Status:', e.response.status);
        console.error('   Status Text:', e.response.statusText);
      }
      return this.simulateTrains();
    }
  }

  // ========== TRAMS (via TramTracker) ==========
  async fetchTrams() {
    try {
      console.log('🚃 Fetching tram departures from TramTracker...');
      
      // TramTracker API - no auth required
      const response = await axios.get(
        `http://yarratrams.com.au/base/tramTracker/Controller/GetNextPredictionsForStop.ashx`,
        {
          params: {
            stopNo: this.config.tramStopId,
            lowFloor: false,
            routeNo: this.config.tramRoute
          },
          timeout: 8000
        }
      );

      if (response.data && response.data.responseObject) {
        const trams = response.data.responseObject
          .slice(0, 4)
          .map(t => ({
            route: t.RouteNo || '58',
            destination: t.Destination || 'Toorak',
            minutesAway: t.PredictedArrivalInMinutes || t.InternalRouteNo,
            lowFloor: t.IsLowFloor,
            airCon: t.HasAirConditioning
          }));

        if (trams.length > 0) {
          console.log(`✅ Found ${trams.length} tram departures from TramTracker`);
          return trams;
        }
      }

      console.log('⚠️  TramTracker returned no data - using simulation');
      return this.simulateTrams();

    } catch (e) {
      console.error('❌ TramTracker fetch failed:', e.message);
      return this.simulateTrams();
    }
  }

  // ========== WEATHER ==========
  async fetchWeather() {
    if (!this.keys.weather) {
      return this.simulateWeather();
    }

    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather`,
        {
          params: {
            lat: this.melbourneLat,
            lon: this.melbourneLon,
            appid: this.keys.weather,
            units: 'metric'
          },
          timeout: 5000
        }
      );

      const data = response.data;
      return {
        temp: Math.round(data.main.temp),
        condition: data.weather[0].main,
        description: data.weather[0].description,
        icon: this.getWeatherIcon(data.weather[0].icon)
      };

    } catch (e) {
      console.error('❌ Weather fetch failed:', e.message);
      return this.simulateWeather();
    }
  }

  // ========== NEWS (ABC RSS) ==========
  async fetchNews() {
    try {
      const feed = await this.parser.parseURL('https://www.abc.net.au/news/feed/2942460/rss.xml');
      return feed.items.slice(0, 3).map(item => ({
        title: item.title,
        link: item.link
      }));
    } catch (e) {
      console.error('❌ News fetch failed:', e.message);
      return [{ title: 'News unavailable', link: '' }];
    }
  }

  // ========== DISRUPTIONS ==========
  async fetchDisruptions() {
    try {
      // Try PTV disruptions endpoint
      const response = await axios.get(
        'https://www.ptv.vic.gov.au/api/general/disruptions',
        { timeout: 5000 }
      );
      
      if (response.data && response.data.disruptions) {
        const trainDisruptions = response.data.disruptions.metro || [];
        const tramDisruptions = response.data.disruptions.tram || [];
        
        return [...trainDisruptions, ...tramDisruptions]
          .slice(0, 3)
          .map(d => ({
            title: d.title || 'Service Alert',
            description: d.description || '',
            type: d.disruption_type || 'general'
          }));
      }
      return [];
    } catch (e) {
      // No disruptions or API unavailable
      return [];
    }
  }

  // ========== COFFEE DECISION ==========
  calculateCoffeeDecision(trains, trams) {
    const nextTrain = trains[0];
    const nextTram = trams[0];
    
    if (!nextTrain || !nextTram) {
      return { canGetCoffee: false, reason: 'Missing data' };
    }

    const tramMins = nextTram.minutesAway || 5;
    const trainMins = nextTrain.minutesAway || 10;
    
    // Time math: tram to station (4 min) + buffer (2 min)
    const totalTimeNeeded = tramMins + 4 + 2;
    const coffeeTime = 3; // minutes to grab coffee
    
    if (trainMins > totalTimeNeeded + coffeeTime) {
      return { 
        canGetCoffee: true, 
        reason: `${trainMins - totalTimeNeeded} min buffer`,
        emoji: '☕'
      };
    } else {
      return { 
        canGetCoffee: false, 
        reason: 'Too tight!',
        emoji: '🏃'
      };
    }
  }

  // ========== SIMULATION FALLBACKS ==========
  simulateTrains() {
    console.log('🎭 Using simulated train data');
    const now = new Date();
    const baseMinutes = 3 + Math.floor(Math.random() * 4);
    
    return [
      { line: 'Pakenham', destination: 'Flinders St', minutesAway: baseMinutes, platform: '3', status: 'On Time', isExpress: false },
      { line: 'Cranbourne', destination: 'Flinders St', minutesAway: baseMinutes + 8, platform: '3', status: 'On Time', isExpress: true },
      { line: 'Pakenham', destination: 'Flinders St', minutesAway: baseMinutes + 18, platform: '3', status: 'On Time', isExpress: false }
    ];
  }

  simulateTrams() {
    console.log('🎭 Using simulated tram data');
    const baseMinutes = 2 + Math.floor(Math.random() * 5);
    
    return [
      { route: '58', destination: 'Toorak', minutesAway: baseMinutes, lowFloor: true },
      { route: '58', destination: 'Toorak', minutesAway: baseMinutes + 12, lowFloor: false },
      { route: '58', destination: 'Toorak', minutesAway: baseMinutes + 24, lowFloor: true }
    ];
  }

  simulateWeather() {
    const hour = new Date().getHours();
    const isSummer = [11, 12, 1, 2].includes(new Date().getMonth() + 1);
    const baseTemp = isSummer ? 24 : 14;
    
    return {
      temp: baseTemp + Math.floor(Math.random() * 8),
      condition: isSummer ? 'Clear' : 'Partly Cloudy',
      description: isSummer ? 'Sunny' : 'Mild',
      icon: '☀️'
    };
  }

  // ========== HELPERS ==========
  getMinutesAway(departureTime) {
    if (!departureTime) return 10;
    const now = new Date();
    const departure = new Date(departureTime);
    return Math.max(0, Math.round((departure - now) / 60000));
  }

  getWeatherIcon(iconCode) {
    const icons = {
      '01d': '☀️', '01n': '🌙',
      '02d': '⛅', '02n': '☁️',
      '03d': '☁️', '03n': '☁️',
      '04d': '☁️', '04n': '☁️',
      '09d': '🌧️', '09n': '🌧️',
      '10d': '🌦️', '10n': '🌧️',
      '11d': '⛈️', '11n': '⛈️',
      '13d': '❄️', '13n': '❄️',
      '50d': '🌫️', '50n': '🌫️'
    };
    return icons[iconCode] || '☀️';
  }
}

module.exports = DataScraper;
