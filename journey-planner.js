/**
 * Intelligent Journey Planner for Melbourne PT Commute
 * 
 * Calculates optimal routes from South Yarra to 80 Collins St
 * with tram connections and coffee decisions
 */

class JourneyPlanner {
  constructor() {
    // Journey parameters
    this.home = {
      location: 'Tivoli Rd, South Yarra',
      tramStop: 2189
    };
    
    this.station = {
      name: 'South Yarra',
      platforms: {
        1: 'Frankston, Sandringham lines',
        3: 'Pakenham, Cranbourne, Frankston lines', 
        5: 'Glen Waverley line'
      },
      walkTimeFromHome: 3 // minutes via tram or direct walk
    };
    
    this.destination = {
      name: '80 Collins St',
      nearestStation: 'Parliament',
      walkFromStation: 10 // minutes
    };
    
    this.coffee = {
      shopNearStation: true,
      timeToGetCoffee: 5, // minutes
      shopLocation: 'Lobby or nearby'
    };
    
    this.targetArrival = '09:00'; // HH:MM format
    
    // Train line patterns (from GTFS route IDs and destination patterns)
    this.trainLines = {
      pakenham: {
        name: 'Pakenham',
        platforms: [3],
        stopsAtParliament: true,
        express: false,
        color: '#0075c9'
      },
      cranbourne: {
        name: 'Cranbourne',
        platforms: [3],
        stopsAtParliament: true,
        express: false,
        color: '#0075c9'
      },
      frankston: {
        name: 'Frankston',
        platforms: [1, 3],
        stopsAtParliament: true,
        express: false,
        color: '#00a651'
      },
      sandringham: {
        name: 'Sandringham',
        platforms: [1],
        stopsAtParliament: false, // Goes to Flinders St
        express: false,
        color: '#f28518'
      },
      glenWaverley: {
        name: 'Glen Waverley',
        platforms: [5],
        stopsAtParliament: true,
        express: false,
        color: '#0075c9'
      }
    };
  }

  /**
   * Identify which train line from GTFS trip/route data
   */
  identifyTrainLine(tripId, routeId, destination, platform) {
    // Route ID patterns from GTFS
    // Pakenham: typically has specific route patterns
    // Need to check actual GTFS data for precise patterns
    
    const destLower = (destination || '').toLowerCase();
    const tripLower = (tripId || '').toLowerCase();
    
    // Identify by destination
    if (destLower.includes('pakenham')) return 'pakenham';
    if (destLower.includes('cranbourne')) return 'cranbourne';
    if (destLower.includes('frankston')) return 'frankston';
    if (destLower.includes('sandringham')) return 'sandringham';
    if (destLower.includes('glen waverley') || destLower.includes('glenwaverley')) return 'glenWaverley';
    
    // Fallback: guess by platform
    if (platform === 5) return 'glenWaverley';
    if (platform === 1) return 'frankston'; // or sandringham, need more data
    if (platform === 3) return 'pakenham'; // Most common on platform 3
    
    return 'unknown';
  }

  /**
   * Calculate journey time for a specific route
   */
  calculateJourneyTime(tramDeparture, trainDeparture, includeCoffee = false) {
    const now = new Date();
    
    // Tram to station
    const tramTime = tramDeparture ? 
      (new Date(tramDeparture.exactTime) - now) / 60000 : 
      this.station.walkTimeFromHome;
    
    // Wait at station
    const trainWaitTime = trainDeparture ?
      Math.max(0, (new Date(trainDeparture.exactTime) - now) / 60000 - tramTime) :
      0;
    
    // Train to Parliament (approximately 8 minutes South Yarra to Parliament)
    const trainJourneyTime = 8;
    
    // Walk to office
    const walkToOffice = this.destination.walkFromStation;
    
    // Coffee time
    const coffeeTime = includeCoffee ? this.coffee.timeToGetCoffee : 0;
    
    const totalTime = tramTime + trainWaitTime + trainJourneyTime + walkToOffice + coffeeTime;
    const arrivalTime = new Date(now.getTime() + totalTime * 60000);
    
    return {
      totalMinutes: Math.round(totalTime),
      tramMinutes: Math.round(tramTime),
      trainWaitMinutes: Math.round(trainWaitTime),
      trainJourneyMinutes: trainJourneyTime,
      walkMinutes: walkToOffice,
      coffeeMinutes: coffeeTime,
      arrivalTime: arrivalTime,
      arrivalTimeString: this.formatTime(arrivalTime)
    };
  }

  /**
   * Find optimal journey given available services
   */
  findOptimalJourney(trains, trams, targetArrivalTime = null) {
    const now = new Date();
    const target = targetArrivalTime || this.parseTime(this.targetArrival);
    
    const journeys = [];
    
    // Consider each train
    for (const train of trains) {
      const line = this.trainLines[train.line] || {};
      
      // Skip if this line doesn't go to Parliament
      if (line.stopsAtParliament === false) continue;
      
      // Prefer Pakenham line (direct, frequent)
      const preference = train.line === 'pakenham' ? 10 : 
                        train.line === 'cranbourne' ? 9 :
                        train.line === 'frankston' ? 8 :
                        train.line === 'glenWaverley' ? 7 : 5;
      
      // Find best tram connection
      let bestTram = null;
      let bestTramScore = -Infinity;
      
      for (const tram of trams) {
        const tramArrival = new Date(tram.exactTime).getTime() + (3 * 60000); // 3 min to platform
        const trainDeparture = new Date(train.exactTime).getTime();
        const buffer = (trainDeparture - tramArrival) / 60000;
        
        // Need at least 2 minutes buffer, prefer 5-10 minutes
        if (buffer >= 2 && buffer <= 15) {
          const score = buffer >= 5 && buffer <= 10 ? 10 : 
                       buffer >= 3 && buffer <= 12 ? 8 : 5;
          if (score > bestTramScore) {
            bestTram = tram;
            bestTramScore = score;
          }
        }
      }
      
      // Calculate journey with and without coffee
      const withoutCoffee = this.calculateJourneyTime(bestTram, train, false);
      const withCoffee = this.calculateJourneyTime(bestTram, train, true);
      
      // Score based on arrival time vs target
      const arrivalDiffNoCoffee = Math.abs(target - withoutCoffee.arrivalTime) / 60000;
      const arrivalDiffWithCoffee = Math.abs(target - withCoffee.arrivalTime) / 60000;
      
      journeys.push({
        train,
        tram: bestTram,
        withoutCoffee,
        withCoffee,
        preference,
        canGetCoffee: withCoffee.arrivalTime <= target,
        arrivalScore: Math.max(0, 30 - arrivalDiffNoCoffee),
        overallScore: preference + Math.max(0, 30 - arrivalDiffNoCoffee)
      });
    }
    
    // Sort by overall score
    journeys.sort((a, b) => b.overallScore - a.overallScore);
    
    return journeys[0]; // Return best journey
  }

  /**
   * Generate coffee decision based on journey plan
   */
  generateCoffeeDecision(optimalJourney) {
    if (!optimalJourney) {
      return {
        decision: 'NO_SERVICE',
        message: 'No services available',
        color: '#666666'
      };
    }
    
    const { train, tram, withCoffee, withoutCoffee, canGetCoffee } = optimalJourney;
    const trainMins = train.minutes;
    
    if (canGetCoffee && withCoffee.arrivalTime <= this.parseTime(this.targetArrival)) {
      return {
        decision: 'GET_COFFEE',
        message: `Plenty of time! Arrive ${withCoffee.arrivalTimeString}`,
        trainMinutes: trainMins,
        tramRoute: tram ? `Tram ${tram.routeNumber}` : 'Walk',
        arrivalTime: withCoffee.arrivalTimeString,
        color: '#00ff00'
      };
    } else if (withoutCoffee.totalMinutes < 25) {
      return {
        decision: 'RUSH_COFFEE',
        message: `Quick coffee! Arrive ${withoutCoffee.arrivalTimeString}`,
        trainMinutes: trainMins,
        tramRoute: tram ? `Tram ${tram.routeNumber}` : 'Walk',
        arrivalTime: withoutCoffee.arrivalTimeString,
        color: '#ffaa00'
      };
    } else {
      return {
        decision: 'NO_COFFEE',
        message: `Skip coffee. Arrive ${withoutCoffee.arrivalTimeString}`,
        trainMinutes: trainMins,
        tramRoute: tram ? `Tram ${tram.routeNumber}` : 'Walk',
        arrivalTime: withoutCoffee.arrivalTimeString,
        color: '#ff0000'
      };
    }
  }

  formatTime(date) {
    return date.toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }

  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }
}

module.exports = JourneyPlanner;
