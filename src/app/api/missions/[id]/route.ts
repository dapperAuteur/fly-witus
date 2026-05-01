import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { flights, missionPhotos, missions } from "@/db/schema/missions";
import { requireUser } from "@/lib/api-auth";
import { missionInputSchema } from "@/lib/missions-api";
import { loadMissionForUser } from "@/lib/missions-queries";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Params) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id } = await ctx.params;
  const mission = await loadMissionForUser(id, userOrRes.id);
  if (!mission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ mission });
}

// PUT replaces the whole mission record (full-document semantics matches
// what the offline-outbox sends — local missions don't track field-level
// dirty state, the whole record is shipped on each sync). Sub-tables are
// reset to the new payload's contents inside the same tx.
export async function PUT(req: Request, ctx: Params) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id } = await ctx.params;

  // Verify the mission exists and belongs to this user before doing any
  // writes — saves a round trip on the 404 path and keeps the tx small.
  const existing = await loadMissionForUser(id, userOrRes.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = missionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid mission payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  await db.transaction(async (tx) => {
    await tx
      .update(missions)
      .set({
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
        updatedAt: new Date(),
      })
      .where(and(eq(missions.id, id), eq(missions.userId, userOrRes.id)));

    // Replace flights and photos. Cascade FK keeps inserted rows valid.
    await tx.delete(flights).where(eq(flights.missionId, id));
    if (input.flights.length > 0) {
      await tx.insert(flights).values(
        input.flights.map((f) => ({
          id: nanoid(),
          missionId: id,
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

    await tx.delete(missionPhotos).where(eq(missionPhotos.missionId, id));
    if (input.photos.length > 0) {
      await tx.insert(missionPhotos).values(
        input.photos.map((p) => ({
          id: nanoid(),
          missionId: id,
          url: p.url,
          caption: p.caption ?? null,
        })),
      );
    }
  });

  const updated = await loadMissionForUser(id, userOrRes.id);
  return NextResponse.json({ mission: updated });
}

export async function DELETE(_req: Request, ctx: Params) {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { id } = await ctx.params;

  // Cascade FK on flights + mission_photos handles the sub-rows. The
  // userId filter is the authz gate — without it, anyone with a valid
  // session could delete anyone else's missions.
  const result = await db
    .delete(missions)
    .where(and(eq(missions.id, id), eq(missions.userId, userOrRes.id)))
    .returning({ id: missions.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
