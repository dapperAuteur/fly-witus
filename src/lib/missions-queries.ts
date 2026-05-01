import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { flights, missionPhotos, missions } from "@/db/schema/missions";

// Shared by /api/missions and /api/missions/[id]. Returns the mission
// only if it belongs to the requesting user — null otherwise. The
// userId filter is the authorization gate; never call this without one.
export async function loadMissionForUser(missionId: string, userId: string) {
  const [mission] = await db
    .select()
    .from(missions)
    .where(and(eq(missions.id, missionId), eq(missions.userId, userId)))
    .limit(1);
  if (!mission) return null;

  const [missionFlights, missionPhotosRows] = await Promise.all([
    db.select().from(flights).where(eq(flights.missionId, missionId)),
    db.select().from(missionPhotos).where(eq(missionPhotos.missionId, missionId)),
  ]);

  return {
    ...mission,
    flights: missionFlights.sort((a, b) => a.flightNumber - b.flightNumber),
    photos: missionPhotosRows,
  };
}
