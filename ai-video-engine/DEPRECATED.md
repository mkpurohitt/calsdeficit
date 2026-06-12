# DEPRECATED — replaced by on-device analysis

This Python FastAPI microservice (MediaPipe pose + Gemini) has been replaced by:

- **`lib/pose/`** — MediaPipe Pose Landmarker running **in the user's browser**
  (`@mediapipe/tasks-vision`, WASM). The video never leaves the device.
- **`app/api/form-analysis/route.ts`** — receives only the compact joint-angle
  telemetry JSON and scores it with Gemini on Vertex AI.

Benefits: zero server/video-upload cost, better privacy ("your video never
leaves your device"), no separate deployment to maintain.

The code is kept for reference only. Do not deploy it.
