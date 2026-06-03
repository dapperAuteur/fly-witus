"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { FEEDBACK_TYPES, feedbackTypeLabel, type FeedbackType } from "@/lib/feedback-api";
import {
  canUploadAttachments,
  uploadAttachment,
  type UploadedAttachment,
} from "@/lib/cloudinary-upload";

// Floating help/feedback widget shown on every page (rendered once in the
// root layout). Lets anyone — signed in or not — submit a bug, a piece of
// feedback, or a question, optionally with screenshots / screen
// recordings. Captures the current page URL + user agent to help
// reproduce bugs. Also links to the self-serve /help docs.

const MAX_ATTACHMENTS = 5;
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_RECORD_MS = 60_000; // 60s cap on screen recordings

export function HelpBubble() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  // Screen recording needs a secure context + the Display Media API.
  const canRecord =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
    typeof window !== "undefined" &&
    typeof window.MediaRecorder === "function";

  const reset = () => {
    setType("bug");
    setMessage("");
    setEmail("");
    setDone(false);
    setError(null);
    setAttachments([]);
    setAttachError(null);
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 200);
  };

  const uploadOne = async (file: Blob) => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      setAttachError(`Up to ${MAX_ATTACHMENTS} attachments.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setAttachError("That file is too large (max 25 MB).");
      return;
    }
    setUploading(true);
    setAttachError(null);
    try {
      const uploaded = await uploadAttachment(file);
      setAttachments((prev) => [...prev, uploaded]);
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => void uploadOne(f));
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) void uploadOne(f);
      }
    }
  };

  const startRecording = async () => {
    setAttachError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (chunks.length) await uploadOne(new Blob(chunks, { type: "video/webm" }));
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      // Stop if the user ends sharing from the browser UI…
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorder.state !== "inactive") recorder.stop();
      });
      // …and hard-cap the duration.
      window.setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, MAX_RECORD_MS);
    } catch {
      setRecording(false);
      setAttachError("Couldn't start screen recording (permission denied?).");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          contactEmail: session ? undefined : email.trim() || undefined,
          attachments: attachments.length ? attachments : undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Submit failed (HTTP ${res.status})`);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Help & feedback"
          className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full bg-sky-600 text-white shadow-lg hover:bg-sky-700 transition flex items-center justify-center text-xl font-bold"
        >
          ?
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-card text-card-foreground border border-border shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold">Help &amp; feedback</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close help"
              className="text-muted-foreground hover:text-card-foreground text-lg leading-none"
            >
              ×
            </button>
          </div>

          {done ? (
            <div className="p-4 space-y-3">
              <p className="text-sm">Thanks — we got it. We&apos;ll follow up if needed.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="px-3 py-1.5 border border-border rounded-md text-sm font-semibold hover:bg-muted"
                >
                  Send another
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="px-3 py-1.5 bg-sky-600 text-white rounded-md text-sm font-semibold hover:bg-sky-700"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="flex gap-1">
                {FEEDBACK_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs font-semibold border transition ${
                      type === t
                        ? "bg-sky-600 text-white border-sky-600"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {feedbackTypeLabel(t)}
                  </button>
                ))}
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onPaste={onPaste}
                required
                maxLength={5000}
                rows={4}
                placeholder={
                  type === "bug"
                    ? "What went wrong? What did you expect? (You can paste a screenshot here.)"
                    : type === "question"
                      ? "What would you like to know?"
                      : "Tell us what you think…"
                }
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              />

              {!session && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional — so we can reply)"
                  maxLength={320}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm"
                />
              )}

              {/* Attachments */}
              {canUploadAttachments && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      hidden
                      onChange={(e) => {
                        onFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || attachments.length >= MAX_ATTACHMENTS}
                      className="px-2.5 py-1 text-xs font-semibold border border-border rounded-md hover:bg-muted disabled:opacity-50"
                    >
                      📎 Attach
                    </button>
                    {canRecord &&
                      (recording ? (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-700"
                        >
                          ⏹ Stop recording
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startRecording}
                          disabled={uploading || attachments.length >= MAX_ATTACHMENTS}
                          className="px-2.5 py-1 text-xs font-semibold border border-border rounded-md hover:bg-muted disabled:opacity-50"
                        >
                          ⏺ Record screen
                        </button>
                      ))}
                    {uploading && (
                      <span className="text-xs text-muted-foreground self-center">Uploading…</span>
                    )}
                  </div>

                  {recording && (
                    <p className="text-xs text-muted-foreground">
                      Recording your screen — anything visible will be captured. Stops
                      automatically after 60s.
                    </p>
                  )}

                  {attachments.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {attachments.map((a, i) => (
                        <li
                          key={a.url}
                          className="relative border border-border rounded-md overflow-hidden"
                        >
                          {a.kind === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.url} alt="attachment" className="h-14 w-14 object-cover" />
                          ) : (
                            <div className="h-14 w-14 flex items-center justify-center text-xs bg-muted">
                              🎬 video
                            </div>
                          )}
                          <button
                            type="button"
                            aria-label="Remove attachment"
                            onClick={() =>
                              setAttachments((prev) => prev.filter((_, j) => j !== i))
                            }
                            className="absolute top-0 right-0 bg-black/60 text-white text-xs w-5 h-5 flex items-center justify-center"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {attachError && <p className="text-xs text-red-600">{attachError}</p>}
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting || uploading || !message.trim()}
                className="w-full py-2 bg-sky-600 text-white rounded-md text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send"}
              </button>

              <p className="text-xs text-muted-foreground text-center">
                Looking for answers?{" "}
                <Link href="/help" onClick={close} className="text-sky-700 underline">
                  Browse the help docs
                </Link>
              </p>
            </form>
          )}
        </div>
      )}
    </>
  );
}
