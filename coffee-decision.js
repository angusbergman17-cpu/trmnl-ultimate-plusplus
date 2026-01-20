/**
 * COFFEE DECISION ENGINE (The "Norman -> Tram -> Train" Chain)
 * * LOGIC FLOW:
 * 1. Walk to Norman (4 mins)
 * 2. Queue & Make Coffee (Variable based on time)
 * 3. Walk to Tram Stop (1 min)
 * 4. WAIT for the specific Tram (Real-time data)
 * 5. Ride Tram to Station (3 mins)
 * 6. Walk to Platform (2 mins)
 * 7. CATCH THE TRAIN
 */

class CoffeeDecision {
  constructor() {
    this.shop = {
      name: "Norman",
      walkTo: 4,      // Station -> Norman
      walkToTram: 1,  // Norman -> Tram Stop
      rideTime: 3,    // Tram Ride to Station
      platformWalk: 2,// Tram Stop -> Train Platform
      hours: {
        mon_sat: { open: 7, close: 16 }, 
        sun:     { open: 8, close: 16 }  
      }
    };
  }

  // Safe Melbourne Time
  getMelbourneTime() {
    const now = new Date();
    return new Date(now.getTime() + (11 * 60 * 60 * 1000));
  }

  isOpen(now) {
    const day = now.getUTCDay(); 
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const timeFloat = hour + (minute / 60);

    const rules = (day === 0) ? this.shop.hours.sun : this.shop.hours.mon_sat;
    return timeFloat >= rules.open && timeFloat < (rules.close - 0.25);
  }

  getBusyness(now) {
    const day = now.getUTCDay();
    const hour = now.getUTCHours();

    // Weekend Brunch Rush (9am - 12pm)
    if ((day === 0 || day === 6) && hour >= 9 && hour < 12) return { status: 'Slammed', makeTime: 12 };
    // Weekday Morning Rush (8am - 9am)
    if (day >= 1 && day <= 5 && hour === 8) return { status: 'Busy', makeTime: 8 };
    // Standard
    return { status: 'Quiet', makeTime: 5 };
  }

  /**
   * THE CALCULATION
   * @param {number} trainMinutes - Minutes until train departs
   * @param {Array} tramData - Live array of upcoming trams [{minutes: 4}, {minutes: 12}...]
   */
  calculate(trainMinutes, tramData = []) {
    const now = this.getMelbourneTime();

    // 1. IS NORMAN OPEN?
    if (!this.isOpen(now)) {
        return { decision: "NORMAN CLOSED", subtext: "Opens tomorrow", canGet: false };
    }

    // 2. COFFEE LOGISTICS
    const busyness = this.getBusyness(now);
    const timeToGetCoffee = this.shop.walkTo + busyness.makeTime + this.shop.walkToTram; 
    // Example: 4 (walk) + 5 (make) + 1 (stop) = 10 mins until ready at tram stop

    // 3. FIND THE MAGIC TRAM
    // We need a tram that arrives *after* we finish getting coffee
    const usableTram = tramData.find(t => t.minutes >= timeToGetCoffee);

    if (!usableTram) {
        // No tram fits the schedule? Fallback to walking back (4 mins)
        const walkBackTotal = timeToGetCoffee + 4; // 14 mins total
        if (trainMinutes > walkBackTotal + 1) {
             return { decision: "WALK IT", subtext: "No tram matches, walk back", canGet: true };
        }
        return { decision: "NO CONNECTION", subtext: "Coffee ready @ " + timeToGetCoffee + "m (Misses Trams)", canGet: false };
    }

    // 4. CALCULATE TOTAL JOURNEY via TRAM
    // [Wait for Tram] + [Ride] + [Platform Walk]
    const arrivalAtPlatform = usableTram.minutes + this.shop.rideTime + this.shop.platformWalk;

    // 5. THE VERDICT
    const slack = trainMinutes - arrivalAtPlatform;

    if (slack >= 2) {
        return { 
            decision: "PERFECT SYNC", 
            subtext: `Get Tram in ${usableTram.minutes}m -> Train in ${trainMinutes}m`, 
            canGet: true 
        };
    } else if (slack >= 0) {
        return { 
            decision: "RUSH THE TRAM", 
            subtext: `Tram arrives ${usableTram.minutes}m. Tight connection!`, 
            canGet: true 
        };
    } else {
        return { 
            decision: "SKIP COFFEE", 
            subtext: `Coffee+Tram takes ${arrivalAtPlatform}m. Train leaves in ${trainMinutes}m`, 
            canGet: false 
        };
    }
  }
}

module.exports = CoffeeDecision;
