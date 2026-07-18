"use client";

/**
 * Client-side image standardization (blueprint §A): downscale so
 * max(width, height) ≤ 768px and re-encode as 75% JPEG. Guarantees Gemini
 * single-tile processing — a flat 258 input tokens per image — and avoids
 * the multi-tile billing fallback on dense device photos.
 */
const MAX_EDGE = 768;
const JPEG_QUALITY = 0.75;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) return file;

    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch (error) {
    console.error("[image-compress] falling back to original file:", error);
    return file;
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

const THUMB_EDGE = 96;
const THUMB_QUALITY = 0.6;

/**
 * Tiny square-ish JPEG data-URL (~2–5 KB) for showing a logged photo in
 * journal rows. Small enough to store inline in the Firestore log document.
 */
export async function makeImageThumb(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, THUMB_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", THUMB_QUALITY);
  } catch {
    return null;
  }
}

/**
 * Grabs an early frame of a video file as a tiny JPEG data-URL — the "icon"
 * shown next to gym logs. Runs fully client-side.
 */
export function makeVideoThumb(file: File): Promise<string | null> {
  if (!file.type.startsWith("video/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
      } catch {
        finish();
      }
    };
    const finish = () => {
      try {
        const scale = Math.min(1, THUMB_EDGE / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", THUMB_QUALITY));
      } catch {
        resolve(null);
      } finally {
        cleanup();
      }
    };
    video.onseeked = finish;
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
    video.src = url;
  });
}

/** Client-side guard: uploads above this will exceed the server request limit. */
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024;
