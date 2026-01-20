const sharp = require('sharp');

class PidsRenderer {
  constructor() {
    this.width = 800;
    this.height = 480;
  }

  async render(data, coffee, invert = false) {
    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Melbourne',
        hour: '2-digit', minute: '2-digit', hour12: false
    });
    const timeStr = timeFormatter.format(now);

    // LOGIC: Handle "Urgent" Coffee State (Inverted Colors)
    const boxFill = coffee.urgent ? "white" : "black";
    const textFill = coffee.urgent ? "black" : "white";
    const boxStroke = coffee.urgent ? 'stroke="black" stroke-width="4"' : '';

    const svg = `
    <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .base { font-family: sans-serif; fill: black; }
        .white { fill: white; }
        .line { stroke: black; stroke-width: 3; }
      </style>
      
      <rect width="100%" height="100%" fill="white" />

      <text x="20" y="70" font-size="60" font-weight="900" class="base">${timeStr}</text>
      
      <rect x="400" y="20" width="380" height="60" fill="${boxFill}" rx="8" ${boxStroke} />
      <text x="590" y="62" font-size="28" font-weight="bold" fill="${textFill}" text-anchor="middle">
        ${coffee.decision.toUpperCase()}
      </text>

      <rect x="20" y="110" width="800" height="35" fill="black" />
      <text x="30" y="138" font-size="24" font-weight="bold" fill="white">TRAM 58 (TO WEST COBURG)</text>

      <g transform="translate(20, 190)">
         ${this.renderList(data.trams, "NO TRAMS - CHECK SCHEDULE")}
      </g>

      <rect x="20" y="280" width="800" height="35" fill="black" />
      <text x="30" y="308" font-size="24" font-weight="bold" fill="white">TRAINS (CITY LOOP)</text>

      <g transform="translate(20, 360)">
         ${this.renderList(data.trains, "NO TRAINS - CHECK SCHEDULE")}
      </g>

      <line x1="20" y1="420" x2="780" y2="420" class="line" />
      
      <text x="20" y="460" font-size="32" font-weight="bold" class="base">
        ${data.weather.temp !== '--' ? data.weather.temp + '°' : ''} ${data.weather.icon}
      </text>
      <text x="140" y="460" font-size="24" class="base" fill="#444">
        ${data.weather.condition || ''}
      </text>

      <text x="780" y="460" font-size="20" text-anchor="end" class="base">
        ${coffee.subtext}
      </text>
    </svg>
    `;

    return await sharp(Buffer.from(svg)).png().toBuffer();
  }

  renderList(items, emptyMsg) {
    if (!items || items.length === 0) {
        return `<text x="10" y="0" font-size="28" fill="#555" font-style="italic">${emptyMsg}</text>`;
    }
    
    return items.slice(0, 2).map((item, i) => {
        const y = i * 50;
        
        // FEATURE: Real-time vs Scheduled Indicator
        // If it's from the static timetable (offline), add a *
        const schedIndicator = item.isScheduled ? "*" : ""; 
        
        let timeDisplay;
        if (item.minutes > 59) {
            const dateObj = new Date(item.exactTime);
            timeDisplay = "at " + dateObj.toLocaleTimeString('en-AU', {
                timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hour12: false
            });
        } else {
            timeDisplay = `${item.minutes} min`;
        }

        return `
            <text x="0" y="${y}" font-size="36" font-weight="bold" class="base">${timeDisplay}${schedIndicator}</text>
            <text x="180" y="${y}" font-size="30" class="base">${item.destination}</text>
        `;
    }).join('');
  }
}

module.exports = PidsRenderer;