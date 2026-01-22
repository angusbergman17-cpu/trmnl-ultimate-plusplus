/**
 * TRMNL Melbourne PT - Configuration
 * 
 * Edit these values to customize your display!
 * Changes take effect on next refresh (no need to redeploy)
 */

module.exports = {
  // ===== DISPLAY SETTINGS =====
  display: {
    width: 800,
    height: 480,
    
    // Grayscale levels for e-ink (0 = white, 15 = black)
    grayscale: {
      background: 15,      // Black background
      text: 0,             // White text
      accent: 7,           // Mid-gray for accents
      dimmed: 10           // Slightly dimmed text
    }
  },

  // ===== COLOR SCHEME =====
  // Metro/TramTracker colors mapped to grayscale
  colors: {
    // Metro train lines (RGB → Grayscale)
    metroBlueLine: '#5A5A5A',     // Pakenham/Cranbourne
    frankston: '#6E6E6E',          // Frankston line
    sandringham: '#808080',        // Sandringham line
    glenWaverley: '#5A5A5A',       // Glen Waverley line
    
    // Tram routes
    yarraGreen: '#6E6E6E',         // Route 58
    
    // Coffee decision colors
    coffeeGo: '#CCCCCC',           // Light gray (GET COFFEE)
    coffeeHurry: '#999999',        // Medium gray (RUSH IT)
    coffeeNo: '#666666',           // Dark gray (NO TIME)
    coffeeText: '#000000'          // Black text
  },

  // ===== LAYOUT SECTIONS =====
  layout: {
    topBar: {
      height: 80,
      showTime: true,
      showCoffeeDecision: true,
      timePosition: 'left',     // left, center, right
      coffeePadding: 20
    },
    
    tramsSection: {
      height: 140,
      showRouteNumber: true,
      showDestination: true,
      maxDepartures: 3
    },
    
    trainsSection: {
      height: 140,
      showPlatform: true,
      showStopsAll: true,
      maxDepartures: 3
    },
    
    bottomBar: {
      height: 120,
      showWeather: true,
      showNews: true,
      showDisruptions: true
    }
  },

  // ===== TYPOGRAPHY =====
  fonts: {
    // Main display font
    main: 'Arial',
    
    // Font sizes
    sizes: {
      title: 28,           // Section headers
      time: 56,            // Current time
      destination: 24,     // Train/tram destinations
      minutes: 36,         // Time until departure
      platform: 20,        // Platform numbers
      weather: 22,         // Weather info
      news: 18,            // News ticker
      small: 16            // Small labels
    },
    
    // Font weights
    weights: {
      light: 'normal',
      regular: 'normal',
      bold: 'bold'
    }
  },

  // ===== TEXT LABELS =====
  labels: {
    // Section headers
    trainsHeader: 'TRAINS - SOUTH YARRA',
    tramsHeader: 'TRAMS - ROUTE 58 FROM TIVOLI RD',
    
    // Status indicators
    stopsAll: 'STOPS ALL',
    express: 'EXPRESS',
    
    // Coffee decision
    coffeeGo: 'GET COFFEE',
    coffeeHurry: 'RUSH IT!',
    coffeeNo: 'NO TIME',
    
    // Time formats
    timeFormat: '12h',    // 12h or 24h
    showSeconds: false
  },

  // ===== BEHAVIOR =====
  behavior: {
    // Refresh intervals (milliseconds)
    partialRefresh: 20000,   // 20 seconds
    fullRefresh: 300000,     // 5 minutes
    
    // Data display
    showDataSource: true,     // Show "PTV-API", "GTFS", etc
    showLastUpdate: false,    // Show last update time
    
    // Coffee decision
    coffeeArrivalTime: '09:00',  // Target arrival at 80 Collins
    coffeeWalkTime: 10,          // Minutes to walk from station
    coffeeShopTime: 5            // Minutes to get coffee
  },

  // ===== STOP CONFIGURATION =====
  stops: {
    // Train stop
    train: {
      name: 'South Yarra',
      stopId: 1120,           // PTV stop ID
      platform: 5,             // Platform number
      gtfsStopId: '19946'     // GTFS stop ID
    },
    
    // Tram stop
    tram: {
      name: 'Tivoli Road',
      stopId: 2189,           // TramTracker ID
      route: 58,               // Route number
      direction: 'West Coburg'
    },
    
    // Destination for coffee decision
    destination: {
      name: '80 Collins St',
      walkTime: 10            // Minutes from train station
    }
  },

  // ===== DATA SOURCES =====
  dataSources: {
    // Priority order for trains
    trainsPriority: ['PTV', 'GTFS', 'Simulation'],
    
    // Priority order for trams
    tramsPriority: ['TramTracker', 'PTV', 'GTFS', 'Simulation'],
    
    // API endpoints (don't change unless you know what you're doing)
    tramTrackerUrl: 'https://www.tramtracker.com.au/Controllers',
    ptvUrl: 'https://timetableapi.ptv.vic.gov.au/v3',
    gtfsUrl: 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1'
  },

  // ===== DEBUG =====
  debug: {
    showBoundingBoxes: false,   // Show layout boxes
    verboseLogging: true,        // Log data source attempts
    simulateDataSource: null     // Force a data source: 'PTV', 'GTFS', 'Simulation'
  }
};
