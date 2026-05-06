"use client"

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { Analytics } from "@vercel/analytics/next"
import Image from 'next/image';
import Link from 'next/link';
import { CHECKLIST_SECTIONS, type ChecklistItem } from '@/lib/checklist-data';
import { downloadMissionPdf, type Photo } from '@/lib/pdf';
import { useSession, signOut } from '@/lib/auth-client';
import { fetchWeatherSnapshot, fetchWeatherForZip, reverseLookupZip } from '@/lib/noaa';
import {
  flushOutbox,
  getMission,
  listMissions,
  pendingCount,
  saveMission,
  updateMission,
  warmCacheFromServer,
} from '@/lib/missions-store';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { PhotoUploadButton } from './_components/photo-upload';
import { useRouter, useSearchParams } from 'next/navigation';

// --- TYPE DEFINITIONS ---
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
  photos?: Photo[];
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

// CHECKLIST_SECTIONS now lives in src/lib/checklist-data.ts so the PDF
// generator can import it without depending on this client component.
// NOAA + Census ZIP lookup live in src/lib/noaa.ts.

// --- STORAGE UTILITIES ---
// Mission history is now owned by src/lib/missions-store.ts (auth-aware:
// localStorage for anonymous, /api/missions + IndexedDB outbox for authed).
// The draft/WIP-mission and aircraft-profile keys below stay local-only.
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

const exportToPDF = async (mission: MissionLog): Promise<void> => {
  // Real PDF via src/lib/pdf.ts. Fixes the iOS Safari "open in print
  // dialog" issue from v3 §0 — jsPDF emits a real PDF blob the browser
  // can download as a file. async because photo embedding fetches
  // image data; downloadMissionPdf awaits all photos before save().
  await downloadMissionPdf({
    missionNumber: mission.missionNumber,
    timestamp: mission.timestamp,
    pilotName: mission.pilotName,
    location: mission.location,
    aircraftType: mission.aircraftType,
    rpCert: mission.rpCert,
    weather: mission.weather,
    completed: mission.completed,
    flightRecords: mission.flightRecords,
    photos: mission.photos,
  });
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
  const [missionNumber, setMissionNumber] = useState<string>(generateMissionNumber());
  // When set, Save calls PUT /api/missions/[id] instead of POST. The
  // dashboard's mission-edit affordance navigates here with ?edit=<id>;
  // the effect below loads the mission and hydrates form state.
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [pilotName, setPilotName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [aircraftType, setAircraftType] = useState<string>('');
  const [rpCert, setRpCert] = useState<string>('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  
  const [completed, setCompleted] = useState<{ [key: string]: boolean | string }>({});
  const [subValues, setSubValues] = useState<{ [key: string]: { [subId: string]: string } }>({});
  const [weather, setWeather] = useState<{ temperature?: string; wind?: string; precipitation?: string }>({});
  const [flightRecords, setFlightRecords] = useState<FlightRecord[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  
  const [recentMissions, setRecentMissions] = useState<MissionLog[]>([]);
  const [aircraftProfiles, setAircraftProfiles] = useState<AircraftProfile[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showProfiles, setShowProfiles] = useState<boolean>(false);
  const [loadingWeather, setLoadingWeather] = useState<boolean>(false);
  const [zipCode, setZipCode] = useState<string>('');
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const { data: session, isPending: sessionLoading } = useSession();
  const isOnline = useOnlineStatus();
  const authed = Boolean(session?.user);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const editIdFromUrl = searchParams.get('edit');

  // Edit-mode hydration: if /?edit=<id> and signed in, fetch the mission
  // and populate every form field. Sets editingMissionId so Save uses PUT.
  useEffect(() => {
    if (!editIdFromUrl || !authed || sessionLoading) return;
    let cancelled = false;
    (async () => {
      setEditLoadError(null);
      const m = await getMission(editIdFromUrl);
      if (cancelled) return;
      if (!m) {
        setEditLoadError(`Couldn't load mission ${editIdFromUrl}.`);
        return;
      }
      setMissionNumber(m.missionNumber);
      setPilotName(m.pilotName);
      setLocation(m.location);
      setAircraftType(m.aircraftType);
      setRpCert(m.rpCert);
      setSelectedProfileId(m.profileId ?? '');
      setCompleted(m.completed);
      setWeather(m.weather);
      setFlightRecords(m.flightRecords);
      setPhotos(m.photos ?? []);
      setEditingMissionId(editIdFromUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [editIdFromUrl, authed, sessionLoading]);

  // Load draft + aircraft profiles on mount (these stay localStorage-only).
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
      if (currentMission.photos) setPhotos(currentMission.photos);
    }
    setAircraftProfiles(getProfilesFromStorage());
  }, []);

  // Load mission history via missions-store. Re-runs when sign-in state
  // changes so the user sees their cloud missions on sign-in and falls
  // back to localStorage on sign-out.
  useEffect(() => {
    if (sessionLoading) return;
    let cancelled = false;
    (async () => {
      const missions = await listMissions(authed);
      if (!cancelled) setRecentMissions(missions);
      const count = authed ? await pendingCount() : 0;
      if (!cancelled) setPendingSyncCount(count);
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, sessionLoading]);

  // After sign-in, warm the IDB cache so the user sees their history when
  // they next go offline.
  useEffect(() => {
    if (authed && !sessionLoading) {
      void warmCacheFromServer();
    }
  }, [authed, sessionLoading]);

  // Drain the offline outbox whenever the network returns.
  useEffect(() => {
    if (!authed || !isOnline) return;
    let cancelled = false;
    (async () => {
      const result = await flushOutbox();
      if (cancelled) return;
      if (result.flushed > 0) {
        const missions = await listMissions(authed);
        if (!cancelled) setRecentMissions(missions);
      }
      setPendingSyncCount(result.remaining);
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, isOnline]);

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
      photos,
    };
    saveCurrentMission(currentMission);
  }, [pilotName, location, aircraftType, rpCert, selectedProfileId, completed, weather, flightRecords, photos]);

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
    if (!('geolocation' in navigator)) {
      setWeatherError('Geolocation not supported by this browser. Try the ZIP lookup.');
      return;
    }
    setLoadingWeather(true);
    setWeatherError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        // Run weather + reverse-ZIP in parallel; failures are independent.
        const [snapshot, zcta] = await Promise.all([
          fetchWeatherSnapshot(coords),
          reverseLookupZip(coords),
        ]);
        if (snapshot) {
          setWeather(snapshot);
        } else {
          setWeatherError("Couldn't reach NOAA. Try ZIP lookup or enter weather manually.");
        }
        if (zcta) setZipCode(zcta);
        setLoadingWeather(false);
      },
      () => {
        setWeatherError('Location access denied. Try ZIP lookup instead.');
        setLoadingWeather(false);
      },
    );
  };

  const handleFetchWeatherByZip = async () => {
    const zip = zipCode.trim();
    if (!/^\d{5}$/.test(zip)) {
      setWeatherError('Enter a 5-digit US ZIP code.');
      return;
    }
    setLoadingWeather(true);
    setWeatherError(null);
    const snapshot = await fetchWeatherForZip(zip);
    if (snapshot) {
      setWeather(snapshot);
    } else {
      setWeatherError(`Couldn't fetch weather for ${zip}. Check the ZIP or enter manually.`);
    }
    setLoadingWeather(false);
  };

  const handleSaveMission = async () => {
    if (!pilotName || !location || !aircraftType) {
      alert('Please fill in Pilot Name, Location, and Aircraft Type');
      return;
    }

    // Flatten subValues into completed
    const flattenedCompleted: { [key: string]: boolean | string } = { ...completed };
    Object.entries(subValues).forEach(([itemId, subFields]) => {
      Object.entries(subFields).forEach(([subId, value]) => {
        flattenedCompleted[`${itemId}_${subId}`] = value;
      });
    });

    const missionLog: MissionLog = {
      missionNumber,
      timestamp: new Date().toISOString(),
      pilotName,
      location,
      aircraftType,
      rpCert,
      profileId: selectedProfileId,
      completed: flattenedCompleted,
      weather,
      flightRecords,
      photos,
    };

    // missions-store handles auth-aware persistence: localStorage for
    // anonymous, /api/missions + IDB outbox for signed-in users. Edit
    // mode (set by ?edit=<id>) routes to PUT directly — online-only.
    if (editingMissionId) {
      try {
        await updateMission(editingMissionId, missionLog);
        alert(`Mission ${missionNumber} updated!`);
      } catch (err) {
        alert(`Update failed: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    } else {
      await saveMission(authed, missionLog);
      alert(`Mission ${missionNumber} saved!`);
    }

    const refreshed = await listMissions(authed);
    setRecentMissions(refreshed);
    if (authed) {
      setPendingSyncCount(await pendingCount());
    }
    setEditingMissionId(null);
    if (editIdFromUrl) {
      // Drop ?edit so a refresh doesn't re-hydrate the now-saved mission.
      router.replace('/');
    }
    resetForm();
  };

  const resetForm = () => {
    setCompleted({});
    setSubValues({});
    setWeather({});
    setFlightRecords([]);
    setPhotos([]);
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

  const handleExportPDF = async (mission: MissionLog) => {
    setExportingPdf(true);
    try {
      await exportToPDF(mission);
    } finally {
      setExportingPdf(false);
    }
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
        {/* Top bar — sync state (left) + sign-in affordance (right) */}
        <div className="flex justify-between items-center mb-4 gap-3">
          <div className="flex-1 min-w-0">
            {authed && !isOnline && (
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden />
                Offline
                {pendingSyncCount > 0 && ` · ${pendingSyncCount} pending`}
              </span>
            )}
            {authed && isOnline && pendingSyncCount > 0 && (
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" aria-hidden />
                Syncing {pendingSyncCount}…
              </span>
            )}
          </div>
          {sessionLoading ? (
            <div className="h-9 w-24 bg-gray-100 rounded-lg animate-pulse" aria-hidden />
          ) : session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 hidden sm:inline">{session.user.email}</span>
              <Link
                href="/dashboard"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold transition"
              >
                Dashboard
              </Link>
              <button
                onClick={() => signOut()}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-semibold transition"
            >
              Sign In
            </Link>
          )}
        </div>

        {(editingMissionId || editLoadError) && (
          <div className="mb-6 p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm">
            {editLoadError ? (
              <span className="text-red-700">{editLoadError}</span>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-amber-900">
                  Editing mission <strong>{missionNumber}</strong>. Save will update the existing record.
                </span>
                <button
                  onClick={() => {
                    setEditingMissionId(null);
                    router.replace('/');
                  }}
                  className="text-amber-900 underline hover:no-underline text-sm"
                >
                  Cancel edit
                </button>
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <header className="mb-8 text-center">
          <Analytics />
          <div className="flex items-center justify-center gap-4 mb-4">
            <Image
              width={80}
              height={80}
              src="/flywitus-platypus-logo.png" 
              alt="Fly Wit Us" 
              className="h-16 w-auto"
            />
            <h1 className="text-4xl font-extrabold text-gray-900">
              UAS <span className="text-sky-600">Pre-Flight Checklist</span>
            </h1>
          </div>
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
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={handleFetchWeather}
              disabled={loadingWeather}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition disabled:bg-gray-400"
            >
              {loadingWeather ? 'Fetching…' : 'Use My Location'}
            </button>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{5}"
                maxLength={5}
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ''))}
                placeholder="ZIP (e.g. 90210)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                disabled={loadingWeather}
              />
              <button
                onClick={handleFetchWeatherByZip}
                disabled={loadingWeather || zipCode.length !== 5}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-semibold transition disabled:bg-gray-400"
              >
                Lookup
              </button>
            </div>
          </div>
          {weatherError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {weatherError}
            </p>
          )}
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

        {/* Photos */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mt-6 border-t-4 border-fuchsia-500">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Photos</h2>
            <PhotoUploadButton
              onAdd={(photo) => setPhotos((prev) => [...prev, photo])}
            />
          </div>
          {photos.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No photos attached yet. Photos appear in the exported PDF.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((p, idx) => (
                <div key={`${p.url}-${idx}`} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption ?? `Mission photo ${idx + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPhotos((prev) => prev.filter((_, i) => i !== idx))
                    }
                    aria-label={`Remove photo ${idx + 1}`}
                    className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
                          disabled={exportingPdf}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-semibold transition disabled:bg-gray-400"
                        >
                          {exportingPdf ? 'Exporting…' : 'Export PDF'}
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
          <div className="flex items-center justify-center gap-3 mb-2">
          <Link 
            href="/roadmap" 
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
          >
            View Roadmap
          </Link>
            <Image
              width={80}
              height={80}
              src="/flywitus-platypus-logo.png" 
              alt="Fly Wit Us" 
              className="h-12 w-auto"
            />
            <div className="text-left">
              <p className="font-bold text-gray-700">FLY WIT US</p>
              <p className="text-xs">fly.witus.online</p>
            </div>
          </div>
          <p>UAS Pre-Flight Checklist System v2.0</p>
          <p className="mt-1">Auto-saves every change. Export as PDF for FAA compliance or JSON for backup.</p>
        </footer>
      </div>
    </div>
  );
};

// useSearchParams requires a Suspense boundary so the static shell can
// render while the dynamic params load on the client.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <UASChecklistApp />
    </Suspense>
  );
}