/**
 * Coffee Decision Calculator
 * Determines if there's time to get coffee before 9am arrival at 80 Collins
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
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Latest time to leave home
    const latestDeparture = this.timing.targetArrival - this.totalTime;
    const timeToSpare = latestDeparture - currentMinutes;

    // Decision logic
    let decision, status, color;
    
    if (timeToSpare < 0) {
      decision = 'NO TIME';
      status = 'late';
      color = '#000000'; // Black (will be dark gray on e-ink)
    } else if (timeToSpare < 5) {
      decision = 'TOO TIGHT';
      status = 'critical';
      color = '#666666'; // Dark gray
    } else if (timeToSpare < 10) {
      decision = 'RUSH IT';
      status = 'tight';
      color = '#999999'; // Medium gray
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
      nextTram: nextTramMinutes,
      latestLeave: this.formatTime(latestDeparture),
      totalJourneyTime: this.totalTime
    };
  }

  // Format minutes as HH:MM
  formatTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}

module.exports = CoffeeDecision;
