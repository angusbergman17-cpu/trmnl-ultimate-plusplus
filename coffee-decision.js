/**
 * COFFEE DECISION ENGINE (Safe Mode)
 */

class CoffeeDecision {
  constructor() {
    this.shop = {
      name: "Norman",
      walkTimeOneWay: 4, 
      makeTime: 3,       
      hours: {
        mon_sat: { open: 7, close: 16 }, 
        sun:     { open: 8, close: 16 }  
      }
    };
  }

  // Safe Melbourne Time (Manual UTC+11 Calculation)
  getMelbourneTime() {
    const now = new Date();
    // UTC time + 11 hours (for DST)
    return new Date(now.getTime() + (11 * 60 * 60 * 1000));
  }

  isOpen(now) {
    // getDay() returns 0-6 relative to the DATE object we just shifted
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

    if ((day === 0 || day === 6) && hour >= 9 && hour < 12) return { status: 'Very Busy', queue: 15 };
    if (day >= 1 && day <= 5 && (hour === 8 || (hour === 9 && now.getUTCMinutes() < 30))) {
        return { status: 'Busy', queue: 10 };
    }
    return { status: 'Quiet', queue: 5 };
  }

  calculate(minutesUntilTrain) {
    try {
        const now = this.getMelbourneTime();

        // 1. Check if Closed
        if (!this.isOpen(now)) {
            return {
                decision: "NORMAN IS CLOSED",
                subtext: "Opens tomorrow morning",
                canGet: false
            };
        }

        // 2. Calculate Trip
        const busyness = this.getBusyness(now);
        const totalTrip = (this.shop.walkTimeOneWay * 2) + this.shop.makeTime + busyness.queue;
        const spareTime = minutesUntilTrain - totalTrip;

        // 3. Decision
        let decision, subtext;
        if (spareTime >= 5) {
            decision = "GET A COFFEE";
            subtext = `Norman is ${busyness.status} (${busyness.queue}m wait)`;
        } else if (spareTime >= 0) {
            decision = "RUSH IT";
            subtext = "It will be tight!";
        } else {
            decision = "NO TIME";
            subtext = `${totalTrip} mins needed`;
        }

        return { decision, subtext, canGet: spareTime >= 0 };
    } catch (e) {
        // Fallback if anything fails
        return { decision: "COFFEE?", subtext: "Check status manually", canGet: false };
    }
  }
}

module.exports = CoffeeDecision;
