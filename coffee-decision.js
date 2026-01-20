const sharp = require('sharp');

class PidsRenderer {
  constructor() {
    this.width = 800;
    this.height = 480;
  }

  async render(data, coffee, invert = false) {
    try {
      const now = new Date();
      const timeFormatter = new Intl.DateTimeFormat('en-AU', {
          timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hour12: false
      });
      const timeStr = timeFormatter.format(now);

      const isUrgent = coffee && coffee.urgent;
      const boxFill = isUrgent ? "white" : "black";
      const textFill = isUrgent ? "black" : "white";
      const boxStroke = isUrgent ? 'stroke="black" stroke-width="4"' : '';
      const decisionText = (coffee && coffee.decision) ? coffee.decision.toUpperCase() : "LOADING...";
      const subText = (coffee && coffee.subtext) ? coffee.subtext : "";

      const svg = `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .base { font-family: sans-serif; fill: black; }
          .white { fill: white; }
          .line { stroke: black; stroke-width: 3; }
        </style>
        
        <rect width="100%" height="100%" fill="white" />
        <text x="20" y="65" font-size="60" font-weight="900" class="base">${timeStr}</text>
        
        <rect x="400" y="15" width="380" height="60" fill="${boxFill}" rx="8" ${boxStroke} />
        <text x="590" y="57" font-size="28" font-weight="bold" fill="${textFill}" text-anchor="middle">${decisionText}</text>

        <rect x="20" y="90" width="800" height="32" fill="black" />
        <text x="30" y="116" font-size="22" font-weight="bold" fill="white">TRAM 58 (TO WEST COBURG)</text>
        <g transform="translate(20, 132)">${this.renderList(data.trams, "NO TRAMS - CHECK SCHEDULE", 3)}</g>

        <rect x="20" y="260" width="800" height="32" fill="black" />
        <text x="30" y="286" font-size="22" font-weight="bold" fill="white">TRAINS (CITY LOOP)</text>
        <g transform="translate(20, 302)">${this.renderList(data.trains, "NO TRAINS - CHECK SCHEDULE", 3)}</g>

        <line x1="20" y1="425" x2="780" y2="425" class="line" />
        <text x="20" y="465" font-size="32" font-weight="bold" class="base">
          ${data.weather ? (data.weather.temp + '° ' + data.weather.icon) : '--'}
        </text>
        <text x="160" y="465" font-size="24" class="base" fill="#444">
          ${data.weather ? data.weather.condition : ''}
        </text>
        <text x="780" y="465" font-size="20" text-anchor="end" class="base">${subText}</text>
      </svg>
      `;
      return await sharp(Buffer.from(svg)).png().toBuffer();
    } catch (e) {
      return await sharp({ create: { width: 800, height: 480, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer();
    }
  }

  renderList(items, emptyMsg, limit = 3) {
    if (!items || items.length === 0) return `<text x="10" y="20" font-size="24" fill="#555" font-style="italic">${emptyMsg}</text>`;
    return items.slice(0, limit).map((item, i) => {
        const y = i * 40; 
        const schedIndicator = item.isScheduled ? "*" : ""; 
        let timeDisplay = item.minutes > 59 ? "at " + new Date(item.exactTime).toLocaleTimeString('en-AU', {timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hour12: false}) : `${item.minutes} min`;
        return `<text x="0" y="${y}" font-size="32" font-weight="bold" class="base">${timeDisplay}${schedIndicator}</text><text x="180" y="${y}" font-size="28" class="base">${item.destination}</text>`;
    }).join('');
  }
}

module.exports = PidsRenderer;