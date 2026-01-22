class PIDSRenderer {
  constructor() {
    this.width = 800;
    this.height = 480;
  }

  render(data) {
    const { trains, trams, weather, coffeeDecision, disruptions, lastUpdated } = data;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true,
      timeZone: 'Australia/Melbourne'
    });
    const dateStr = now.toLocaleDateString('en-AU', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      timeZone: 'Australia/Melbourne'
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${this.width}px;
      height: ${this.height}px;
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      background: #fff;
      color: #000;
      overflow: hidden;
    }
    .container {
      display: flex;
      height: 100%;
    }
    .left-col {
      width: 65%;
      padding: 16px;
      border-right: 2px solid #000;
    }
    .right-col {
      width: 35%;
      padding: 16px;
      display: flex;
      flex-direction: column;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #000;
    }
    .time-block {
      font-size: 32px;
      font-weight: 700;
    }
    .date-block {
      font-size: 14px;
      color: #666;
    }
    .weather-block {
      text-align: right;
    }
    .weather-temp {
      font-size: 28px;
      font-weight: 700;
    }
    .weather-desc {
      font-size: 12px;
      color: #666;
    }
    
    /* Section headers */
    .section-header {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      margin: 12px 0 6px 0;
    }
    
    /* Departure rows */
    .departure-row {
      display: flex;
      align-items: center;
      padding: 6px 0;
      border-bottom: 1px solid #ddd;
    }
    .departure-row:last-child {
      border-bottom: none;
    }
    .dep-time {
      width: 50px;
      font-size: 22px;
      font-weight: 700;
    }
    .dep-time-unit {
      font-size: 12px;
      font-weight: 400;
    }
    .dep-details {
      flex: 1;
      padding-left: 10px;
    }
    .dep-line {
      font-size: 14px;
      font-weight: 600;
    }
    .dep-dest {
      font-size: 11px;
      color: #666;
    }
    .dep-status {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .status-ontime {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .status-delayed {
      background: #ffebee;
      color: #c62828;
    }
    .status-express {
      background: #e3f2fd;
      color: #1565c0;
    }
    
    /* Coffee decision */
    .coffee-box {
      background: #f5f5f5;
      border: 2px solid #000;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      margin-bottom: 16px;
    }
    .coffee-emoji {
      font-size: 36px;
    }
    .coffee-verdict {
      font-size: 18px;
      font-weight: 700;
      margin: 4px 0;
    }
    .coffee-reason {
      font-size: 11px;
      color: #666;
    }
    
    /* Route+ panel */
    .route-panel {
      flex: 1;
      background: #fafafa;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 10px;
    }
    .route-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .route-step {
      display: flex;
      align-items: center;
      padding: 4px 0;
      font-size: 12px;
    }
    .route-icon {
      width: 24px;
      text-align: center;
      margin-right: 8px;
    }
    .route-time {
      margin-left: auto;
      font-weight: 600;
    }
    
    /* Disruptions */
    .disruption-bar {
      background: #fff3e0;
      border-left: 3px solid #ff9800;
      padding: 4px 8px;
      font-size: 10px;
      margin-top: 8px;
    }
    
    /* Footer */
    .footer {
      font-size: 9px;
      color: #999;
      text-align: center;
      margin-top: auto;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="left-col">
      <!-- Header -->
      <div class="header">
        <div>
          <div class="time-block">${timeStr}</div>
          <div class="date-block">${dateStr}</div>
        </div>
        <div class="weather-block">
          <div class="weather-temp">${weather?.icon || '☀️'} ${weather?.temp || '--'}°</div>
          <div class="weather-desc">${weather?.condition || 'Melbourne'}</div>
        </div>
      </div>

      <!-- Trams -->
      <div class="section-header">🚃 Tram 58 — Tivoli Rd</div>
      ${this.renderTrams(trams)}

      <!-- Trains -->
      <div class="section-header">🚆 Trains — South Yarra → Parliament</div>
      ${this.renderTrains(trains)}

      <!-- Disruptions -->
      ${this.renderDisruptions(disruptions)}
    </div>

    <div class="right-col">
      <!-- Coffee Decision -->
      <div class="coffee-box">
        <div class="coffee-emoji">${coffeeDecision?.emoji || '☕'}</div>
        <div class="coffee-verdict">${coffeeDecision?.canGetCoffee ? 'GRAB COFFEE' : 'SKIP IT'}</div>
        <div class="coffee-reason">${coffeeDecision?.reason || ''}</div>
      </div>

      <!-- Route+ Journey -->
      <div class="route-panel">
        <div class="route-title">🗺️ Route to 80 Collins</div>
        ${this.renderRouteSteps(trams, trains)}
      </div>

      <div class="footer">
        Last update: ${new Date(lastUpdated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Melbourne' })}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  renderTrams(trams) {
    if (!trams || trams.length === 0) {
      return '<div class="departure-row"><div class="dep-time">--</div><div class="dep-details"><div class="dep-line">No trams available</div></div></div>';
    }

    return trams.slice(0, 3).map(tram => `
      <div class="departure-row">
        <div class="dep-time">${tram.minutesAway}<span class="dep-time-unit">m</span></div>
        <div class="dep-details">
          <div class="dep-line">Route ${tram.route}</div>
          <div class="dep-dest">→ ${tram.destination}</div>
        </div>
        ${tram.lowFloor ? '<span class="dep-status status-ontime">♿</span>' : ''}
      </div>
    `).join('');
  }

  renderTrains(trains) {
    if (!trains || trains.length === 0) {
      return '<div class="departure-row"><div class="dep-time">--</div><div class="dep-details"><div class="dep-line">No trains available</div></div></div>';
    }

    return trains.slice(0, 3).map(train => `
      <div class="departure-row">
        <div class="dep-time">${train.minutesAway}<span class="dep-time-unit">m</span></div>
        <div class="dep-details">
          <div class="dep-line">${train.line}</div>
          <div class="dep-dest">→ ${train.destination} ${train.platform ? `• Plat ${train.platform}` : ''}</div>
        </div>
        <span class="dep-status ${train.isExpress ? 'status-express' : 'status-ontime'}">
          ${train.isExpress ? 'EXPRESS' : train.status}
        </span>
      </div>
    `).join('');
  }

  renderDisruptions(disruptions) {
    if (!disruptions || disruptions.length === 0) {
      return '';
    }

    return disruptions.slice(0, 2).map(d => `
      <div class="disruption-bar">⚠️ ${d.title}</div>
    `).join('');
  }

  renderRouteSteps(trams, trains) {
    const now = new Date();
    const tramMins = trams?.[0]?.minutesAway || 5;
    const trainMins = trains?.[0]?.minutesAway || 12;
    
    // Calculate journey times
    const leaveTime = new Date(now.getTime() + (tramMins - 2) * 60000);
    const boardTramTime = new Date(now.getTime() + tramMins * 60000);
    const arriveStationTime = new Date(boardTramTime.getTime() + 4 * 60000);
    const boardTrainTime = new Date(now.getTime() + trainMins * 60000);
    const arriveParliamentTime = new Date(boardTrainTime.getTime() + 6 * 60000);
    const arrive80CollinsTime = new Date(arriveParliamentTime.getTime() + 5 * 60000);

    const formatTime = (date) => date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Australia/Melbourne' });

    return `
      <div class="route-step">
        <span class="route-icon">🚶</span>
        <span>Leave home</span>
        <span class="route-time">${formatTime(leaveTime)}</span>
      </div>
      <div class="route-step">
        <span class="route-icon">🚃</span>
        <span>Board Tram 58</span>
        <span class="route-time">${formatTime(boardTramTime)}</span>
      </div>
      <div class="route-step">
        <span class="route-icon">🚆</span>
        <span>South Yarra Stn</span>
        <span class="route-time">${formatTime(boardTrainTime)}</span>
      </div>
      <div class="route-step">
        <span class="route-icon">🏛️</span>
        <span>Parliament</span>
        <span class="route-time">${formatTime(arriveParliamentTime)}</span>
      </div>
      <div class="route-step">
        <span class="route-icon">🏢</span>
        <span>80 Collins St</span>
        <span class="route-time">${formatTime(arrive80CollinsTime)}</span>
      </div>
    `;
  }
}

module.exports = PIDSRenderer;
