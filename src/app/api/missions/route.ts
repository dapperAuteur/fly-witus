import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { flights, missionPhotos, missions } from "@/db/schema/missions";
import { requireUser } from "@/lib/api-auth";
import { missionInputSchema } from "@/lib/missions-api";
import { loadMissionForUser } from "@/lib/missions-queries";

// Node runtime — pg/drizzle require it. Cloud sync only — anonymous users
// stay on localStorage.

export async function GET() {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  // Fetch the user's missions newest-first, then batch-load flights and
  // photos for those missions in two more queries. Three round trips
  // total (vs N+1 for per-mission joins).
  const userMissions = await db
    .select()
    .from(missions)
    .where(eq(missions.userId, userOrRes.id))
    .orderBy(desc(missions.timestamp));

  if (userMissions.length === 0) {
    return NextResponse.json({ missions: [] });
  }

  const ids = userMissions.map((m) => m.id);
  const [allFlights, allPhotos] = await Promise.all([
    db.select().from(flights).where(inArray(flights.missionId, ids)),
    db.select().from(missionPhotos).where(inArray(missionPhotos.missionId, ids)),
  ]);

  const flightsByMission = groupBy(allFlights, (f) => f.missionId);
  const photosByMission = groupBy(allPhotos, (p) => p.missionId);

  const enriched = userMissions.map((m) => ({
    ...m,
    flights: (flightsByMission.get(m.id) ?? []).sort(
      (a, b) => a.flightNumber - b.flightNumber,
    ),
    photos: photosByMission.get(m.id) ?? [],
  }));

  return NextResponse.json({ missions: enriched });
}

export async function POST(req: Request) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = missionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid mission payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const missionId = nanoid();

  // Single transaction so a failed flight insert can't leave an orphan
  // mission row. The unique index on (userId, missionNumber) makes the
  // mission insert idempotent — duplicate POSTs (offline-outbox retry,
  // double-click) fail with PG error 23505 and we surface 409.
  try {
    await db.transaction(async (tx) => {
      await tx.insert(missions).values({
        id: missionId,
        userId: userOrRes.id,
        missionNumber: input.missionNumber,
        timestamp: new Date(input.timestamp),
        pilotName: input.pilotName ?? null,
        location: input.location ?? null,
        aircraftType: input.aircraftType ?? null,
        rpCert: input.rpCert ?? null,
        profileId: input.profileId ?? null,
        missionType: input.missionType,
        weatherTemperature: input.weather?.temperature ?? null,
        weatherWind: input.weather?.wind ?? null,
        weatherPrecipitation: input.weather?.precipitation ?? null,
        completed: input.completed,
        laancAuthorizationNumber: input.laancAuthorizationNumber ?? null,
        bvcEpisode: input.bvcEpisode ?? null,
        wanderlearnCourseSlug: input.wanderlearnCourseSlug ?? null,
        partnerInstitution: input.partnerInstitution ?? null,
        academicPurpose: input.academicPurpose ?? null,
      });

      if (input.flights.length > 0) {
        await tx.insert(flights).values(
          input.flights.map((f) => ({
            id: nanoid(),
            missionId,
            flightNumber: f.flightNumber,
            takeoffLocation: f.takeoffLocation ?? null,
            landingLocation: f.landingLocation ?? null,
            launchTime: f.launchTime ?? null,
            landingTime: f.landingTime ?? null,
            elapsedTime: f.elapsedTime ?? null,
            batteryVoltage: f.batteryVoltage ?? null,
            notes: f.notes ?? null,
          })),
        );
      }

      if (input.photos.length > 0) {
        await tx.insert(missionPhotos).values(
          input.photos.map((p) => ({
            id: nanoid(),
            missionId,
            url: p.url,
            caption: p.caption ?? null,
          })),
        );
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        {
          error: "Mission with that missionNumber already exists for this user",
          code: "DUPLICATE",
        },
        { status: 409 },
      );
    }
    throw err;
  }

  // Read back the canonical row so the client gets server-generated
  // timestamps/IDs in one round trip.
  const created = await loadMissionForUser(missionId, userOrRes.id);
  return NextResponse.json({ mission: created }, { status: 201 });
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

// PG unique-violation code — drizzle re-throws the underlying pg error.
function isUniqueViolation(err: unknown): boolean {
  return Boolean(
    err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505",
  );
}
