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
// Reverse geocode latlon → ZCTA (5-digit ZIP-like statistical area). Census's
// ZIP→latlon path needs a street address, but the latlon→ZCTA path through
// the geographies endpoint is straightforward — single GET, JSON response.
// ZCTAs aren't 1:1 with USPS ZIPs (≈1% of cases differ) but match the
// existing Zippopotam tolerance and are sufficient for "where is the user
// roughly" + downstream weather lookup.
const CENSUS_GEOCODER =
  "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";
const FETCH_TIMEOUT_MS = 12_000;

export interface LatLon {
  lat: number;
  lon: number;
}

export interface WeatherSnapshot {
  temperature: string;   // e.g. "72°F"
  wind: string;          // e.g. "5 to 10 mph NW"
  precipitation: string; // NOAA's "shortForecast" — e.g. "Mostly Sunny"

  // --- Structured values, added for personal minimums (roadmap n3) ---
  //
  // The three fields above are display strings and always have been; they are
  // what gets written to the mission record and rendered in the PDF, and they
  // keep that job unchanged. But "5 to 10 mph" cannot be compared to a pilot's
  // stated limit, so anything that has to answer "is this outside what you fly
  // in" needs numbers.
  //
  // ALL OF THESE ARE OPTIONAL, AND THAT IS NOT DEFENSIVE PADDING. The NWS
  // gridpoint feed genuinely omits fields: checking the Denver gridpoint on
  // 2026-08-16, `visibility` and `ceilingHeight` were present as keys with
  // completely empty value arrays, while windSpeed, windGust, windDirection
  // and skyCover were populated. Coverage varies by office and by forecast
  // horizon. A minimums check that treats "absent" as "fine" would hand a
  // pilot a green light built on nothing, so callers must branch on undefined
  // rather than defaulting.
  windSpeedKt?: number;
  windGustKt?: number;
  windDirectionDeg?: number;
  /** Cloud cover percentage. Not a ceiling — NWS rarely populates ceiling. */
  skyCoverPercent?: number;
}

interface ZippopotamResponse {
  places?: Array<{
    latitude?: string;
    longitude?: string;
  }>;
}

interface NoaaPointResponse {
  properties?: { forecast?: string; forecastGridData?: string };
}

/**
 * The raw gridpoint feed. Each quantitative property carries its own unit code
 * plus a list of time-bounded values.
 *
 * `validTime` is an ISO 8601 interval — "2026-08-16T13:00:00+00:00/PT2H" —
 * meaning this value holds for 2 hours from that start. Entries are not
 * uniformly spaced and the properties do not share a time grid: on the Denver
 * gridpoint, windSpeed had 72 entries, windGust 98, and windDirection 122 over
 * the same window. Each property therefore has to be searched independently
 * for the interval covering the moment we care about.
 */
interface NoaaGridpointValue {
  validTime: string;
  value: number | null;
}

interface NoaaGridpointProperty {
  /** WMO unit code, e.g. "wmoUnit:km_h-1". Read it; do not assume mph. */
  uom?: string;
  values?: NoaaGridpointValue[];
}

interface NoaaGridpointResponse {
  properties?: {
    windSpeed?: NoaaGridpointProperty;
    windGust?: NoaaGridpointProperty;
    windDirection?: NoaaGridpointProperty;
    skyCover?: NoaaGridpointProperty;
  };
}

interface CensusZctaEntry {
  ZCTA5?: string;
  GEOID?: string;
}

interface CensusGeographyResponse {
  result?: {
    // Key shape: "{vintage-year} Census ZIP Code Tabulation Areas" — e.g.
    // "2020 Census ZIP Code Tabulation Areas". Year prefix changes when
    // Census rolls a new vintage; we match by regex below to stay robust.
    geographies?: Record<string, CensusZctaEntry[]>;
  };
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

// --- Gridpoint parsing (structured values for personal minimums) ----------

/**
 * Convert a speed to knots based on the WMO unit code the API reported.
 *
 * Aviation works in knots, and NWS does not: the Denver gridpoint returns
 * wind in `wmoUnit:km_h-1`. Converting on an assumed unit is precisely the
 * bug this function exists to prevent — reading "5.556" as mph instead of
 * km/h would understate a 3 kt wind as 5 kt, and the same error at the top of
 * the scale turns a 43 kt gust into a 65 kt one.
 *
 * Returns null for an unrecognised unit rather than guessing. A missing
 * number is recoverable; a silently wrong one is not.
 */
function speedToKnots(value: number, unitCode: string | undefined): number | null {
  if (!Number.isFinite(value)) return null;

  // Unit codes arrive namespaced ("wmoUnit:km_h-1"); compare on the suffix.
  const unit = (unitCode ?? "").split(":").pop()?.trim();

  switch (unit) {
    case "km_h-1":
      return value / 1.852;
    case "m_s-1":
      return value * 1.9438444924406;
    case "mi_h-1":
      return value / 1.150779448;
    case "kt":
    case "kn":
      return value;
    default:
      console.warn(`[noaa] unrecognised speed unit '${unitCode}' — dropping value`);
      return null;
  }
}

/**
 * Parse an ISO 8601 interval of the form "<start>/<duration>" into start and
 * end epoch milliseconds. Returns null if either half is unparseable.
 *
 * Only the duration forms NWS actually emits are handled — whole days, hours,
 * and minutes (PT2H, P1DT6H, PT30M). A duration we cannot read yields null and
 * the entry is skipped, which loses one sample rather than mis-dating it.
 */
function parseValidTimeInterval(
  validTime: string,
): { start: number; end: number } | null {
  const [startText, durationText] = validTime.split("/");
  if (!startText || !durationText) return null;

  const start = Date.parse(startText);
  if (Number.isNaN(start)) return null;

  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    durationText,
  );
  if (!match) return null;

  const [, days, hours, minutes, seconds] = match;
  const durationMs =
    (Number(days ?? 0) * 86400 +
      Number(hours ?? 0) * 3600 +
      Number(minutes ?? 0) * 60 +
      Number(seconds ?? 0)) *
    1000;

  // A zero-length interval means we failed to read the duration parts.
  if (durationMs <= 0) return null;

  return { start, end: start + durationMs };
}

/**
 * The value covering `at`, or the soonest one after it.
 *
 * Falling forward matters: a pre-flight check run at 06:00 for a flight later
 * that morning should not come back empty because the forecast series happens
 * to start at 07:00. What it must never do is fall BACKWARD to a stale value,
 * so entries that ended before `at` are discarded outright.
 */
function valueAt(
  property: NoaaGridpointProperty | undefined,
  at: number,
): number | null {
  const entries = property?.values;
  if (!entries?.length) return null;

  let soonestUpcoming: { start: number; value: number } | null = null;

  for (const entry of entries) {
    if (entry.value === null || !Number.isFinite(entry.value)) continue;
    const interval = parseValidTimeInterval(entry.validTime);
    if (!interval) continue;

    if (at >= interval.start && at < interval.end) return entry.value;

    if (
      interval.start > at &&
      (soonestUpcoming === null || interval.start < soonestUpcoming.start)
    ) {
      soonestUpcoming = { start: interval.start, value: entry.value };
    }
  }

  return soonestUpcoming?.value ?? null;
}

/**
 * Pull structured wind and sky-cover values from the gridpoint feed.
 *
 * Every field is independently optional — see the note on WeatherSnapshot.
 * Returns an empty object rather than null on failure so the caller can spread
 * it unconditionally; a total failure here degrades the snapshot to the
 * display strings it has always had, which is the pre-existing behaviour.
 */
async function fetchStructuredWeather(
  gridDataUrl: string,
  at: Date = new Date(),
): Promise<Partial<WeatherSnapshot>> {
  const grid = await fetchJson<NoaaGridpointResponse>(gridDataUrl);
  const props = grid?.properties;
  if (!props) return {};

  const moment = at.getTime();
  const result: Partial<WeatherSnapshot> = {};

  const rawSpeed = valueAt(props.windSpeed, moment);
  if (rawSpeed !== null) {
    const knots = speedToKnots(rawSpeed, props.windSpeed?.uom);
    if (knots !== null) result.windSpeedKt = Math.round(knots);
  }

  const rawGust = valueAt(props.windGust, moment);
  if (rawGust !== null) {
    const knots = speedToKnots(rawGust, props.windGust?.uom);
    if (knots !== null) result.windGustKt = Math.round(knots);
  }

  const rawDirection = valueAt(props.windDirection, moment);
  if (rawDirection !== null && Number.isFinite(rawDirection)) {
    // Normalise to [0, 360) — NWS reports degrees true.
    result.windDirectionDeg = ((Math.round(rawDirection) % 360) + 360) % 360;
  }

  const rawSky = valueAt(props.skyCover, moment);
  if (rawSky !== null && Number.isFinite(rawSky)) {
    result.skyCoverPercent = Math.round(rawSky);
  }

  return result;
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

  const gridDataUrl = point?.properties?.forecastGridData;

  // Both requests go out together — the gridpoint feed is a separate endpoint
  // from the narrative forecast, and running them in series would add a full
  // round trip (up to 12s on the timeout budget) to every weather fetch.
  const [forecast, structured] = await Promise.all([
    fetchJson<NoaaForecastResponse>(forecastUrl),
    gridDataUrl ? fetchStructuredWeather(gridDataUrl) : Promise.resolve({}),
  ]);

  const current = forecast?.properties?.periods?.[0];
  if (!current) return null;

  // The display strings stay the contract they have always been. The
  // structured values are spread on top and are simply absent when the
  // gridpoint call fails or the office does not publish that field — the
  // snapshot degrades to exactly its previous behaviour rather than failing.
  return {
    temperature: `${current.temperature}°${current.temperatureUnit}`,
    wind: current.windSpeed,
    precipitation: current.shortForecast,
    ...structured,
  };
}

export async function fetchWeatherForZip(zip: string): Promise<WeatherSnapshot | null> {
  const coords = await lookupZip(zip);
  if (!coords) return null;
  return fetchWeatherSnapshot(coords);
}

export async function reverseLookupZip(coords: LatLon): Promise<string | null> {
  // Census actually names the layer "{year} Census ZIP Code Tabulation Areas"
  // (currently 2020). Pass that exact name in the request; if the layers
  // param is unrecognized Census silently falls back to a default layer
  // set that EXCLUDES ZCTAs — that was the original bug.
  const params = new URLSearchParams({
    x: String(coords.lon),
    y: String(coords.lat),
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    layers: "2020 Census ZIP Code Tabulation Areas",
    format: "json",
  });
  const data = await fetchJson<CensusGeographyResponse>(
    `${CENSUS_GEOCODER}?${params.toString()}`,
  );
  // Match by regex so a future vintage bump (2030 Census ZCTA, etc.)
  // doesn't break parsing — only the request layer name needs updating.
  const geographies = data?.result?.geographies ?? {};
  const zctaList = Object.entries(geographies).find(([key]) =>
    /ZIP Code Tabulation Areas/i.test(key),
  )?.[1];
  const match = zctaList?.[0];
  const code = match?.ZCTA5 ?? match?.GEOID;
  if (!code || !/^\d{5}$/.test(code)) return null;
  return code;
}
