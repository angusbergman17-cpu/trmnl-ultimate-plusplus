/**
 * Coffee Decision Calculator
 * Determines if there's time to get coffee before 9am arrival
 */

class CoffeeDecision {
  constructor() {
    // Journey timings in minutes
    this.timing = {
      targetArrival: 9 * 60,    // 9:00 AM
      walkToNorman: 3,
      coffeeQueue: 5,
      walkToTram: 2,
      tramRide: 8,
      platformTransfer: 3,
      trainRide: 6,
      walkToOffice: 5,
      safetyBuffer: 5
    };

    this.totalTime = Object.values(this.timing).reduce((a, b) => a + b, 0) - this.timing.targetArrival;
  }

  // Calculate current decision
  calculate(nextTramMinutes = 10) {
    const now = new Date();
    // Adjust for Melbourne time if server is UTC (simplified for now)
    // Ideally use timezone aware libraries, but for simple logic:
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Latest time to leave home
    const latestDeparture = this.timing.targetArrival - this.totalTime;
    const timeToSpare = latestDeparture - currentMinutes;

    // Decision logic
    let decision, status, color;
    
    if (timeToSpare < 0) {
      decision = 'NO TIME';
      status = 'late';
      color = '#000000'; // Black
    } else if (timeToSpare < 5) {
      decision = 'TOO TIGHT';
      status = 'critical';
      color = '#000000'; // Black (high contrast)
    } else if (timeToSpare < 10) {
      decision = 'RUSH IT';
      status = 'tight';
      color = '#666666'; // Dark gray
    } else {
      decision = 'GET COFFEE';
      status = 'yes';
      color = '#CCCCCC'; // Light gray
    }

    return {
      decision,
      status,
      color,
      timeToSpare,
      nextTram: nextTramMinutes
    };
  }
}

module.exports = CoffeeDecision;