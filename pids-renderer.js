/**
 * Melbourne PT PIDS Renderer
 * Renders in Metro Trains / TramTracker style for 800x480 4-bit grayscale e-ink
 */

const { createCanvas } = require('canvas');

class PIDSRenderer {
  constructor() {
    this.width = 800;
    this.height = 480;
    this.previousFrame = null; // For partial refresh tracking
  }

  // Main render function
  async render(data, coffeeData, showClock = true) {
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, this.width, this.height);

    const currentY = this.renderLayout(ctx, data, coffeeData, showClock);

    // Convert to PNG buffer
    const buffer = canvas.toBuffer('image/png');
    this.previousFrame = buffer;
    
    return buffer;
  }

  // Render complete layout
  renderLayout(ctx, data, coffeeData, showClock) {
    let y = 0;

    // === TOP BAR: Time + Coffee Decision ===
    y = this.renderTopBar(ctx, coffeeData, showClock, y);

    // === TRAMS SECTION ===
    y = this.renderTramSection(ctx, data.trams, y);

    // === TRAINS SECTION ===
    y = this.renderTrainSection(ctx, data.trains, y);

    // === BOTTOM BAR: Weather + News + Disruptions ===
    y = this.renderBottomBar(ctx, data.weather, data.news, data.disruptions, y);

    return y;
  }

  // Render top bar with time and coffee decision
  renderTopBar(ctx, coffeeData, showClock, startY) {
    const barHeight = 80;
    
    // Gray background bar
    ctx.fillStyle = '#E8E8E8';
    ctx.fillRect(0, startY, this.width, barHeight);

    // Left side: Current time (if enabled)
    if (showClock) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-AU', { 
        hour: '2-digit', 
        minute: '2-digit'
      });

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(timeStr, 20, startY + 55);
    }

    // Right side: Coffee decision
    const decisionWidth = 400;
    const decisionX = this.width - decisionWidth - 20;
    
    // Decision box with status color
    ctx.fillStyle = coffeeData.color;
    ctx.fillRect(decisionX, startY + 10, decisionWidth, 60);

    // Decision text
    ctx.fillStyle = coffeeData.status === 'late' || coffeeData.status === 'critical' 
      ? '#FFFFFF' 
      : '#000000';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(coffeeData.decision, decisionX + decisionWidth / 2, startY + 52);

    // Minutes to spare (small text)
    ctx.font = '16px sans-serif';
    ctx.fillText(`${coffeeData.timeToSpare}min to spare`, decisionX + decisionWidth / 2, startY + 68);

    return startY + barHeight;
  }

  // Render tram section (TramTracker style)
  renderTramSection(ctx, trams, startY) {
    const sectionHeight = 140;
    
    // Section header
    ctx.fillStyle = '#78be20'; // Yarra Trams green
    ctx.fillRect(0, startY, this.width, 40);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🚋 TRAMS FROM TIVOLI RD', 20, startY + 28);

    // Tram departures
    let rowY = startY + 50;
    
    trams.slice(0, 3).forEach((tram, index) => {
      this.renderTramRow(ctx, tram, rowY);
      rowY += 30;
    });

    // Divider line
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, startY + sectionHeight);
    ctx.lineTo(this.width, startY + sectionHeight);
    ctx.stroke();

    return startY + sectionHeight;
  }

  // Render single tram row
  renderTramRow(ctx, tram, y) {
    // Route number box (green)
    ctx.fillStyle = '#78be20';
    ctx.fillRect(20, y - 20, 60, 28);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tram.route, 50, y);

    // Destination
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(tram.destination, 100, y);

    // Time
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'right';
    
    const timeText = tram.minutes === 0 ? 'NOW' : 
                     tram.minutes === 1 ? '1 min' : 
                     `${tram.minutes} min`;
    
    ctx.fillText(timeText, this.width - 20, y);
  }

  // Render train section (Metro PIDS style)
  renderTrainSection(ctx, trains, startY) {
    const sectionHeight = 140;
    
    // Section header
    ctx.fillStyle = '#0072CE'; // Metro blue
    ctx.fillRect(0, startY, this.width, 40);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🚇 TRAINS FROM SOUTH YARRA', 20, startY + 28);

    // Train departures
    let rowY = startY + 50;
    
    trains.slice(0, 3).forEach((train, index) => {
      this.renderTrainRow(ctx, train, rowY);
      rowY += 30;
    });

    return startY + sectionHeight;
  }

  // Render single train row (Metro PIDS style)
  renderTrainRow(ctx, train, y) {
    // Platform number box (colored by line)
    ctx.fillStyle = this.getGrayscaleForColor(train.line.color);
    ctx.fillRect(20, y - 20, 50, 28);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(train.platform, 45, y);

    // Destination
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(train.destination, 90, y);

    // Stops All / Express indicator
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText(train.stopsAll ? 'Stops All' : 'Express', 350, y);

    // Time box (dark background)
    const timeWidth = 100;
    const timeX = this.width - timeWidth - 20;
    
    ctx.fillStyle = '#333333';
    ctx.fillRect(timeX, y - 20, timeWidth, 28);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    
    const timeText = train.minutes === 0 ? 'NOW' : 
                     train.minutes === 1 ? '1 min' : 
                     `${train.minutes} min`;
    
    ctx.fillText(timeText, timeX + timeWidth / 2, y);
  }

  // Render bottom info bar
  renderBottomBar(ctx, weather, news, disruptions, startY) {
    const barHeight = 80;
    const barY = this.height - barHeight;

    // Background
    ctx.fillStyle = '#F0F0F0';
    ctx.fillRect(0, barY, this.width, barHeight);

    // Weather (left side)
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${weather.icon} ${weather.temp}°C`, 20, barY + 35);

    ctx.font = '20px sans-serif';
    ctx.fillText(weather.condition, 20, barY + 60);

    // Disruptions alert (center, if any)
    if (disruptions) {
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(250, barY + 10, this.width - 500, 60);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ SERVICE ALERT', this.width / 2, barY + 40);
    }

    // News headline (right side)
    ctx.fillStyle = '#666666';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    
    const newsX = disruptions ? 250 : 300;
    const newsWidth = this.width - newsX - 20;
    const truncatedNews = this.truncateText(ctx, news, newsWidth);
    ctx.fillText(truncatedNews, newsX, barY + 45);

    return this.height;
  }

  // Helper: Convert RGB color to appropriate grayscale
  getGrayscaleForColor(hexColor) {
    // Convert hex to RGB
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);

    // Calculate perceived brightness (weighted)
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

    // Map to 4-bit grayscale (16 levels)
    // Darker colors → darker grays, brighter → lighter grays
    const grayLevel = Math.floor((brightness / 255) * 15);
    const grayValue = Math.floor((grayLevel / 15) * 255);

    const hex = grayValue.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  }

  // Helper: Truncate text to fit width
  truncateText(ctx, text, maxWidth) {
    let truncated = text;
    while (ctx.measureText(truncated).width > maxWidth && truncated.length > 0) {
      truncated = truncated.substring(0, truncated.length - 1);
    }
    
    if (truncated.length < text.length) {
      truncated += '...';
    }
    
    return truncated;
  }

  // Calculate what changed for partial refresh
  getChangedRegions(newBuffer) {
    if (!this.previousFrame) {
      return 'full'; // First render, full refresh needed
    }

    // For now, return 'partial' if buffers differ slightly
    // In production, compare pixel-by-pixel to find changed regions
    
    return 'partial';
  }
}

module.exports = PIDSRenderer;
