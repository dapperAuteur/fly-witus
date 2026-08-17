// Shared between the page-level checklist UI (src/app/page.tsx) and the
// PDF generator (src/lib/pdf.ts). Pure data — no React, no localStorage,
// no side effects. Extracted from page.tsx in feat/track-e-pdf-jspdf so
// pdf.ts can render section headings and item labels without the page
// being its source of truth.

export interface ChecklistItemSubfield {
  id: string;
  label: string;
  type: "text" | "number";
}

export interface ChecklistItem {
  id: string;
  label: string;
  type: "checkbox" | "text" | "weather";
  required?: boolean;
  subfields?: ChecklistItemSubfield[];
}

export interface ChecklistSection {
  title: string;
  items: ChecklistItem[];
}

export const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    title: "Mission Checklist",
    items: [
      { id: "airport_notified", label: "Airport(s) Notified", type: "checkbox", required: true },
      { id: "location_ok", label: "Location is OK to fly", type: "checkbox", required: true },
      { id: "weather_ok", label: "Weather Forecast OK", type: "weather", required: true },
      { id: "firmware_updated", label: "Firmware up-to-date", type: "checkbox" },
      { id: "microsd_formatted", label: "MicroSD Card Formatted", type: "checkbox" },
    ],
  },
  {
    title: "Battery & Equipment",
    items: [
      {
        id: "uav_batteries_charged",
        label: "UAV Batteries Charged",
        type: "checkbox",
        required: true,
        subfields: [
          { id: "battery1", label: "Battery 1 volts", type: "number" },
          { id: "battery2", label: "Battery 2 volts", type: "number" },
          { id: "battery3", label: "Battery 3 volts", type: "number" },
          { id: "battery4", label: "Battery 4 volts", type: "number" },
        ],
      },
      { id: "controller_charged", label: "Controller Charged", type: "checkbox", required: true },
      { id: "tablet_charged", label: "Tablet Charged", type: "checkbox", required: true },
      { id: "phone_charged", label: "Mobile Phone Charged", type: "checkbox" },
    ],
  },
  {
    title: "Gear Packed",
    items: [
      { id: "gimbal_protector", label: "Gimbal Protector Installed", type: "checkbox" },
      { id: "propellers_packed", label: "Propellers Packed", type: "checkbox", required: true },
      { id: "cables_packed", label: "Cables Packed", type: "checkbox" },
      { id: "filters_packed", label: "Camera Filters Packed", type: "checkbox" },
      { id: "sunshade_packed", label: "Sun Shade Packed", type: "checkbox" },
      { id: "tools_packed", label: "Tools Packed", type: "checkbox" },
      { id: "flight_plan", label: "Flight Plan designed/entered in software", type: "checkbox" },
      { id: "logbook_packed", label: "Log Book Packed", type: "checkbox" },
    ],
  },
  {
    title: "Launch Site Checklist",
    items: [
      { id: "weather_verified", label: "Verify Weather is OK to Fly", type: "weather", required: true },
      { id: "safety_briefing", label: "Safety Briefing", type: "checkbox", required: true },
      { id: "obstacles_checked", label: "Check for obstacles, interference", type: "checkbox", required: true },
      { id: "human_activity", label: "Check for nearby human activity/dangerous situations", type: "checkbox", required: true },
      { id: "launch_pad_downwind", label: "Verify Launch Pad is down-wind from observers", type: "checkbox" },
      { id: "barriers_placed", label: "Launch Pad/Barriers Placed", type: "checkbox" },
    ],
  },
  {
    title: "Equipment Checklist",
    items: [
      { id: "airframe_inspected", label: "Airframe/Landing gear inspected", type: "checkbox", required: true },
      { id: "propellers_attached", label: "Propellers Inspected/Attached", type: "checkbox", required: true },
      { id: "controller_assembled", label: "Controller/Tablet Assembled", type: "checkbox", required: true },
      { id: "sd_installed", label: "SD Card Installed", type: "checkbox", required: true },
      { id: "battery_installed", label: "Battery Installed", type: "checkbox", required: true },
      { id: "gimbal_protector_removed", label: "Gimbal/Lens Protector Removed", type: "checkbox", required: true },
      { id: "filters_installed", label: "Camera Filters Installed", type: "checkbox" },
    ],
  },
  {
    title: "Pre-Flight Checklist",
    items: [
      { id: "aircraft_on_pad", label: "Aircraft Placed on Launch Pad", type: "checkbox", required: true },
      { id: "controller_on", label: "Turn on Remote Controller/Tablet/DJI Pilot App", type: "checkbox", required: true },
      { id: "antennas_positioned", label: "Antennas Properly Positioned", type: "checkbox", required: true },
      { id: "aircraft_on", label: "Turn on Aircraft", type: "checkbox", required: true },
      { id: "leds_checked", label: "Check the aircraft status LEDs", type: "checkbox", required: true },
      { id: "gimbal_level", label: "Verify the gimbal is level, can move unobstructed", type: "checkbox", required: true },
      { id: "rc_battery", label: "Check RC battery level", type: "checkbox", required: true },
      { id: "aircraft_battery", label: "Check Aircraft Battery Level", type: "checkbox", required: true },
      { id: "flight_mode", label: "Check flight mode switch (P-Mode)", type: "checkbox", required: true },
      { id: "satellite_compass", label: "Check Satellite and Compass status", type: "checkbox", required: true },
      { id: "rth_location", label: "Set RTH Location and height", type: "checkbox", required: true },
      { id: "camera_settings", label: "Check camera settings", type: "checkbox", required: true },
    ],
  },
  {
    title: "Take-Off Checklist",
    items: [
      { id: "launch_clear", label: "Check launch site is clear for take off", type: "checkbox", required: true },
      { id: "motors_started", label: "Start the motors", type: "checkbox", required: true },
      { id: "takeoff_hover", label: "Take off and hover", type: "checkbox", required: true },
      { id: "stable_hover", label: "Make sure the aircraft is stable while hovering", type: "checkbox", required: true },
      { id: "controls_responsive", label: "Check flight controls, make sure they respond as expected", type: "checkbox", required: true },
      { id: "recording_started", label: "Start recording video", type: "checkbox", required: true },
    ],
  },
  {
    title: "Post Flight Checklist",
    items: [
      { id: "battery_removed", label: "Remove Battery from Aircraft", type: "checkbox", required: true },
      { id: "gimbal_guard_installed", label: "Install Gimbal Guard", type: "checkbox", required: true },
      { id: "equipment_repacked", label: "Repack all equipment", type: "checkbox", required: true },
      { id: "flight_log_completed", label: "Complete the Flight Log", type: "checkbox", required: true },
    ],
  },
];

// --- Manned aircraft checklist (plans/08 Phase 2a) -------------------------
//
// READ THIS BEFORE EDITING THE LIST BELOW.
//
// THE POH/AFM IS AUTHORITATIVE. THIS IS NOT.
//
// Every certificated aircraft has a manufacturer checklist, and for any given
// airframe that document is the correct one — it is aircraft-specific, it is
// what the pilot was trained on, and it is what a checkride is flown to. A
// generic list cannot replace it and must never present itself as able to.
//
// So what is this for? The same thing the drone list is for: the parts of a
// pre-flight that happen BEFORE the airplane checklist starts, and that the
// POH does not cover because they are not about the airplane — documents,
// weather against your own limits, daylight, and the decision itself. Plus a
// coarse airframe-agnostic frame that a pilot extends with their own items
// through the custom-checklist field (roadmap m4), which is where the real
// aircraft-specific content belongs.
//
// The wording throughout is deliberately non-directive: "confirm against your
// POH", not "set flaps 10". We do not tell anyone how to fly their aircraft.
//
// This list has NOT been reviewed by a CFI — see
// plans/user-tasks/27-bam-source-cfi-rule-reviewer.md. It is content, not
// regulatory logic, which is why it is not behind the documents-locker
// feature flag; but it should still get a domain read before it is marketed
// at manned pilots.
export const MANNED_CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    title: "Before You Go",
    items: [
      { id: "m_poh_aboard", label: "POH/AFM checklist for this aircraft is with me", type: "checkbox", required: true },
      { id: "m_weather_reviewed", label: "Weather reviewed for departure, route, and destination", type: "weather", required: true },
      { id: "m_minimums_checked", label: "Conditions checked against my personal minimums", type: "checkbox", required: true },
      { id: "m_daylight_checked", label: "Daylight and twilight times checked for this flight", type: "checkbox" },
      { id: "m_notams", label: "NOTAMs and TFRs checked", type: "checkbox", required: true },
      { id: "m_airspace", label: "Airspace and any required authorizations reviewed", type: "checkbox", required: true },
      { id: "m_fuel_plan", label: "Fuel plan confirmed, including reserves", type: "checkbox", required: true },
      { id: "m_wb", label: "Weight and balance computed for this load", type: "checkbox", required: true },
      { id: "m_performance", label: "Takeoff and landing performance computed for today's conditions", type: "checkbox", required: true },
      { id: "m_alternate", label: "Alternate plan if this does not work out", type: "checkbox" },
    ],
  },
  {
    title: "Documents",
    items: [
      { id: "m_doc_pilot_cert", label: "Pilot certificate", type: "checkbox", required: true },
      { id: "m_doc_photo_id", label: "Government photo ID", type: "checkbox", required: true },
      { id: "m_doc_medical", label: "Medical certificate, BasicMed, or the qualifying document for my operation", type: "checkbox", required: true },
      { id: "m_doc_endorsements", label: "Logbook and endorsements, if required for this flight", type: "checkbox" },
      { id: "m_doc_aircraft", label: "Aircraft documents aboard and current (airworthiness, registration, operating limitations, weight and balance)", type: "checkbox", required: true },
      { id: "m_doc_radio", label: "Radio station licence, if the operation requires one", type: "checkbox" },
    ],
  },
  {
    title: "Walk-Around",
    items: [
      { id: "m_walk_poh", label: "Walk-around flown to the POH/AFM sequence", type: "checkbox", required: true },
      { id: "m_fuel_quantity", label: "Fuel quantity visually confirmed, not just gauge-read", type: "checkbox", required: true },
      { id: "m_fuel_sumped", label: "Fuel sumped and checked for water and debris", type: "checkbox", required: true },
      { id: "m_oil", label: "Oil quantity checked", type: "checkbox", required: true },
      { id: "m_control_surfaces", label: "Control surfaces free and correct", type: "checkbox", required: true },
      { id: "m_tires_brakes", label: "Tyres, brakes, and struts checked", type: "checkbox", required: true },
      { id: "m_covers_removed", label: "Covers, plugs, chocks, and tie-downs removed", type: "checkbox", required: true },
      { id: "m_damage", label: "No new damage or leaks found", type: "checkbox", required: true },
    ],
  },
  {
    title: "Cabin and Passengers",
    items: [
      { id: "m_pax_brief", label: "Passenger briefing given (belts, doors, exits, sterile cockpit, no-smoking)", type: "checkbox", required: true },
      { id: "m_belts", label: "Seats and belts secured", type: "checkbox", required: true },
      { id: "m_baggage", label: "Baggage secured and within limits", type: "checkbox", required: true },
      { id: "m_controls_free", label: "Controls free and correct from the seat", type: "checkbox", required: true },
    ],
  },
  {
    title: "Before Takeoff",
    items: [
      { id: "m_runup", label: "Run-up completed per the POH/AFM", type: "checkbox", required: true },
      { id: "m_instruments", label: "Instruments set and cross-checked", type: "checkbox", required: true },
      { id: "m_departure_brief", label: "Departure briefing given, including abort point and engine-failure plan", type: "checkbox", required: true },
      { id: "m_wind_check", label: "Wind and crosswind component re-checked against my limits", type: "checkbox", required: true },
      { id: "m_final_go", label: "Final go/no-go decision made", type: "checkbox", required: true },
    ],
  },
  {
    title: "After the Flight",
    items: [
      { id: "m_secured", label: "Aircraft secured (tie-downs, chocks, controls locked, covers on)", type: "checkbox", required: true },
      { id: "m_squawks", label: "Any squawks recorded and reported", type: "checkbox", required: true },
      { id: "m_logged", label: "Flight logged", type: "checkbox", required: true },
    ],
  },
];

/** Which base checklist a given aircraft platform uses. */
export function checklistForPlatform(platform: "uas" | "manned"): ChecklistSection[] {
  return platform === "manned" ? MANNED_CHECKLIST_SECTIONS : CHECKLIST_SECTIONS;
}

/**
 * Build the sections to render, appending a profile's own items as a final
 * section (roadmap m4).
 *
 * Custom items are given stable ids derived from their position so that a
 * saved mission keeps pointing at the right item. That does mean REORDERING
 * or DELETING a custom item shifts the ids of the ones after it, which would
 * re-associate completion state on an already-saved mission. Acceptable while
 * these are edit-in-place strings on a profile; if custom items ever get their
 * own identity, give them real ids and migrate.
 */
export function buildChecklistSections(
  platform: "uas" | "manned",
  customItems: string[] = [],
): ChecklistSection[] {
  const base = checklistForPlatform(platform);
  const cleaned = customItems.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) return base;

  return [
    ...base,
    {
      title: "Your Items",
      items: cleaned.map((label, idx) => ({
        id: `custom_${idx}`,
        label,
        type: "checkbox" as const,
      })),
    },
  ];
}
