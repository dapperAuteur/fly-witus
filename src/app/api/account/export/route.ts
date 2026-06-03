import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { aircraftProfiles } from "@/db/schema/aircraft-profiles";
import { flights, missionPhotos, missions } from "@/db/schema/missions";
import { groupMembers, groups } from "@/db/schema/groups";
import { requireUser } from "@/lib/api-auth";

// GET /api/account/export — download every piece of the signed-in user's
// data as a single JSON file (profile, missions + flights + photos,
// aircraft profiles, and group memberships). Data-portability / "export
// my data" self-service.
export async function GET() {
  const userOrRes = await requireUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  try {
    const [profile] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        part107CertNumber: users.part107CertNumber,
        homeLocation: users.homeLocation,
        accountTier: users.accountTier,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userOrRes.id))
      .limit(1);

    const myMissions = await db
      .select()
      .from(missions)
      .where(eq(missions.userId, userOrRes.id))
      .orderBy(desc(missions.timestamp));

    const missionIds = myMissions.map((m) => m.id);
    const [allFlights, allPhotos] = await Promise.all([
      missionIds.length
        ? db.select().from(flights).where(inArray(flights.missionId, missionIds))
        : Promise.resolve([]),
      missionIds.length
        ? db
            .select()
            .from(missionPhotos)
            .where(inArray(missionPhotos.missionId, missionIds))
        : Promise.resolve([]),
    ]);

    const flightsByMission = new Map<string, typeof allFlights>();
    for (const f of allFlights) {
      const list = flightsByMission.get(f.missionId) ?? [];
      list.push(f);
      flightsByMission.set(f.missionId, list);
    }
    const photosByMission = new Map<string, typeof allPhotos>();
    for (const p of allPhotos) {
      const list = photosByMission.get(p.missionId) ?? [];
      list.push(p);
      photosByMission.set(p.missionId, list);
    }

    const aircraft = await db
      .select()
      .from(aircraftProfiles)
      .where(eq(aircraftProfiles.userId, userOrRes.id));

    const memberships = await db
      .select({
        groupId: groups.id,
        name: groups.name,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, userOrRes.id));

    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      missions: myMissions.map((m) => ({
        ...m,
        flights: flightsByMission.get(m.id) ?? [],
        photos: photosByMission.get(m.id) ?? [],
      })),
      aircraftProfiles: aircraft,
      groupMemberships: memberships,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="fly-witus-export.json"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/account/export]", err);
    return NextResponse.json(
      { error: "Couldn't build your export. Try again." },
      { status: 500 },
    );
  }
}
