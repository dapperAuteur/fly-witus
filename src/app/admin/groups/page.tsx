import { count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/auth";
import { groupMembers, groupSharedMissions, groups } from "@/db/schema/groups";

export const metadata = { title: "Groups — Admin" };
export const dynamic = "force-dynamic";

// Read-only group browser for support. Click-through to a group page is
// out of scope (admins aren't members) — this is just inventory.
export default async function AdminGroupsPage() {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      ownerEmail: users.email,
      createdAt: groups.createdAt,
    })
    .from(groups)
    .innerJoin(users, eq(users.id, groups.ownerId))
    .orderBy(desc(groups.createdAt));

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Groups</h1>
        <p className="text-sm text-gray-500 italic">No groups created yet.</p>
      </div>
    );
  }

  const ids = rows.map((r) => r.id);
  const [memberRows, sharedRows] = await Promise.all([
    db
      .select({ groupId: groupMembers.groupId, value: count() })
      .from(groupMembers)
      .where(inArray(groupMembers.groupId, ids))
      .groupBy(groupMembers.groupId),
    db
      .select({ groupId: groupSharedMissions.groupId, value: count() })
      .from(groupSharedMissions)
      .where(inArray(groupSharedMissions.groupId, ids))
      .groupBy(groupSharedMissions.groupId),
  ]);
  const memberCounts = new Map(memberRows.map((r) => [r.groupId, Number(r.value)]));
  const sharedCounts = new Map(sharedRows.map((r) => [r.groupId, Number(r.value)]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Groups</h1>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Members</th>
              <th className="px-3 py-2">Shared</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <div className="font-semibold">{r.name}</div>
                  {r.description && (
                    <div className="text-xs text-gray-500 truncate max-w-md">
                      {r.description}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-700">{r.ownerEmail}</td>
                <td className="px-3 py-2">{memberCounts.get(r.id) ?? 0}</td>
                <td className="px-3 py-2">{sharedCounts.get(r.id) ?? 0}</td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
