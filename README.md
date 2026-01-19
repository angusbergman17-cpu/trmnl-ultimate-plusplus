# TRMNL Melbourne PT - ULTIMATE++ Edition 🚀

**The ULTIMATE version with quad-tier fallback + easy configuration!**

## 🎯 What's New in ULTIMATE++

### Quad-Tier Fallback System
1. **TramTracker API** (trams, NO AUTH!) - New primary for trams!
2. **PTV Timetable API** (trains, NO AUTH!) - Primary for trains!
3. **GTFS Realtime** (optional key) - Secondary fallback
4. **Smart Simulations** - Always works

### Built-in Configuration Editor
Edit `config.js` to customize:
- Display size & layout
- Font sizes & styles
- Stop IDs & platforms
- Refresh intervals
- Colors & styling
- Behavior & features

Then visit `/config` to see your settings!

## 🚀 Instant Deploy

```bash
# 1. Deploy to Render.com
#    - Build: npm install
#    - Start: npm start
#    - NO environment variables needed!

# 2. Configure TRMNL:
#    URL: https://your-app.onrender.com/api/screen
#    Refresh: 20 seconds

# 3. DONE! Enjoy live data!
```

## ⚙️ Customization

Edit `config.js` to change:
- **Stop IDs**: Change train/tram stops
- **Layout**: Adjust section heights
- **Fonts**: Modify sizes and styles
- **Behavior**: Change refresh rates
- **Labels**: Customize text

Then redeploy to Render - changes apply instantly!

## 📊 Data Sources

**Trams** (priority order):
1. TramTracker API (live, ±30 sec)
2. PTV API (live, ±1 min)
3. GTFS Realtime (live, ±1 min)
4. Simulations (±5 min)

**Trains** (priority order):
1. PTV API (live, ±30 sec)
2. GTFS Realtime (live, ±1 min)
3. Simulations (±5 min)

## 🎨 Features

- ✅ **Zero configuration** - works immediately
- ✅ **Live data** without API keys
- ✅ **Easy customization** via config.js
- ✅ **Web dashboard** at root URL
- ✅ **Config viewer** at /config
- ✅ **100% uptime** guaranteed

## 🔗 Endpoints

- `/` - Beautiful dashboard
- `/config` - View configuration
- `/api/screen` - E-ink display (for TRMNL)
- `/api/data` - Raw JSON data
- `/api/status` - Health check

## 🎁 What You Get

- Live train departures (South Yarra Platform 3)
- Live tram departures (Route 58, Tivoli Rd)
- Coffee decision calculator
- Melbourne weather
- News ticker
- Service disruptions

---

**Ready to deploy? Just push to Render and watch it work!** 🎉
