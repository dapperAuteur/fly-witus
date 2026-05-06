import type { Flight, Mission, MissionPhoto } from "@/db/schema/missions";

type LoadedMission = Mission & {
  flights: Flight[];
  photos: MissionPhoto[];
};

const NOTES_EXCERPT_MAX = 120;

export function buildCaptionFromMission(mission: LoadedMission): string {
  const header = [
    mission.aircraftType?.trim() || "Drone mission",
    mission.location?.trim() || "Field session",
  ].join(" · ");

  const flightCount = mission.flights.length;
  const flightLine =
    flightCount === 0
      ? null
      : `${flightCount} flight${flightCount === 1 ? "" : "s"} logged`;

  const firstNotes = mission.flights
    .map((f) => f.notes?.trim())
    .find((n): n is string => Boolean(n && n.length > 0));
  const notesExcerpt = firstNotes
    ? firstNotes.length > NOTES_EXCERPT_MAX
      ? `${firstNotes.slice(0, NOTES_EXCERPT_MAX - 1).trimEnd()}…`
      : firstNotes
    : null;

  return [header, flightLine, notesExcerpt].filter(Boolean).join("\n");
}
