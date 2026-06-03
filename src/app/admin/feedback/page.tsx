import { desc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  feedbackAttachments,
  feedbackSubmissions,
  type FeedbackAttachment,
} from "@/db/schema/feedback";
import { feedbackTypeLabel, type FeedbackType } from "@/lib/feedback-api";
import { StatusControl } from "./_components/status-control";

export const metadata = { title: "Feedback — Admin" };
export const dynamic = "force-dynamic";

const TYPE_STYLE: Record<string, string> = {
  bug: "bg-red-100 text-red-800",
  feedback: "bg-sky-100 text-sky-800",
  question: "bg-violet-100 text-violet-800",
};

// Triage queue for help-bubble submissions. Newest first. Each row's
// status is editable inline; the email + WitUS Inbox fan-out already
// fired at submit time, so this is the durable browse/triage surface.
export default async function AdminFeedbackPage() {
  const rows = await db
    .select()
    .from(feedbackSubmissions)
    .orderBy(desc(feedbackSubmissions.createdAt))
    .limit(200);

  const ids = rows.map((r) => r.id);
  const atts = ids.length
    ? await db
        .select()
        .from(feedbackAttachments)
        .where(inArray(feedbackAttachments.feedbackId, ids))
    : [];
  const attachmentsByFeedback = new Map<string, FeedbackAttachment[]>();
  for (const a of atts) {
    const list = attachmentsByFeedback.get(a.feedbackId);
    if (list) list.push(a);
    else attachmentsByFeedback.set(a.feedbackId, [a]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Feedback</h1>
        <span className="text-sm text-muted-foreground">{rows.length} most recent</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No submissions yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="bg-card text-card-foreground border border-border rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                      TYPE_STYLE[r.type] ?? "bg-muted text-card-foreground"
                    }`}
                  >
                    {feedbackTypeLabel(r.type as FeedbackType)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.contactEmail ?? "anonymous"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </div>
                <StatusControl id={r.id} initialStatus={r.status} />
              </div>
              <p className="text-sm text-card-foreground whitespace-pre-wrap">{r.message}</p>
              {r.pageUrl && (
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  Page: {r.pageUrl}
                </p>
              )}
              {r.userAgent && (
                <p className="text-xs text-muted-foreground truncate">{r.userAgent}</p>
              )}
              {(attachmentsByFeedback.get(r.id) ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {(attachmentsByFeedback.get(r.id) ?? []).map((a) => (
                    <a
                      key={a.id}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border border-border rounded-md overflow-hidden"
                      title={`Open ${a.kind}`}
                    >
                      {a.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url} alt="attachment" className="h-16 w-16 object-cover" />
                      ) : (
                        <span className="h-16 w-16 flex items-center justify-center text-xs bg-muted">
                          🎬 video
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
