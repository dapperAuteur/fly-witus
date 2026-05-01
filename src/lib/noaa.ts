// Weather + ZIP lookup for the pre-flight checklist.
//
// Closes the launch-prep verify item:
//   "NOAA fetch succeeds for at least 50 zip codes spread across CONUS +
//    Alaska + Hawaii. Document any that fail with a graceful fallback."
//
// ZIP geocoding: api.zippopotam.us (free, keyless, US-supported, single
// endpoint that takes a 5-digit ZIP and returns lat/lon).
//
//   Why not Census? BAM's first-pick was Census.gov (also free, keyless),
//   but the Census "onelineaddress" geocoder returns empty addressMatches
//   for ZIP-only queries — it expects a street address. The proper
//   Census path for ZIP-to-latlon goes through the TigerWeb ZCTA REST
//   endpoint with ArcGIS query syntax, which is significantly more
//   complex for the same outcome. Zippopotam is the simplest free
//   alternative that maps to our exact use case.
//
// 12s timeout on every fetch. NOAA's first /points lookup can take 5–8s
// uncached, and Zippopotam cold-start connections from cellular/hotspot
// networks were observed timing out at 8s during smoke testing — 12s
// covers both without dragging on a true outage. Warm calls return in
// 1–4s, so this only matters for the first request after idle.
//
// Failures (timeout, network, parse) collapse to null. The page UI surfaces
// "Couldn't fetch" without leaking details — that's the "graceful fallback"
// the launch-prep doc requires.

const ZIPPOPOTAM = "https://api.zippopotam.us/us";
const NOAA_POINTS = "https://api.weather.gov/points";
const FETCH_TIMEOUT_MS = 12_000;

export interface LatLon {
  lat: number;
  lon: number;
}

export interface WeatherSnapshot {
  temperature: string;   // e.g. "72°F"
  wind: string;          // e.g. "5 to 10 mph NW"
  precipitation: string; // NOAA's "shortForecast" — e.g. "Mostly Sunny"
}

interface ZippopotamResponse {
  places?: Array<{
    latitude?: string;
    longitude?: string;
  }>;
}

interface NoaaPointResponse {
  properties?: { forecast?: string };
}

interface NoaaForecastResponse {
  properties?: {
    periods?: Array<{
      temperature: number;
      temperatureUnit: string;
      windSpeed: string;
      shortForecast: string;
    }>;
  };
}

function isValidUsZip(input: string): boolean {
  return /^\d{5}$/.test(input.trim());
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[noaa] ${url} → HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    // Timeout, network failure, JSON parse error — all collapse to null.
    // The UI surfaces "couldn't fetch" without leaking details.
    console.warn(`[noaa] fetch failed: ${url}`, err);
    return null;
  }
}

export async function lookupZip(rawZip: string): Promise<LatLon | null> {
  const zip = rawZip.trim();
  if (!isValidUsZip(zip)) return null;

  const data = await fetchJson<ZippopotamResponse>(`${ZIPPOPOTAM}/${zip}`);
  const place = data?.places?.[0];
  if (!place) return null;

  const lat = Number(place.latitude);
  const lon = Number(place.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat, lon };
}

export async function fetchWeatherSnapshot(coords: LatLon): Promise<WeatherSnapshot | null> {
  const pointUrl = `${NOAA_POINTS}/${coords.lat},${coords.lon}`;
  const point = await fetchJson<NoaaPointResponse>(pointUrl);
  const forecastUrl = point?.properties?.forecast;
  if (!forecastUrl) return null;

  const forecast = await fetchJson<NoaaForecastResponse>(forecastUrl);
  const current = forecast?.properties?.periods?.[0];
  if (!current) return null;

  return {
    temperature: `${current.temperature}°${current.temperatureUnit}`,
    wind: current.windSpeed,
    precipitation: current.shortForecast,
  };
}

export async function fetchWeatherForZip(zip: string): Promise<WeatherSnapshot | null> {
  const coords = await lookupZip(zip);
  if (!coords) return null;
  return fetchWeatherSnapshot(coords);
}
