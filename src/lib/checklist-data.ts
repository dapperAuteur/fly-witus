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
