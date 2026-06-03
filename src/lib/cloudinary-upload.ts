// Client-side unsigned Cloudinary upload for help-bubble attachments
// (screenshots + screen recordings). Uses the `auto/upload` endpoint so
// the same call handles images and video. Mirrors the env the existing
// mission photo widget reads, but as a direct fetch so the help bubble
// can upload multiple files + recorded blobs without the modal widget.

export const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

// True when the public Cloudinary env is present — gate the attachment UI
// on this so text-only feedback still works without Cloudinary.
export const canUploadAttachments = Boolean(CLOUDINARY_CLOUD && CLOUDINARY_PRESET);

export type AttachmentKind = "image" | "video";
export interface UploadedAttachment {
  url: string;
  kind: AttachmentKind;
}

export async function uploadAttachment(file: Blob): Promise<UploadedAttachment> {
  if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
    throw new Error("Attachment uploads are not configured.");
  }
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    // 400 on a video upload usually means the unsigned preset is
    // image-only — see operator task for enabling video.
    throw new Error(`Upload failed (HTTP ${res.status})`);
  }
  const json = (await res.json()) as {
    secure_url?: string;
    resource_type?: string;
  };
  if (!json.secure_url) throw new Error("Upload returned no URL.");
  return {
    url: json.secure_url,
    kind: json.resource_type === "video" ? "video" : "image",
  };
}
