# UAS Pre-Flight Checklist System

**Fly Wit Us** - Professional drone flight checklist and logging system for FAA Part 107 compliance.

![Fly Wit Us Logo](https://res.cloudinary.com/devdash54321/image/upload/v1760659304/logos/flywitus-platypus-logo.png)

## Overview

A comprehensive, offline-first web application for UAS (Unmanned Aircraft System) pilots to complete pre-flight checklists, log missions, and maintain FAA-compliant flight records.

## Features

### Current (MVP v2.0)

- ✅ **Auto-Save** - Real-time persistence, never lose progress
- ✅ **Complete Pre-Flight Checklist** - 8 sections, 50+ items based on FAA Part 107
- ✅ **Weather Logging** - Manual entry + NOAA API auto-fetch
- ✅ **Battery Tracking** - Log up to 4 battery voltages per mission
- ✅ **Flight Log** - Record multiple flights per mission with timestamps
- ✅ **Aircraft Profiles** - Save and quick-load aircraft configurations
- ✅ **Mission History** - View past 10 missions with search
- ✅ **Export Options** - JSON backup + FAA-compliant PDF/TXT
- ✅ **Progress Tracking** - Visual progress bar for required items
- ✅ **Offline-First** - Works without internet, syncs when available

### Tech Stack

- React 18 + TypeScript
- Tailwind CSS
- Browser localStorage (offline persistence)
- NOAA Weather API integration

## Installation

### Option 1: Run Locally
```bash
# Clone repository
git clone https://github.com/dapperAuteur/fly-witus.git
cd fly-witus

# Install dependencies
npm install

# Start development server
npm run dev
```

### Option 2: Deploy to Vercel/Netlify
```bash
# Build for production
npm run build

# Deploy (example for Vercel)
vercel deploy
```

## Usage

### Pre-Flight Workflow

1. **Load Aircraft Profile** (optional)
   - Click "Aircraft Profiles" → Select saved aircraft
   - Auto-fills type and certificate number

2. **Fill Mission Info**
   - Pilot name, location, aircraft type
   - Click "Auto-Fetch Weather" for live conditions

3. **Complete Checklist**
   - Progress bar shows completion percentage
   - Red asterisks (*) mark required items
   - Battery voltages auto-expand when checked

4. **Log Flights**
   - Click "+ Add Flight" after each flight
   - Record takeoff/landing times, locations, notes

5. **Save Mission**
   - Button unlocks at 100% completion
   - Automatically saved to browser storage

6. **Export Records**
   - View Mission History → Export PDF (FAA compliance)
   - Export JSON for backup/cloud storage

## Data Storage

All data stored in browser localStorage:
- `uas_missions` - Completed missions
- `uas_aircraft_profiles` - Saved aircraft
- `uas_current_mission` - Auto-save draft

**Backup Strategy**: Export JSON weekly, upload to Google Drive/Dropbox.

## Configuration

### Logo Customization
Update logo URL in component:
```typescript
// Header logo: 80x80px
<img src="https://fly.witus.online/logo.png" alt="Your Company" className="h-16 w-auto" />

// Footer logo: 60x60px  
<img src="https://fly.witus.online/logo.png" alt="Your Company" className="h-12 w-auto" />
```

### Weather API
Uses NOAA's free API (no key required):
- Requires GPS location access
- Falls back to manual entry if unavailable

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Note**: localStorage required. Private/Incognito mode may limit functionality.

## FAA Compliance

This system helps meet 14 CFR Part 107 requirements:
- Pre-flight inspection documentation
- Weather condition logging
- Flight time records
- Equipment condition tracking

**Legal Note**: Export PDFs for official logbook. Consult with aviation attorney for specific compliance needs.

## Contributing

See [CONTRIBUTING.md](https://i.witus.online/fly-witus-contributing) for guidelines.

## Roadmap

See [ROADMAP.md](https://i.witus.online/fly-witus-dev-roadmap) for planned features.

## License

MIT License - See [LICENSE](LICENSE) for details.

## Support

- **Website**: [Fly Wit US](https://i.witus.online/fly-witus-dev-roadmap)
- **Issues**: [Issues](https://i.witus.online/fly-witus-issues-tracker)
- **Email**: support@witus.online

## Acknowledgments

- Checklist based on FAA Part 107 regulations
- Weather data from National Weather Service API
- Icon design by Fly Wit Us team

---

**Fly Wit Us** - Safe Flying Through Better Planning