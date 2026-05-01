"use client";

import { CldUploadWidget } from "next-cloudinary";
import type { Photo } from "@/lib/pdf";

// Wraps Cloudinary's unsigned upload widget for mission photo
// attachments. Reads NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and
// NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET from env. The preset
// (fly_witus_unsigned per user-task #04) restricts the upload
// folder + accepted formats so this can run client-side safely.

interface PhotoUploadButtonProps {
  onAdd: (photo: Photo) => void;
  disabled?: boolean;
}

interface CloudinaryUploadResult {
  event?: string;
  info?: {
    secure_url?: string;
    [key: string]: unknown;
  };
}

export function PhotoUploadButton({ onAdd, disabled }: PhotoUploadButtonProps) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    return (
      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Photo uploads disabled — Cloudinary env not configured.
      </div>
    );
  }

  return (
    <CldUploadWidget
      uploadPreset={uploadPreset}
      options={{
        sources: ["local", "camera"],
        multiple: false,
        maxFiles: 1,
      }}
      onSuccess={(result) => {
        const r = result as CloudinaryUploadResult;
        const url = r.info?.secure_url;
        if (typeof url !== "string") return;
        onAdd({ url, uploadedAt: new Date().toISOString() });
      }}
    >
      {({ open }) => (
        <button
          type="button"
          onClick={() => open()}
          disabled={disabled}
          className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 font-semibold transition disabled:bg-gray-400"
        >
          + Add Photo
        </button>
      )}
    </CldUploadWidget>
  );
}
