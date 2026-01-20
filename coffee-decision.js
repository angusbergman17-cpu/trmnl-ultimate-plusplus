class CoffeeDecision {
  constructor() {
    this.commute = {
      walkToWork: 6,   // Parliament -> 80 Collins
      homeToNorman: 4, 
      makeCoffee: 6,   
      normanToTram: 1, 
      tramRide: 5,     
      platformChange: 3,
      trainRide: 9     
    };
  }

  getMelbourneTime() {
    const now = new Date();
    return new Date(now.getTime() + (11 * 60 * 60 * 1000));
  }

  isDisrupted(newsText) {
    if (!newsText) return false;
    const badWords = ['Major Delays', 'Suspended', 'Buses replace', 'Cancellation'];
    return badWords.some(word => newsText.includes(word));
  }

  calculate(nextTrainMin, tramData, newsText) {
    const now = this.getMelbourneTime();
    const day = now.getUTCDay(); // 0=Sun, 6=Sat
    const currentHour = now.getUTCHours();
    const currentMin = now.getUTCMinutes();
    const currentTimeInMins = currentHour * 60 + currentMin;

    // 1. INTERRUPTION
    if (this.isDisrupted(newsText)) {
        return { decision: "SKIP COFFEE", subtext: "Network Alert! Go direct.", canGet: false, urgent: true };
    }

    // 2. WEEKEND MODE
    if (day === 0 || day === 6) {
        if (nextTrainMin > 15) return { decision: "WEEKEND VIBES", subtext: `Next train in ${nextTrainMin}m`, canGet: true, urgent: false };
        return { decision: "CATCH TRAIN", subtext: `Train departing in ${nextTrainMin}m`, canGet: true, urgent: false };
    }

    // 3. AFTER 9 AM (Standard)
    if (currentHour >= 9) {
        if (nextTrainMin > 15) return { decision: "GET COFFEE", subtext: `Next train in ${nextTrainMin}m`, canGet: true, urgent: false };
        return { decision: "RUSH IT", subtext: "Train is approaching", canGet: false, urgent: true };
    }

    // 4. BEFORE 9 AM (80 Collins Commute)
    const target9am = 9 * 60; // 540 mins
    
    const tripDirect = 4 + 5 + 3 + 9 + this.commute.walkToWork; // ~27 mins
    const tripWithCoffee = tripDirect + this.commute.makeCoffee + 1; // ~34 mins

    const minsUntil9am = target9am - currentTimeInMins;

    if (minsUntil9am < tripDirect) {
        return { 
            decision: "LATE FOR WORK", 
            subtext: `Only ${minsUntil9am}m to 9am! (Need ${tripDirect}m)`, 
            canGet: false, urgent: true 
        };
    }

    if (minsUntil9am < tripWithCoffee) {
        return { 
            decision: "SKIP COFFEE", 
            subtext: `Need ${tripWithCoffee}m. Have ${minsUntil9am}m.`, 
            canGet: false, urgent: true
        };
    }

    const coffeeReadyTime = this.commute.homeToNorman + this.commute.makeCoffee;
    const bestTram = tramData ? tramData.find(t => t.minutes >= coffeeReadyTime) : null;

    if (bestTram) {
         return { 
            decision: "GET COFFEE", 
            subtext: `Tram in ${bestTram.minutes}m -> 80 Collins by 9am`, 
            canGet: true, urgent: false
        };
    } else {
        return { 
            decision: "GET COFFEE", 
            subtext: `${minsUntil9am}m buffer before 9am meeting`, 
            canGet: true, urgent: false
        };
    }
  }
}

module.exports = CoffeeDecision;