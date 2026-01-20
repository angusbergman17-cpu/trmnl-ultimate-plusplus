/**
 * COFFEE DECISION ENGINE (Norman South Yarra Edition)
 * Logic:
 * 1. Checks Opening Hours (Mon-Sat 7-4, Sun 8-4).
 * 2. Estimates "Busyness" based on day/time (Weekends = Busy).
 * 3. Calculates if you have time based on:
 * [Walk to Norman] + [Queue Time] + [Make Time] + [Walk to Station]
 */

class CoffeeDecision {
  constructor() {
    this.shop = {
      name: "Norman",
      walkTimeOneWay: 4, // Minutes to walk there
      makeTime: 3,       // Minutes to make the coffee
      hours: {
        mon_sat: { open: 7, close: 16 }, // 7am - 4pm
        sun:     { open: 8, close: 16 }  // 8am - 4pm
      }
    };
  }

  getMelbourneTime() {
    // Force Melbourne Timezone to avoid Server UTC issues
    const now = new Date();
    const melbourneStr = now.toLocaleString("en-US", {timeZone: "Australia/Melbourne"});
    return new Date(melbourneStr);
  }

  isOpen(now) {
    const day = now.getDay(); // 0=Sun, 1=Mon, ...
    const hour = now.getHours();
    const minute = now.getMinutes();
    const timeFloat = hour + (minute / 60);

    const rules = (day === 0) ? this.shop.hours.sun : this.shop.hours.mon_sat;
    
    // Check if open (with 15min buffer before close)
    return timeFloat >= rules.open && timeFloat < (rules.close - 0.25);
  }

  getBusyness(now) {
    const day = now.getDay();
    const hour = now.getHours();

    // Weekend Rush (Sat/Sun 9am - 12pm)
    if ((day === 0 || day === 6) && hour >= 9 && hour < 12) return { status: 'Very Busy', queue: 15 };
    
    // Morning Rush (Weekdays 8am - 9:30am)
    if (day >= 1 && day <= 5 && (hour === 8 || (hour === 9 && now.getMinutes() < 30))) {
        return { status: 'Busy', queue: 10 };
    }

    // Standard
    return { status: 'Quiet', queue: 5 };
  }

  calculate(minutesUntilTrain) {
    const now = this.getMelbourneTime();

    // 1. Check if Closed
    if (!this.isOpen(now)) {
        return {
            decision: "NORMAN IS CLOSED",
            subtext: "Opens tomorrow",
            canGet: false
        };
    }

    // 2. Calculate Total Trip Time
    const busyness = this.getBusyness(now);
    const totalTrip = (this.shop.walkTimeOneWay * 2) + this.shop.makeTime + busyness.queue;
    const spareTime = minutesUntilTrain - totalTrip;

    // 3. Make the Call
    let decision, subtext;

    if (spareTime >= 5) {
        decision = "TIME TO GET A COFFEE";
        subtext = `Norman is ${busyness.status} (${busyness.queue}m wait)`;
    } else if (spareTime >= 0) {
        decision = "RUSH IT";
        subtext = "It will be tight!";
    } else {
        decision = "NO TIME TO GET COFFEE";
        subtext = `Need ${totalTrip} mins total`;
    }

    return { decision, subtext, canGet: spareTime >= 0 };
  }
}

module.exports = CoffeeDecision;
