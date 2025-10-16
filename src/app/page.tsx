"use client"

import React, { useState, useEffect, useMemo } from 'react';

// --- TYPE DEFINITIONS ---
interface ChecklistSection {
  title: string;
  items: ChecklistItem[];
}

interface ChecklistItem {
  id: string;
  label: string;
  type: 'checkbox' | 'text' | 'weather';
  required?: boolean;
  subfields?: { id: string; label: string; type: 'text' | 'number' }[];
}

interface AircraftProfile {
  id: string;
  name: string;
  type: string;
  certificateNumber: string;
  customChecklist?: string[];
}

interface MissionLog {
  missionNumber: string;
  timestamp: string;
  pilotName: string;
  location: string;
  aircraftType: string;
  rpCert: string;
  profileId?: string;
  completed: { [key: string]: boolean | string };
  weather: {
    temperature?: string;
    wind?: string;
    precipitation?: string;
  };
  flightRecords: FlightRecord[];
}

interface FlightRecord {
  flightNumber: number;
  takeoffLoc: string;
  landingLoc: string;
  launchTime: string;
  landingTime: string;
  elapsedTime: string;
  batteryVoltage: string;
  notes: string;
}

interface WeatherAPIResponse {
  properties?: {
    periods?: Array<{
      temperature: number;
      temperatureUnit: string;
      windSpeed: string;
      shortForecast: string;
    }>;
  };
}

// --- CHECKLIST DATA ---
const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    title: 'Mission Checklist',
    items: [
      { id: 'airport_notified', label: 'Airport(s) Notified', type: 'checkbox', required: true },
      { id: 'location_ok', label: 'Location is OK to fly', type: 'checkbox', required: true },
      { id: 'weather_ok', label: 'Weather Forecast OK', type: 'weather', required: true },
      { id: 'firmware_updated', label: 'Firmware up-to-date', type: 'checkbox' },
      { id: 'microsd_formatted', label: 'MicroSD Card Formatted', type: 'checkbox' },
    ]
  },
  {
    title: 'Battery & Equipment',
    items: [
      { id: 'uav_batteries_charged', label: 'UAV Batteries Charged', type: 'checkbox', required: true, 
        subfields: [
          { id: 'battery1', label: 'Battery 1 volts', type: 'number' },
          { id: 'battery2', label: 'Battery 2 volts', type: 'number' },
          { id: 'battery3', label: 'Battery 3 volts', type: 'number' },
          { id: 'battery4', label: 'Battery 4 volts', type: 'number' },
        ]
      },
      { id: 'controller_charged', label: 'Controller Charged', type: 'checkbox', required: true },
      { id: 'tablet_charged', label: 'Tablet Charged', type: 'checkbox', required: true },
      { id: 'phone_charged', label: 'Mobile Phone Charged', type: 'checkbox' },
    ]
  },
  {
    title: 'Gear Packed',
    items: [
      { id: 'gimbal_protector', label: 'Gimbal Protector Installed', type: 'checkbox' },
      { id: 'propellers_packed', label: 'Propellers Packed', type: 'checkbox', required: true },
      { id: 'cables_packed', label: 'Cables Packed', type: 'checkbox' },
      { id: 'filters_packed', label: 'Camera Filters Packed', type: 'checkbox' },
      { id: 'sunshade_packed', label: 'Sun Shade Packed', type: 'checkbox' },
      { id: 'tools_packed', label: 'Tools Packed', type: 'checkbox' },
      { id: 'flight_plan', label: 'Flight Plan designed/entered in software', type: 'checkbox' },
      { id: 'logbook_packed', label: 'Log Book Packed', type: 'checkbox' },
    ]
  },
  {
    title: 'Launch Site Checklist',
    items: [
      { id: 'weather_verified', label: 'Verify Weather is OK to Fly', type: 'weather', required: true },
      { id: 'safety_briefing', label: 'Safety Briefing', type: 'checkbox', required: true },
      { id: 'obstacles_checked', label: 'Check for obstacles, interference', type: 'checkbox', required: true },
      { id: 'human_activity', label: 'Check for nearby human activity/dangerous situations', type: 'checkbox', required: true },
      { id: 'launch_pad_downwind', label: 'Verify Launch Pad is down-wind from observers', type: 'checkbox' },
      { id: 'barriers_placed', label: 'Launch Pad/Barriers Placed', type: 'checkbox' },
    ]
  },
  {
    title: 'Equipment Checklist',
    items: [
      { id: 'airframe_inspected', label: 'Airframe/Landing gear inspected', type: 'checkbox', required: true },
      { id: 'propellers_attached', label: 'Propellers Inspected/Attached', type: 'checkbox', required: true },
      { id: 'controller_assembled', label: 'Controller/Tablet Assembled', type: 'checkbox', required: true },
      { id: 'sd_installed', label: 'SD Card Installed', type: 'checkbox', required: true },
      { id: 'battery_installed', label: 'Battery Installed', type: 'checkbox', required: true },
      { id: 'gimbal_protector_removed', label: 'Gimbal/Lens Protector Removed', type: 'checkbox', required: true },
      { id: 'filters_installed', label: 'Camera Filters Installed', type: 'checkbox' },
    ]
  },
  {
    title: 'Pre-Flight Checklist',
    items: [
      { id: 'aircraft_on_pad', label: 'Aircraft Placed on Launch Pad', type: 'checkbox', required: true },
      { id: 'controller_on', label: 'Turn on Remote Controller/Tablet/DJI Pilot App', type: 'checkbox', required: true },
      { id: 'antennas_positioned', label: 'Antennas Properly Positioned', type: 'checkbox', required: true },
      { id: 'aircraft_on', label: 'Turn on Aircraft', type: 'checkbox', required: true },
      { id: 'leds_checked', label: 'Check the aircraft status LEDs', type: 'checkbox', required: true },
      { id: 'gimbal_level', label: 'Verify the gimbal is level, can move unobstructed', type: 'checkbox', required: true },
      { id: 'rc_battery', label: 'Check RC battery level', type: 'checkbox', required: true },
      { id: 'aircraft_battery', label: 'Check Aircraft Battery Level', type: 'checkbox', required: true },
      { id: 'flight_mode', label: 'Check flight mode switch (P-Mode)', type: 'checkbox', required: true },
      { id: 'satellite_compass', label: 'Check Satellite and Compass status', type: 'checkbox', required: true },
      { id: 'rth_location', label: 'Set RTH Location and height', type: 'checkbox', required: true },
      { id: 'camera_settings', label: 'Check camera settings', type: 'checkbox', required: true },
    ]
  },
  {
    title: 'Take-Off Checklist',
    items: [
      { id: 'launch_clear', label: 'Check launch site is clear for take off', type: 'checkbox', required: true },
      { id: 'motors_started', label: 'Start the motors', type: 'checkbox', required: true },
      { id: 'takeoff_hover', label: 'Take off and hover', type: 'checkbox', required: true },
      { id: 'stable_hover', label: 'Make sure the aircraft is stable while hovering', type: 'checkbox', required: true },
      { id: 'controls_responsive', label: 'Check flight controls, make sure they respond as expected', type: 'checkbox', required: true },
      { id: 'recording_started', label: 'Start recording video', type: 'checkbox', required: true },
    ]
  },
  {
    title: 'Post Flight Checklist',
    items: [
      { id: 'battery_removed', label: 'Remove Battery from Aircraft', type: 'checkbox', required: true },
      { id: 'gimbal_guard_installed', label: 'Install Gimbal Guard', type: 'checkbox', required: true },
      { id: 'equipment_repacked', label: 'Repack all equipment', type: 'checkbox', required: true },
      { id: 'flight_log_completed', label: 'Complete the Flight Log', type: 'checkbox', required: true },
    ]
  },
];

// --- STORAGE UTILITIES ---
const STORAGE_KEY = 'uas_missions';
const PROFILES_KEY = 'uas_aircraft_profiles';
const CURRENT_MISSION_KEY = 'uas_current_mission';

const saveCurrentMission = (mission: Partial<MissionLog>): void => {
  try {
    window.localStorage.setItem(CURRENT_MISSION_KEY, JSON.stringify(mission));
  } catch (error) {
    console.error('Failed to save current mission:', error);
  }
};

const getCurrentMission = (): Partial<MissionLog> | null => {
  try {
    const data = window.localStorage.getItem(CURRENT_MISSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load current mission:', error);
    return null;
  }
};

const clearCurrentMission = (): void => {
  try {
    window.localStorage.removeItem(CURRENT_MISSION_KEY);
  } catch (error) {
    console.error('Failed to clear current mission:', error);
  }
};

const saveMissionToStorage = (mission: MissionLog): void => {
  try {
    const existingData = window.localStorage.getItem(STORAGE_KEY);
    const missions = existingData ? JSON.parse(existingData) : [];
    missions.unshift(mission);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(missions));
  } catch (error) {
    console.error('Failed to save mission:', error);
  }
};

const getMissionsFromStorage = (): MissionLog[] => {
  try {
    const data = window.localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load missions:', error);
    return [];
  }
};

const saveProfilesToStorage = (profiles: AircraftProfile[]): void => {
  try {
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch (error) {
    console.error('Failed to save profiles:', error);
  }
};

const getProfilesFromStorage = (): AircraftProfile[] => {
  try {
    const data = window.localStorage.getItem(PROFILES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load profiles:', error);
    return [];
  }
};

// --- UTILITY FUNCTIONS ---
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const generateMissionNumber = (): string => {
  const today = new Date();
  const dateStr = formatDate(today);
  const timeStr = today.getTime().toString().slice(-4);
  return `${dateStr}-${timeStr}`;
};

const exportToJSON = (mission: MissionLog): void => {
  const dataStr = JSON.stringify(mission, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mission-${mission.missionNumber}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const exportToPDF = (mission: MissionLog): void => {
  const content = `
    UAS PRE-FLIGHT CHECKLIST
    Mission #: ${mission.missionNumber}
    Date: ${new Date(mission.timestamp).toLocaleString()}
    
    MISSION INFORMATION
    Pilot: ${mission.pilotName}
    RP Cert: ${mission.rpCert}
    Location: ${mission.location}
    Aircraft: ${mission.aircraftType}
    
    WEATHER CONDITIONS
    Temperature: ${mission.weather.temperature || 'N/A'}
    Wind: ${mission.weather.wind || 'N/A'}
    Precipitation: ${mission.weather.precipitation || 'N/A'}
    
    CHECKLIST ITEMS COMPLETED
    ${Object.entries(mission.completed).map(([key, value]) => 
      `- ${key}: ${typeof value === 'boolean' ? (value ? 'YES' : 'NO') : value}`
    ).join('\n    ')}
    
    FLIGHT RECORDS
    ${mission.flightRecords.map(f => `
    Flight ${f.flightNumber}
    - Takeoff: ${f.takeoffLoc} at ${f.launchTime}
    - Landing: ${f.landingLoc} at ${f.landingTime}
    - Duration: ${f.elapsedTime}
    - Battery: ${f.batteryVoltage}
    - Notes: ${f.notes}
    `).join('\n    ')}
  `;
  
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mission-${mission.missionNumber}.txt`;
  link.click();
  URL.revokeObjectURL(url);
};

const fetchWeatherData = async (lat: number, lon: number): Promise<WeatherAPIResponse | null> => {
  try {
    const pointResponse = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
    const pointData = await pointResponse.json();
    const forecastUrl = pointData.properties.forecast;
    
    const forecastResponse = await fetch(forecastUrl);
    const forecastData = await forecastResponse.json();
    
    return forecastData;
  } catch (error) {
    console.error('Weather API error:', error);
    return null;
  }
};

// --- SUB-COMPONENTS ---

const ChecklistItemComponent: React.FC<{
  item: ChecklistItem;
  checked: boolean;
  value?: string;
  subValues?: { [key: string]: string };
  weatherData?: { temperature?: string; wind?: string; precipitation?: string };
  onToggle: () => void;
  onValueChange: (value: string) => void;
  onSubValueChange: (subfieldId: string, value: string) => void;
  onWeatherChange: (field: string, value: string) => void;
}> = ({ item, checked, value, subValues, weatherData, onToggle, onValueChange, onSubValueChange, onWeatherChange }) => {
  
  if (item.type === 'weather') {
    return (
      <div className="border-l-4 border-sky-400 pl-4 py-3 bg-sky-50 rounded-r-lg">
        <label className="flex items-start font-medium text-gray-800 mb-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="mt-1 mr-3 w-5 h-5 accent-sky-600"
          />
          <span className={checked ? 'line-through text-gray-500' : ''}>
            {item.label} {item.required && <span className="text-red-500">*</span>}
          </span>
        </label>
        <div className="grid grid-cols-3 gap-3 ml-8">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Temperature:</label>
            <input
              type="text"
              value={weatherData?.temperature || ''}
              onChange={(e) => onWeatherChange('temperature', e.target.value)}
              placeholder="e.g., 72°F"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Wind:</label>
            <input
              type="text"
              value={weatherData?.wind || ''}
              onChange={(e) => onWeatherChange('wind', e.target.value)}
              placeholder="e.g., 5 mph NW"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Precipitation:</label>
            <input
              type="text"
              value={weatherData?.precipitation || ''}
              onChange={(e) => onWeatherChange('precipitation', e.target.value)}
              placeholder="None"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>
      </div>
    );
  }

  if (item.type === 'text') {
    return (
      <div className="flex items-center py-2">
        <label className="flex-grow font-medium text-gray-800">
          {item.label} {item.required && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onValueChange(e.target.value)}
          className="ml-4 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
        />
      </div>
    );
  }

  return (
    <div className="py-2">
      <label className="flex items-start cursor-pointer group">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 mr-3 w-5 h-5 accent-lime-600 cursor-pointer"
        />
        <span className={`font-medium transition-all ${checked ? 'line-through text-gray-500' : 'text-gray-800 group-hover:text-lime-600'}`}>
          {item.label} {item.required && <span className="text-red-500">*</span>}
        </span>
      </label>
      
      {item.subfields && checked && (
        <div className="ml-8 mt-2 space-y-2">
          {item.subfields.map(subfield => (
            <div key={subfield.id} className="flex items-center">
              <label className="text-sm text-gray-700 w-32">{subfield.label}:</label>
              <input
                type={subfield.type}
                value={subValues?.[subfield.id] || ''}
                onChange={(e) => onSubValueChange(subfield.id, e.target.value)}
                placeholder={subfield.type === 'number' ? '0.0' : ''}
                className="ml-2 px-2 py-1 w-24 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const FlightLogSection: React.FC<{
  flightRecords: FlightRecord[];
  onAddFlight: () => void;
  onUpdateFlight: (index: number, field: keyof FlightRecord, value: string) => void;
}> = ({ flightRecords, onAddFlight, onUpdateFlight }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-fuchsia-500 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Flight Log</h2>
        <button
          onClick={onAddFlight}
          className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 font-semibold transition"
        >
          + Add Flight
        </button>
      </div>
      
      {flightRecords.length === 0 && (
        <p className="text-gray-500 text-center py-4">No flights recorded yet.</p>
      )}
      
      {flightRecords.map((flight, idx) => (
        <div key={idx} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800 mb-3">Flight {flight.flightNumber}</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Takeoff Location:</label>
              <input
                type="text"
                value={flight.takeoffLoc}
                onChange={(e) => onUpdateFlight(idx, 'takeoffLoc', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500"
              />
            </div>
            
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Landing Location:</label>
              <input
                type="text"
                value={flight.landingLoc}
                onChange={(e) => onUpdateFlight(idx, 'landingLoc', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500"
              />
            </div>
            
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Launch Time:</label>
              <input
                type="time"
                value={flight.launchTime}
                onChange={(e) => onUpdateFlight(idx, 'launchTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500"
              />
            </div>
            
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Landing Time:</label>
              <input
                type="time"
                value={flight.landingTime}
                onChange={(e) => onUpdateFlight(idx, 'landingTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500"
              />
            </div>
            
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Elapsed Time:</label>
              <input
                type="text"
                value={flight.elapsedTime}
                onChange={(e) => onUpdateFlight(idx, 'elapsedTime', e.target.value)}
                placeholder="e.g., 00:23:45"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500"
              />
            </div>
            
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Battery Voltage:</label>
              <input
                type="text"
                value={flight.batteryVoltage}
                onChange={(e) => onUpdateFlight(idx, 'batteryVoltage', e.target.value)}
                placeholder="e.g., 15.2V"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="text-sm font-semibold text-gray-600 block mb-1">Flight Notes:</label>
            <textarea
              value={flight.notes}
              onChange={(e) => onUpdateFlight(idx, 'notes', e.target.value)}
              rows={2}
              placeholder="Observations, issues, or notable events..."
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// --- MAIN COMPONENT ---
const UASChecklistApp: React.FC = () => {
  const [missionNumber] = useState<string>(generateMissionNumber());
  const [pilotName, setPilotName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [aircraftType, setAircraftType] = useState<string>('');
  const [rpCert, setRpCert] = useState<string>('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  
  const [completed, setCompleted] = useState<{ [key: string]: boolean | string }>({});
  const [subValues, setSubValues] = useState<{ [key: string]: { [subId: string]: string } }>({});
  const [weather, setWeather] = useState<{ temperature?: string; wind?: string; precipitation?: string }>({});
  const [flightRecords, setFlightRecords] = useState<FlightRecord[]>([]);
  
  const [recentMissions, setRecentMissions] = useState<MissionLog[]>([]);
  const [aircraftProfiles, setAircraftProfiles] = useState<AircraftProfile[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showProfiles, setShowProfiles] = useState<boolean>(false);
  const [loadingWeather, setLoadingWeather] = useState<boolean>(false);

  // Load on mount
  useEffect(() => {
    const currentMission = getCurrentMission();
    if (currentMission) {
      if (currentMission.pilotName) setPilotName(currentMission.pilotName);
      if (currentMission.location) setLocation(currentMission.location);
      if (currentMission.aircraftType) setAircraftType(currentMission.aircraftType);
      if (currentMission.rpCert) setRpCert(currentMission.rpCert);
      if (currentMission.profileId) setSelectedProfileId(currentMission.profileId);
      if (currentMission.completed) setCompleted(currentMission.completed);
      if (currentMission.weather) setWeather(currentMission.weather);
      if (currentMission.flightRecords) setFlightRecords(currentMission.flightRecords);
    }
    
    setRecentMissions(getMissionsFromStorage());
    setAircraftProfiles(getProfilesFromStorage());
  }, []);

  // Auto-save on every change
  useEffect(() => {
    const currentMission: Partial<MissionLog> = {
      pilotName,
      location,
      aircraftType,
      rpCert,
      profileId: selectedProfileId,
      completed,
      weather,
      flightRecords,
    };
    saveCurrentMission(currentMission);
  }, [pilotName, location, aircraftType, rpCert, selectedProfileId, completed, weather, flightRecords]);

  // --- HANDLERS ---
  const handleToggle = (itemId: string) => {
    setCompleted(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleValueChange = (itemId: string, value: string) => {
    setCompleted(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const handleSubValueChange = (itemId: string, subfieldId: string, value: string) => {
    setSubValues(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [subfieldId]: value
      }
    }));
  };

  const handleWeatherChange = (field: string, value: string) => {
    setWeather(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddFlight = () => {
    setFlightRecords(prev => [
      ...prev,
      {
        flightNumber: prev.length + 1,
        takeoffLoc: '',
        landingLoc: '',
        launchTime: '',
        landingTime: '',
        elapsedTime: '',
        batteryVoltage: '',
        notes: ''
      }
    ]);
  };

  const handleUpdateFlight = (index: number, field: keyof FlightRecord, value: string) => {
    setFlightRecords(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleFetchWeather = async () => {
    setLoadingWeather(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const weatherData = await fetchWeatherData(latitude, longitude);
        
        if (weatherData?.properties?.periods?.[0]) {
          const current = weatherData.properties.periods[0];
          setWeather({
            temperature: `${current.temperature}°${current.temperatureUnit}`,
            wind: current.windSpeed,
            precipitation: current.shortForecast
          });
        }
        setLoadingWeather(false);
      }, () => {
        alert('Enable location access to fetch weather');
        setLoadingWeather(false);
      });
    } else {
      alert('Geolocation not supported');
      setLoadingWeather(false);
    }
  };

  const handleSaveMission = () => {
    if (!pilotName || !location || !aircraftType) {
      alert('Please fill in Pilot Name, Location, and Aircraft Type');
      return;
    }

    const missionLog: MissionLog = {
      missionNumber,
      timestamp: new Date().toISOString(),
      pilotName,
      location,
      aircraftType,
      rpCert,
      profileId: selectedProfileId,
      completed: { ...completed, ...subValues },
      weather,
      flightRecords,
    };

    saveMissionToStorage(missionLog);
    alert(`Mission ${missionNumber} saved!`);
    
    setRecentMissions(getMissionsFromStorage());
    resetForm();
  };

  const resetForm = () => {
    setCompleted({});
    setSubValues({});
    setWeather({});
    setFlightRecords([]);
    setPilotName('');
    setLocation('');
    setAircraftType('');
    setRpCert('');
    setSelectedProfileId('');
    clearCurrentMission();
  };

  const handleSelectProfile = (profileId: string) => {
    const profile = aircraftProfiles.find(p => p.id === profileId);
    if (profile) {
      setSelectedProfileId(profileId);
      setAircraftType(profile.type);
      setRpCert(profile.certificateNumber);
    }
  };

  const handleAddProfile = () => {
    const name = prompt('Aircraft name (e.g., "My Mavic 3"):');
    if (!name) return;
    
    const type = prompt('Aircraft type (e.g., "DJI Mavic 3"):');
    if (!type) return;
    
    const cert = prompt('Certificate number (optional):') || '';
    
    const newProfile: AircraftProfile = {
      id: Date.now().toString(),
      name,
      type,
      certificateNumber: cert,
    };
    
    const updatedProfiles = [...aircraftProfiles, newProfile];
    setAircraftProfiles(updatedProfiles);
    saveProfilesToStorage(updatedProfiles);
    setSelectedProfileId(newProfile.id);
    setAircraftType(newProfile.type);
    setRpCert(newProfile.certificateNumber);
  };

  const handleDeleteProfile = (profileId: string) => {
    if (!confirm('Delete this aircraft profile?')) return;
    
    const updatedProfiles = aircraftProfiles.filter(p => p.id !== profileId);
    setAircraftProfiles(updatedProfiles);
    saveProfilesToStorage(updatedProfiles);
    
    if (selectedProfileId === profileId) {
      setSelectedProfileId('');
    }
  };

  const handleExportMission = (mission: MissionLog) => {
    exportToJSON(mission);
  };

  const handleExportPDF = (mission: MissionLog) => {
    exportToPDF(mission);
  };

  // Calculate progress
  const requiredItems = useMemo(() => {
    const items: string[] = [];
    CHECKLIST_SECTIONS.forEach(section => {
      section.items.forEach(item => {
        if (item.required) {
          items.push(item.id);
        }
      });
    });
    return items;
  }, []);

  const completedRequired = useMemo(() => {
    return requiredItems.filter(id => completed[id]).length;
  }, [requiredItems, completed]);

  const progressPercentage = useMemo(() => {
    return Math.round((completedRequired / requiredItems.length) * 100);
  }, [completedRequired, requiredItems.length]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900">
            UAS <span className="text-sky-600">Pre-Flight Checklist</span>
          </h1>
          <p className="mt-2 text-gray-600">Mission: {missionNumber}</p>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <div className="mt-3 flex justify-center gap-2">
            <span className="px-3 py-1 bg-lime-100 text-lime-700 text-xs font-semibold rounded-full">
              Auto-Save: ON
            </span>
          </div>
        </header>

        {/* Progress Bar */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-t-4 border-lime-500">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-gray-800">Required Items Progress</h2>
            <span className="text-2xl font-extrabold text-gray-900">{progressPercentage}%</span>
          </div>
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-lime-500 transition-all duration-700 ease-out" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">{completedRequired} of {requiredItems.length} required items completed</p>
        </div>

        {/* Mission Info */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-t-4 border-sky-500">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Mission Information</h2>
            <button
              onClick={() => setShowProfiles(!showProfiles)}
              className="px-3 py-1 bg-sky-600 text-white rounded hover:bg-sky-700 text-sm font-semibold transition"
            >
              {showProfiles ? 'Hide Profiles' : 'Aircraft Profiles'}
            </button>
          </div>
          
          {showProfiles && (
            <div className="mb-4 p-4 bg-sky-50 rounded-lg border border-sky-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-800">Saved Aircraft</h3>
                <button
                  onClick={handleAddProfile}
                  className="px-3 py-1 bg-lime-600 text-white rounded hover:bg-lime-700 text-sm font-semibold transition"
                >
                  + Add Aircraft
                </button>
              </div>
              {aircraftProfiles.length === 0 ? (
                <p className="text-gray-500 text-sm">No profiles saved yet.</p>
              ) : (
                <div className="space-y-2">
                  {aircraftProfiles.map(profile => (
                    <div key={profile.id} className="flex justify-between items-center bg-white p-3 rounded border border-gray-200">
                      <div>
                        <p className="font-semibold text-gray-800">{profile.name}</p>
                        <p className="text-sm text-gray-600">{profile.type}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSelectProfile(profile.id)}
                          className="px-3 py-1 bg-sky-600 text-white rounded hover:bg-sky-700 text-sm font-semibold transition"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => handleDeleteProfile(profile.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-semibold transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Pilot Name: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={pilotName}
                onChange={(e) => setPilotName(e.target.value)}
                placeholder="Enter pilot name"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">RP Cert:</label>
              <input
                type="text"
                value={rpCert}
                onChange={(e) => setRpCert(e.target.value)}
                placeholder="Remote Pilot Certificate #"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Location: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Flight location"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Aircraft Type/Name: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={aircraftType}
                onChange={(e) => setAircraftType(e.target.value)}
                placeholder="e.g., DJI Mavic 3"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <button
              onClick={handleFetchWeather}
              disabled={loadingWeather}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition disabled:bg-gray-400"
            >
              {loadingWeather ? 'Fetching Weather...' : 'Auto-Fetch Weather (NOAA)'}
            </button>
          </div>
        </div>

        {/* Checklist Sections */}
        {CHECKLIST_SECTIONS.map((section, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-t-4 border-gray-400">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{section.title}</h2>
            <div className="space-y-1">
              {section.items.map(item => (
                <ChecklistItemComponent
                  key={item.id}
                  item={item}
                  checked={!!completed[item.id]}
                  value={typeof completed[item.id] === 'string' ? completed[item.id] as string : ''}
                  subValues={subValues[item.id]}
                  weatherData={weather}
                  onToggle={() => handleToggle(item.id)}
                  onValueChange={(value) => handleValueChange(item.id, value)}
                  onSubValueChange={(subfieldId, value) => handleSubValueChange(item.id, subfieldId, value)}
                  onWeatherChange={handleWeatherChange}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Flight Log */}
        <FlightLogSection
          flightRecords={flightRecords}
          onAddFlight={handleAddFlight}
          onUpdateFlight={handleUpdateFlight}
        />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8 mb-8">
          <button
            onClick={handleSaveMission}
            disabled={progressPercentage < 100}
            className={`flex-1 py-4 px-6 rounded-xl text-white font-bold text-lg shadow-lg transition ${
              progressPercentage < 100
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-lime-600 hover:bg-lime-700'
            }`}
          >
            {progressPercentage < 100 ? 'Complete Required Items' : 'Complete & Save Mission'}
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex-1 py-4 px-6 bg-sky-600 text-white rounded-xl hover:bg-sky-700 font-bold text-lg shadow-lg transition"
          >
            {showHistory ? 'Hide History' : 'View Mission History'}
          </button>
        </div>

        {/* Mission History */}
        {showHistory && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-t-4 border-fuchsia-500">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Mission History</h2>
            {recentMissions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No missions saved yet.</p>
            ) : (
              <div className="space-y-4">
                {recentMissions.map((mission, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">Mission {mission.missionNumber}</h3>
                        <p className="text-sm text-gray-600">
                          {new Date(mission.timestamp).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          <strong>Pilot:</strong> {mission.pilotName} | <strong>Location:</strong> {mission.location}
                        </p>
                        <p className="text-sm text-gray-700">
                          <strong>Aircraft:</strong> {mission.aircraftType}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {mission.flightRecords.length} flight(s) recorded
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleExportPDF(mission)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-semibold transition"
                        >
                          Export PDF
                        </button>
                        <button
                          onClick={() => handleExportMission(mission)}
                          className="px-3 py-1 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700 text-sm font-semibold transition"
                        >
                          Export JSON
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 py-6 border-t">
          <p>UAS Pre-Flight Checklist System v2.0</p>
          <p className="mt-1">Auto-saves every change. Export as PDF for FAA compliance or JSON for backup.</p>
        </footer>
      </div>
    </div>
  );
};

export default UASChecklistApp;