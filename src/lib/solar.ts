// Solar position — sunrise, sunset, civil twilight, and the conventional
// night window, computed from latitude/longitude and a calendar date.
//
// WHY THIS IS LOCAL MATH AND NOT AN API CALL
//
// Every hosted sunrise/sunset API is a network dependency, and this app is
// offline-first (service worker + IndexedDB outbox). A pilot standing in a
// field with no signal still needs to know when the light goes. The NOAA
// solar equations are a closed-form calculation accurate to well under a
// minute for any latitude a UAS or GA aircraft will operate at, so there is
// no reason to take a network dependency for it.
//
// ACCURACY AND ITS LIMITS
//
// Times are computed for sea level with a standard refraction allowance
// (the 90.833° zenith below). Real sunset is later from altitude and varies
// with temperature and pressure. Treat the output as accurate to about a
// minute, and never as a legal boundary — see the note on regulations.
//
// ON REGULATIONS — READ BEFORE ADDING A COMPLIANCE CLAIM
//
// This module deliberately computes *astronomy*, not *legality*. It exposes
// sunrise, sunset, civil twilight, and a conventional "night window" running
// from one hour after sunset to one hour before sunrise. It does not decide
// whether any given operation is permitted.
//
// That line matters. Regulatory definitions of night and of daylight
// operation differ between rule sets, have changed over time (Part 107 night
// operations changed materially in 2021), and depend on equipment and
// authorizations this module knows nothing about. If a caller wants to state
// a rule, it must read the current eCFR, cite the section in the UI, and
// frame the result as advisory — see plans/08 §7. Do not encode a compliance
// conclusion in here.
//
// Reference: the NOAA Solar Calculator equations (themselves derived from
// Meeus, "Astronomical Algorithms"). Verify with scripts/verify-solar.ts.

/** Zenith angle at which the sun's upper limb touches the horizon, including
 *  the standard atmospheric-refraction allowance. */
const ZENITH_SUNRISE_SUNSET = 90.833;

/** Zenith angle defining civil twilight — sun 6° below the horizon. */
const ZENITH_CIVIL_TWILIGHT = 96;

/** The conventional night window runs from one hour after sunset to one hour
 *  before sunrise. Exposed as a constant so the offset is auditable rather
 *  than a magic number buried in the arithmetic. */
const NIGHT_WINDOW_OFFSET_MS = 60 * 60 * 1000;

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/**
 * What the sun does on a given day at a given latitude.
 *
 * - `normal`     — the sun rises and sets.
 * - `always-up`  — midnight sun; the sun never drops below the horizon.
 * - `always-down`— polar night; the sun never climbs above it.
 *
 * The polar cases are not hypothetical for this product: Fly WitUS supports
 * Alaska, and the NOAA smoke test in scripts/noaa-sweep.ts already covers
 * Alaskan ZIPs. Above the Arctic Circle these are the correct answer for
 * weeks at a time, and returning NaN there would silently poison every
 * downstream daylight calculation.
 */
export type SolarDayKind = "normal" | "always-up" | "always-down";

export interface SolarTimes {
  kind: SolarDayKind;
  /** Local solar noon — always defined, even in the polar cases. */
  solarNoon: Date;
  /** Null unless `kind` is 'normal'. */
  sunrise: Date | null;
  /** Null unless `kind` is 'normal'. */
  sunset: Date | null;
  /** Start of civil twilight (dawn). Null if the sun never reaches -6°. */
  civilTwilightBegin: Date | null;
  /** End of civil twilight (dusk). Null if the sun never reaches -6°. */
  civilTwilightEnd: Date | null;
  /** One hour after this day's sunset. Null unless `kind` is 'normal'. */
  nightWindowStart: Date | null;
  /**
   * One hour before the NEXT day's sunrise — the night window spans midnight,
   * so its end belongs to tomorrow, not today. Null if either this day or the
   * next is not `normal`.
   */
  nightWindowEnd: Date | null;
}

interface SolarGeometry {
  /** Solar declination in degrees. */
  declination: number;
  /** Equation of time in minutes. */
  equationOfTime: number;
}

/**
 * Julian day for 00:00 UTC on the given proleptic Gregorian calendar date.
 * Standard algorithm; month is 1-based.
 */
function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    b -
    1524.5
  );
}

/** Solar declination and equation of time for a Julian century. */
function solarGeometry(julianCentury: number): SolarGeometry {
  const t = julianCentury;

  // Geometric mean longitude of the sun, degrees, normalised to [0, 360).
  const meanLong = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const geomMeanLong = meanLong < 0 ? meanLong + 360 : meanLong;

  // Geometric mean anomaly of the sun, degrees.
  const geomMeanAnom = 357.52911 + t * (35999.05029 - 0.0001537 * t);

  // Eccentricity of Earth's orbit, unitless.
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  // Equation of centre, degrees.
  const equationOfCentre =
    Math.sin(toRad(geomMeanAnom)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(toRad(2 * geomMeanAnom)) * (0.019993 - 0.000101 * t) +
    Math.sin(toRad(3 * geomMeanAnom)) * 0.000289;

  const trueLong = geomMeanLong + equationOfCentre;

  // Apparent longitude corrects for nutation and aberration.
  const apparentLong =
    trueLong - 0.00569 - 0.00478 * Math.sin(toRad(125.04 - 1934.136 * t));

  // Mean obliquity of the ecliptic, degrees, plus the nutation correction.
  const meanObliquity =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquityCorrected =
    meanObliquity + 0.00256 * Math.cos(toRad(125.04 - 1934.136 * t));

  const declination = toDeg(
    Math.asin(Math.sin(toRad(obliquityCorrected)) * Math.sin(toRad(apparentLong))),
  );

  // Equation of time, minutes. `y` is the standard auxiliary term.
  const y = Math.tan(toRad(obliquityCorrected / 2)) ** 2;
  const equationOfTime =
    4 *
    toDeg(
      y * Math.sin(2 * toRad(geomMeanLong)) -
        2 * eccentricity * Math.sin(toRad(geomMeanAnom)) +
        4 *
          eccentricity *
          y *
          Math.sin(toRad(geomMeanAnom)) *
          Math.cos(2 * toRad(geomMeanLong)) -
        0.5 * y * y * Math.sin(4 * toRad(geomMeanLong)) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * toRad(geomMeanAnom)),
    );

  return { declination, equationOfTime };
}

/**
 * Hour angle in degrees for the sun to sit at `zenith` at the given latitude
 * and declination.
 *
 * Returns null when the sun never reaches that zenith on this day — the
 * cosine falls outside [-1, 1] and `acos` would produce NaN. Callers must
 * distinguish the two out-of-range directions themselves via
 * `sunAlwaysAbove`, because "no sunrise" and "no sunset" are opposite
 * answers that both land here.
 */
function hourAngle(
  latitude: number,
  declination: number,
  zenith: number,
): number | null {
  const cosH =
    Math.cos(toRad(zenith)) /
      (Math.cos(toRad(latitude)) * Math.cos(toRad(declination))) -
    Math.tan(toRad(latitude)) * Math.tan(toRad(declination));

  if (cosH > 1 || cosH < -1) return null;
  return toDeg(Math.acos(cosH));
}

/**
 * True when the out-of-range hour angle means the sun stays ABOVE the given
 * zenith all day (midnight sun) rather than below it (polar night).
 */
function sunAlwaysAbove(
  latitude: number,
  declination: number,
  zenith: number,
): boolean {
  const cosH =
    Math.cos(toRad(zenith)) /
      (Math.cos(toRad(latitude)) * Math.cos(toRad(declination))) -
    Math.tan(toRad(latitude)) * Math.tan(toRad(declination));
  // cosH < -1 means the required hour angle exceeds 180° — the sun never
  // descends to the zenith, so it is up the whole day.
  return cosH < -1;
}

/** Convert "minutes after 00:00 UTC on this date" to a real Date. */
function minutesUtcToDate(
  year: number,
  month: number,
  day: number,
  minutes: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day) + minutes * MS_PER_MINUTE);
}

/**
 * Solar times for an explicit calendar date. This is the primitive — it takes
 * the date as separate components so there is no ambiguity about which
 * timezone's "today" is meant, which makes it deterministic to verify.
 *
 * @param latitude  Degrees north, negative for south.
 * @param longitude Degrees east, negative for west. (US longitudes are negative.)
 * @param year      Full year, e.g. 2026.
 * @param month     1-based month, 1 = January.
 * @param day       Day of month.
 *
 * All returned Dates are absolute instants; format them in whatever timezone
 * the UI needs.
 */
export function solarTimesForCalendarDate(
  latitude: number,
  longitude: number,
  year: number,
  month: number,
  day: number,
): SolarTimes {
  const jd = julianDay(year, month, day);
  const julianCentury = (jd - 2451545) / 36525;
  const { declination, equationOfTime } = solarGeometry(julianCentury);

  // Solar noon in minutes after 00:00 UTC. The longitude term is what moves
  // this off 12:00 — 4 minutes of time per degree of longitude.
  const solarNoonMinutes = 720 - 4 * longitude - equationOfTime;
  const solarNoon = minutesUtcToDate(year, month, day, solarNoonMinutes);

  const riseSetHa = hourAngle(latitude, declination, ZENITH_SUNRISE_SUNSET);
  const twilightHa = hourAngle(latitude, declination, ZENITH_CIVIL_TWILIGHT);

  let kind: SolarDayKind = "normal";
  if (riseSetHa === null) {
    kind = sunAlwaysAbove(latitude, declination, ZENITH_SUNRISE_SUNSET)
      ? "always-up"
      : "always-down";
  }

  const sunrise =
    riseSetHa === null
      ? null
      : minutesUtcToDate(year, month, day, solarNoonMinutes - 4 * riseSetHa);
  const sunset =
    riseSetHa === null
      ? null
      : minutesUtcToDate(year, month, day, solarNoonMinutes + 4 * riseSetHa);

  const civilTwilightBegin =
    twilightHa === null
      ? null
      : minutesUtcToDate(year, month, day, solarNoonMinutes - 4 * twilightHa);
  const civilTwilightEnd =
    twilightHa === null
      ? null
      : minutesUtcToDate(year, month, day, solarNoonMinutes + 4 * twilightHa);

  // The night window ends against TOMORROW's sunrise, so we need the next
  // day's geometry. Computed inline rather than by recursing into this
  // function, which would recurse forever chasing successive tomorrows.
  let nightWindowEnd: Date | null = null;
  if (sunset) {
    const nextUtc = new Date(Date.UTC(year, month - 1, day) + MS_PER_DAY);
    const nextY = nextUtc.getUTCFullYear();
    const nextM = nextUtc.getUTCMonth() + 1;
    const nextD = nextUtc.getUTCDate();

    const nextJd = julianDay(nextY, nextM, nextD);
    const nextGeom = solarGeometry((nextJd - 2451545) / 36525);
    const nextNoonMinutes = 720 - 4 * longitude - nextGeom.equationOfTime;
    const nextHa = hourAngle(
      latitude,
      nextGeom.declination,
      ZENITH_SUNRISE_SUNSET,
    );

    if (nextHa !== null) {
      const nextSunrise = minutesUtcToDate(
        nextY,
        nextM,
        nextD,
        nextNoonMinutes - 4 * nextHa,
      );
      nightWindowEnd = new Date(nextSunrise.getTime() - NIGHT_WINDOW_OFFSET_MS);
    }
  }

  return {
    kind,
    solarNoon,
    sunrise,
    sunset,
    civilTwilightBegin,
    civilTwilightEnd,
    nightWindowStart: sunset
      ? new Date(sunset.getTime() + NIGHT_WINDOW_OFFSET_MS)
      : null,
    nightWindowEnd,
  };
}

/**
 * Solar times for the calendar date that `date` falls on **in the runtime's
 * local timezone**.
 *
 * This is the convenience wrapper for client code. On the client the runtime
 * timezone is the browser's, which is the pilot's, which is the launch site's
 * in essentially every real case — a pilot opens the app where they are
 * standing. Server-side callers should prefer
 * `solarTimesForCalendarDate` and pass the date components explicitly, since
 * the server's timezone has nothing to do with the pilot's.
 */
export function solarTimes(
  latitude: number,
  longitude: number,
  date: Date = new Date(),
): SolarTimes {
  return solarTimesForCalendarDate(
    latitude,
    longitude,
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
}

/** Length of the day in minutes, or null in the polar cases. */
export function dayLengthMinutes(times: SolarTimes): number | null {
  if (!times.sunrise || !times.sunset) return null;
  return (times.sunset.getTime() - times.sunrise.getTime()) / MS_PER_MINUTE;
}

/**
 * How long until sunset from `now`, in minutes. Negative once the sun is
 * down. Null in the polar cases, where "time until sunset" has no answer.
 *
 * This is the daylight-margin input to the pre-flight risk score: a flight
 * planned to end twenty minutes before sunset carries a different risk than
 * one ending at midday, and that gap is the number that expresses it.
 */
export function minutesUntilSunset(
  times: SolarTimes,
  now: Date = new Date(),
): number | null {
  if (!times.sunset) return null;
  return (times.sunset.getTime() - now.getTime()) / MS_PER_MINUTE;
}

/** Whether `instant` falls between sunrise and sunset. */
export function isDaylight(times: SolarTimes, instant: Date): boolean {
  if (times.kind === "always-up") return true;
  if (times.kind === "always-down") return false;
  if (!times.sunrise || !times.sunset) return false;
  const t = instant.getTime();
  return t >= times.sunrise.getTime() && t <= times.sunset.getTime();
}

/**
 * Whether `instant` falls inside the conventional night window — one hour
 * after sunset to one hour before the next sunrise.
 *
 * Astronomy only. This answers "is it night by the usual definition", NOT
 * "is a night operation permitted" — see the regulations note at the top of
 * this file before wiring it to anything that states a rule.
 */
export function isWithinNightWindow(times: SolarTimes, instant: Date): boolean {
  if (!times.nightWindowStart || !times.nightWindowEnd) return false;
  const t = instant.getTime();
  return t >= times.nightWindowStart.getTime() && t <= times.nightWindowEnd.getTime();
}

/** Format a solar Date for display, or an em dash when it does not exist. */
export function formatSolarTime(
  value: Date | null,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
): string {
  if (!value) return "—";
  return value.toLocaleTimeString([], options);
}
