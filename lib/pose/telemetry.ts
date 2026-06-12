"use client";
// Extracts compact joint-angle telemetry from a workout video, fully
// on-device. Only this summary JSON (~2KB) is sent to the backend — the
// video never leaves the user's device.
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { loadPoseLandmarker } from "./loader";

export interface JointRange {
  min: number;
  max: number;
  avg?: number;
}

export interface PoseTelemetry {
  exercise_hint?: string;
  duration_sec: number;
  frames_analyzed: number;
  rep_count?: number;
  joints: Record<string, JointRange>;
  torso_lean_max_deg?: number;
  notes?: string[];
}

// MediaPipe Pose landmark indices
const LM = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

function angleBetween(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  if (m1 === 0 || m2 === 0) return 180;
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Angle of the shoulder→hip line from vertical, in degrees (0 = upright). */
function torsoLean(landmarks: NormalizedLandmark[]): number {
  const shoulder = midpoint(landmarks[LM.LEFT_SHOULDER], landmarks[LM.RIGHT_SHOULDER]);
  const hip = midpoint(landmarks[LM.LEFT_HIP], landmarks[LM.RIGHT_HIP]);
  const dx = shoulder.x - hip.x;
  const dy = hip.y - shoulder.y; // image y grows downward
  return Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
}

function midpoint(a: NormalizedLandmark, b: NormalizedLandmark) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

interface Tracker {
  min: number;
  max: number;
  sum: number;
  n: number;
}

function track(map: Map<string, Tracker>, name: string, value: number) {
  const entry = map.get(name);
  if (!entry) {
    map.set(name, { min: value, max: value, sum: value, n: 1 });
  } else {
    entry.min = Math.min(entry.min, value);
    entry.max = Math.max(entry.max, value);
    entry.sum += value;
    entry.n += 1;
  }
}

/** Counts reps from an angle series via threshold crossings around its midrange. */
function countReps(series: number[]): number {
  if (series.length < 6) return 0;
  const min = Math.min(...series);
  const max = Math.max(...series);
  if (max - min < 25) return 0; // not enough motion to be reps
  const low = min + (max - min) * 0.35;
  const high = min + (max - min) * 0.65;
  let reps = 0;
  let phase: "up" | "down" = series[0] > high ? "up" : "down";
  for (const value of series) {
    if (phase === "up" && value < low) phase = "down";
    else if (phase === "down" && value > high) {
      phase = "up";
      reps += 1;
    }
  }
  return reps;
}

export interface AnalyzeOptions {
  exerciseHint?: string;
  /** Called with 0..1 progress as the video is processed. */
  onProgress?: (fraction: number) => void;
  /** Called per analyzed frame for overlay drawing. */
  onFrame?: (landmarks: NormalizedLandmark[], timestampSec: number) => void;
}

const TARGET_FPS = 10;
const MAX_DURATION_SEC = 60;

export async function extractTelemetry(file: File, options: AnalyzeOptions = {}): Promise<PoseTelemetry> {
  const landmarker = await loadPoseLandmarker();

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = URL.createObjectURL(file);

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Could not read this video file."));
  });

  const duration = Math.min(video.duration || 0, MAX_DURATION_SEC);
  if (!duration) throw new Error("This video appears to be empty.");

  const step = 1 / TARGET_FPS;
  const trackers = new Map<string, Tracker>();
  const kneeSeries: number[] = [];
  const elbowSeries: number[] = [];
  let torsoMax = 0;
  let frames = 0;
  let missed = 0;

  for (let t = 0; t < duration; t += step) {
    video.currentTime = t;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    const result = landmarker.detectForVideo(video, Math.round(t * 1000));
    const landmarks = result.landmarks?.[0];
    if (!landmarks) {
      missed += 1;
      continue;
    }
    frames += 1;
    options.onFrame?.(landmarks, t);
    options.onProgress?.(t / duration);

    const leftKnee = angleBetween(landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]);
    const rightKnee = angleBetween(landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE]);
    const leftHip = angleBetween(landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE]);
    const rightHip = angleBetween(landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE]);
    const leftElbow = angleBetween(landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_ELBOW], landmarks[LM.LEFT_WRIST]);
    const rightElbow = angleBetween(landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW], landmarks[LM.RIGHT_WRIST]);
    const lean = torsoLean(landmarks);

    track(trackers, "left_knee", leftKnee);
    track(trackers, "right_knee", rightKnee);
    track(trackers, "left_hip", leftHip);
    track(trackers, "right_hip", rightHip);
    track(trackers, "left_elbow", leftElbow);
    track(trackers, "right_elbow", rightElbow);
    torsoMax = Math.max(torsoMax, lean);
    kneeSeries.push((leftKnee + rightKnee) / 2);
    elbowSeries.push((leftElbow + rightElbow) / 2);
  }

  URL.revokeObjectURL(video.src);

  if (frames < 5) {
    throw new Error("Could not detect a person clearly in this video. Film your full body in good lighting.");
  }

  const joints: Record<string, JointRange> = {};
  for (const [name, tracker] of trackers) {
    joints[name] = {
      min: Math.round(tracker.min),
      max: Math.round(tracker.max),
      avg: Math.round(tracker.sum / tracker.n),
    };
  }

  const kneeReps = countReps(kneeSeries);
  const elbowReps = countReps(elbowSeries);
  const notes: string[] = [];
  if (missed > frames) notes.push("Person was out of frame for much of the video.");

  return {
    exercise_hint: options.exerciseHint,
    duration_sec: duration,
    frames_analyzed: frames,
    rep_count: Math.max(kneeReps, elbowReps) || undefined,
    joints,
    torso_lean_max_deg: Math.round(torsoMax),
    notes: notes.length ? notes : undefined,
  };
}
