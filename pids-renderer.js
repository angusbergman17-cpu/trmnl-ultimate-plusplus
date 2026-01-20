const sharp = require('sharp');

class PidsRenderer {
  constructor() {
    this.width = 800;
    this.height = 480;
  }

  async render(data, coffee, invert = false) {
    // 1. SAFE MELBOURNE TIME (Fixes the 02:38pm issue)
    // We use Intl to force the correct 24h/12h format for Melbourne
    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Melbourne',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // Forces 14:00 instead of 2:00 pm (less ambiguity)
    });
    const timeStr = timeFormatter.format(now);

    // 2. SVG TEMPLATE
    // We build the image using SVG XML
    const svg = `
    <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .base { font-family: sans-serif; fill: black; }
        .bold { font-weight: bold; }
        .white { fill: white; }
        .line { stroke: black; stroke-width: 3; }
      </style>
      
      <rect width="100%" height="100%" fill="white" />

      <text x="20" y="70" font-size="60" font-weight="900" class="base">${timeStr}</text>
      
      <rect x="420" y="20" width="360" height="60" fill="black" rx="10" />
      <text x="600" y="62" font-size="28" font-weight="bold" fill="white" text-anchor="middle">
        ${coffee.decision.toUpperCase()}
      </text>

      <rect x="20" y="110" width="180" height="35" fill="black" />
      <text x="30" y="138" font-size="24" font-weight="bold" fill="white">TRAM 58</text>
      <line x1="20" y1="150" x2="780" y2="150" class="line" />

      <g transform="translate(20, 190)">
         ${this.renderList(data.trams, "No Trams - Next at 05:00")}
      </g>

      <rect x="20" y="280" width="280" height="35" fill="black" />
      <text x="30" y="308" font-size="24" font-weight="bold" fill="white">TRAINS (LOOP)</text>
      <line x1="20" y1="320" x2="780" y2="320" class="line" />

      <g transform="translate(20, 360)">
         ${this.renderList(data.trains, "No Trains - Next at 04:30")}
      </g>

      <line x1="20" y1="420" x2="780" y2="420" class="line" />
      
      <text x="20" y="460" font-size="32" font-weight="bold" class="base">
        ${data.weather.temp !== '--' ? data.weather.temp + '°C' : ''} ${data.weather.icon}
      </text>
      <text x="140" y="460" font-size="24" class="base">
        ${data.weather.condition || ''}
      </text>

      <text x="780" y="460" font-size="20" text-anchor="end" class="base">
        ${coffee.subtext}
      </text>

    </svg>
    `;

    // 3. CONVERT TO PNG
    return await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
  }

  // Helper to draw lists or the "Empty Message"
  renderList(items, emptyMsg) {
    if (!items || items.length === 0) {
        return `<text x="0" y="0" font-size="28" fill="#555" font-style="italic">${emptyMsg}</text>`;
    }
    
    // Draw up to 2 items
    return items.slice(0, 2).map((item, i) => {
        const y = i * 50;
        return `
            <text x="0" y="${y}" font-size="32" font-weight="bold" class="base">${item.minutes} min</text>
            <text x="120" y="${y}" font-size="28" class="base">${item.destination}</text>
        `;
    }).join('');
  }
}

module.exports = PidsRenderer;
