import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";

// Help-bubble submissions: bug reports, feature feedback, and questions
// sent from the floating widget on any page. userId is NULLABLE — the
// widget accepts submissions from logged-out visitors too (ON DELETE SET
// NULL so deleting a user keeps their feedback for triage history).
//
// Each row is also fanned out to the admin email + the WitUS ecosystem
// Inbox (src/lib/feedback-notify.ts) at submit time; this table is the
// durable local record the /admin/feedback queue reads.
export const feedbackSubmissions = pgTable(
  "feedback_submissions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),

    // bug | feedback | question — kept as text (not a pg enum) so adding a
    // new type later is a code change, not a migration.
    type: text("type").notNull(),
    message: text("message").notNull(),
    // The page the widget was opened on + the submitter's UA string. Both
    // help reproduce bugs; captured client-side at submit.
    pageUrl: text("page_url"),
    userAgent: text("user_agent"),
    // Denormalized contact email so logged-out submissions are still
    // reply-able even though userId is null.
    contactEmail: text("contact_email"),

    // new | triaged | resolved — admin advances this from /admin/feedback.
    status: text("status").notNull().default("new"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Queue view: newest first, optionally filtered by status.
    index("feedback_status_created_idx").on(table.status, table.createdAt),
  ],
);

export type FeedbackSubmission = typeof feedbackSubmissions.$inferSelect;
export type NewFeedbackSubmission = typeof feedbackSubmissions.$inferInsert;

// Screenshots / screen recordings attached to a submission. Uploaded
// client-side to Cloudinary (unsigned), so we store the resulting URL +
// whether it's an image or a video. Cascade with the parent submission.
export const feedbackAttachments = pgTable(
  "feedback_attachments",
  {
    id: text("id").primaryKey(),
    feedbackId: text("feedback_id")
      .notNull()
      .references(() => feedbackSubmissions.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    kind: text("kind").notNull(), // image | video
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("feedback_attachments_feedback_idx").on(table.feedbackId)],
);

export type FeedbackAttachment = typeof feedbackAttachments.$inferSelect;
