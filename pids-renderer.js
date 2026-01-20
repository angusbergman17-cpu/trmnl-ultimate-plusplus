/**
 * Melbourne PT PIDS Renderer (SVG + Sharp Edition)
 * Replaces node-canvas to ensure stable deployment on Render.com
 */

const sharp = require('sharp');

class PIDSRenderer {
  constructor() {
    this.width = 800;
    this.height = 480;
  }

  // Main render function
  async render(data, coffeeData, showClock = true) {
    // 1. Build the SVG string
    let svgContent = '';
    
    // Helper to append SVG elements
    const addRect = (x, y, w, h, fill) => {
      svgContent += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" />`;
    };

    const addText = (text, x, y, size, align, color, bold = false) => {
      const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
      const weight = bold ? 'bold' : 'normal';
      // SVG text y is the baseline. 
      svgContent += `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${this.escapeXml(text)}</text>`;
    };

    // White background
    addRect(0, 0, this.width, this.height, '#FFFFFF');

    // === TOP BAR: Time + Coffee Decision ===
    const topBarHeight = 80;
    addRect(0, 0, this.width, topBarHeight, '#E8E8E8');

    // Time
    if (showClock) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
      addText(timeStr, 20, 55, 48, 'left', '#000000', true);
    }

    // Coffee Decision
    const decisionWidth = 400;
    const decisionX = this.width - decisionWidth - 20;
    addRect(decisionX, 10, decisionWidth, 60, coffeeData.color);
    
    const decisionTextColor = (coffeeData.status === 'late' || coffeeData.status === 'critical') ? '#FFFFFF' : '#000000';
    addText(coffeeData.decision, decisionX + decisionWidth / 2, 52, 36, 'center', decisionTextColor, true);
    addText(`${coffeeData.timeToSpare}min to spare`, decisionX + decisionWidth / 2, 68, 16, 'center', decisionTextColor);

    // === TRAMS SECTION ===
    const tramY = 80;
    const tramHeight = 140;
    
    // Header
    addRect(0, tramY, this.width, 40, '#78be20'); // Yarra Trams Green
    addText('🚋 TRAMS FROM TIVOLI RD', 20, tramY + 28, 28, 'left', '#FFFFFF', true);

    // Rows
    data.trams.slice(0, 3).forEach((tram, i) => {
      const y = tramY + 50 + (i * 30);
      
      // Route Box
      addRect(20, y - 20, 60, 28, '#78be20');
      addText(tram.route, 50, y, 20, 'center', '#FFFFFF', true);
      
      // Dest
      addText(tram.destination, 100, y, 24, 'left', '#000000', true);
      
      // Time
      const timeText = tram.minutes === 0 ? 'NOW' : `${tram.minutes} min`;
      addText(timeText, this.width - 20, y, 28, 'right', '#000000', true);
    });
    
    // Divider
    addRect(0, tramY + tramHeight - 2, this.width, 2, '#CCCCCC');

    // === TRAINS SECTION ===
    const trainY = tramY + tramHeight;
    const trainHeight = 140;

    // Header
    addRect(0, trainY, this.width, 40, '#0072CE'); // Metro Blue
    addText('🚇 TRAINS FROM SOUTH YARRA', 20, trainY + 28, 28, 'left', '#FFFFFF', true);

    // Rows
    data.trains.slice(0, 3).forEach((train, i) => {
      const y = trainY + 50 + (i * 30);
      
      // Platform Box
      addRect(20, y - 20, 50, 28, this.getGrayscaleForColor(train.line.color));
      addText(train.platform, 45, y, 20, 'center', '#FFFFFF', true);
      
      // Dest
      addText(train.destination, 90, y, 24, 'left', '#000000', true);
      
      // Status
      addText(train.stopsAll ? 'Stops All' : 'Express', 350, y, 18, 'left', '#666666');
      
      // Time Box
      const timeWidth = 100;
      const timeX = this.width - timeWidth - 20;
      addRect(timeX, y - 20, timeWidth, 28, '#333333');
      const timeText = train.minutes === 0 ? 'NOW' : `${train.minutes} min`;
      addText(timeText, timeX + timeWidth / 2, y, 24, 'center', '#FFFFFF', true);
    });

    // === BOTTOM BAR ===
    const bottomY = this.height - 80;
    addRect(0, bottomY, this.width, 80, '#F0F0F0');
    
    // Weather
    addText(`${data.weather.icon} ${data.weather.temp}°C`, 20, bottomY + 35, 32, 'left', '#000000', true);
    addText(data.weather.condition, 20, bottomY + 60, 20, 'left', '#000000');

    // News/Disruptions
    if (data.disruptions) {
        addRect(250, bottomY + 10, this.width - 500, 60, '#FF0000');
        addText('⚠️ SERVICE ALERT', this.width / 2, bottomY + 40, 20, 'center', '#FFFFFF', true);
    } else {
        addText(data.news, 300, bottomY + 45, 16, 'left', '#666666');
    }

    // Wrap in SVG tag
    const svg = `<svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;

    // 2. Convert SVG to PNG using Sharp
    // We force a 8-color palette (3-bit) which maps cleanly to TRMNL's 1-bit or grayscale modes
    try {
        const buffer = await sharp(Buffer.from(svg))
            .png({ 
                palette: true, 
                colors: 4,  // Ensures we get distinct gray levels (Black, White, and various grays)
                dither: 1.0  // Apply dithering for smoother gradients if any
            }) 
            .toBuffer();
            
        return buffer;
    } catch (error) {
        console.error("Sharp Render Error:", error);
        throw error;
    }
  }

  // Helper: Simple XML escape
  escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, c => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
  }

  getGrayscaleForColor(hex) {
      // Pass-through standard hex; Sharp handles the grayscale conversion
      return hex || '#000000';
  }
}

module.exports = PIDSRenderer;
