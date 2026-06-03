import { z } from "zod";

// Shared validation for the help-bubble. Lives in its own module so the
// client widget and the API route agree on the shape.
export const FEEDBACK_TYPES = ["bug", "feedback", "question"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const attachmentSchema = z.object({
  url: z.string().url().max(2000),
  kind: z.enum(["image", "video"]),
});

export const feedbackInputSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  message: z.string().trim().min(1, "Message is required").max(5000),
  // Captured client-side; both optional so a paranoid browser blocking
  // navigator/location can still submit.
  pageUrl: z.string().trim().max(2000).optional(),
  userAgent: z.string().trim().max(1000).optional(),
  // Only used for logged-out submissions so we can reply.
  contactEmail: z.string().trim().email().max(320).optional().or(z.literal("")),
  // Screenshots / screen recordings, already uploaded to Cloudinary.
  attachments: z.array(attachmentSchema).max(5).optional(),
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "Bug report",
  feedback: "Feedback",
  question: "Question",
};

export function feedbackTypeLabel(type: FeedbackType): string {
  return TYPE_LABELS[type];
}
