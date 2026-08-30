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

/**
 * Re-encodes a video client-side before it's base64'd and sent to the model
 * (the quick-log flow) — a phone-camera clip is easily 30-80 Mbps, and none
 * of that resolution helps an AI recognise "this is a bench press."
 *
 * Draws every frame onto a downscaled canvas and records the canvas's own
 * stream. Audio is dropped: workout clips essentially never carry information
 * worth keeping in it, and skipping it removes an entire class of
 * audio/video-sync bugs from a feature that only needs to look right, not
 * play back losslessly.
 *
 * Never throws and never blocks the upload: unsupported browser, a decode
 * error, a clip too long to bother with, or a result that isn't actually
 * smaller all resolve with the ORIGINAL file. A compression bug must never be
 * the reason a real log fails.
 */
export interface VideoCompressOptions {
  /** Longest edge after downscaling. 480 is plenty for exercise recognition. */
  maxEdge?: number;
  fps?: number;
  videoBitsPerSecond?: number;
  /** Clips longer than this are left uncompressed rather than tying up the
   *  main thread on a canvas draw loop for minutes. */
  maxDurationSec?: number;
}

export async function compressVideo(file: File, options: VideoCompressOptions = {}): Promise<File> {
  if (!file.type.startsWith("video/")) return file;
  const { maxEdge = 480, fps = 24, videoBitsPerSecond = 800_000, maxDurationSec = 30 } = options;

  if (typeof MediaRecorder === "undefined" || !("captureStream" in HTMLVideoElement.prototype)) {
    return file;
  }

  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
    (t) => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(t)
  );
  if (!mimeType) return file;

  return new Promise<File>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    let rafId = 0;
    let settled = false;

    const finish = (result: File) => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(rafId);
      URL.revokeObjectURL(url);
      resolve(result);
    };

    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.videoHeight || video.duration > maxDurationSec) {
        finish(file);
        return;
      }

      const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
      // Even dimensions — some encoders reject odd ones.
      const w = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2);
      const h = Math.max(2, Math.round((video.videoHeight * scale) / 2) * 2);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        finish(file);
        return;
      }

      const stream = canvas.captureStream(fps);
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
      } catch {
        finish(file);
        return;
      }

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onerror = () => finish(file);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        // Only worth it if it actually shrank — an already-tiny or very
        // simple source clip can come out larger after re-encoding.
        if (blob.size > 0 && blob.size < file.size) {
          finish(new File([blob], file.name.replace(/\.\w+$/, "") + ".webm", { type: mimeType }));
        } else {
          finish(file);
        }
      };

      const draw = () => {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, w, h);
        rafId = requestAnimationFrame(draw);
      };

      video.onended = () => {
        if (recorder.state === "recording") recorder.stop();
      };
      video.onerror = () => finish(file);

      video.play().then(
        () => {
          recorder.start();
          draw();
        },
        () => finish(file)
      );
    };
    video.onerror = () => finish(file);
    video.src = url;
  });
}
