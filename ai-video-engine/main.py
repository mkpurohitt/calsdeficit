import os
import cv2
import json
import math
import urllib.request
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from google import genai
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables (such as GEMINI_API_KEY, SUPABASE_URL, etc.)
load_dotenv()

app = FastAPI()

# Allow frontend to communicate with this microservice
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Setup Gemini AI Client (new google-genai SDK, text-only)
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
GEMINI_MODEL = "gemini-2.0-flash"

# ---------------------------------------------------------------------------
# Setup Supabase client
# ---------------------------------------------------------------------------
supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY")
supabase: Client | None = None
if supabase_url and supabase_key:
    supabase = create_client(supabase_url, supabase_key)

# ---------------------------------------------------------------------------
# MediaPipe Pose Landmarker Setup (Tasks API)
# ---------------------------------------------------------------------------

# Download the pose landmarker model if not already present
MODEL_PATH = "pose_landmarker_heavy.task"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"

if not os.path.exists(MODEL_PATH):
    print(f"Downloading pose landmarker model to {MODEL_PATH}...")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    print("Download complete.")

# MediaPipe pose landmark indices (standard 33-point model)
# Reference: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
LANDMARK_INDEX = {
    "LEFT_SHOULDER": 11,
    "RIGHT_SHOULDER": 12,
    "LEFT_ELBOW": 13,
    "RIGHT_ELBOW": 14,
    "LEFT_HIP": 23,
    "RIGHT_HIP": 24,
    "LEFT_KNEE": 25,
    "RIGHT_KNEE": 26,
    "LEFT_ANKLE": 27,
    "RIGHT_ANKLE": 28,
}

# Generic joint definitions: each entry maps a human-readable joint name
# to a tuple of three landmark keys (a, b, c) where b is the vertex
# and the angle is measured as a-b-c.
JOINT_DEFINITIONS = {
    "Left Knee":      ("LEFT_HIP",      "LEFT_KNEE",      "LEFT_ANKLE"),
    "Right Knee":     ("RIGHT_HIP",     "RIGHT_KNEE",     "RIGHT_ANKLE"),
    "Left Hip":       ("LEFT_SHOULDER",  "LEFT_HIP",       "LEFT_KNEE"),
    "Right Hip":      ("RIGHT_SHOULDER", "RIGHT_HIP",      "RIGHT_KNEE"),
    "Left Shoulder":  ("LEFT_ELBOW",     "LEFT_SHOULDER",  "LEFT_HIP"),
    "Right Shoulder": ("RIGHT_ELBOW",    "RIGHT_SHOULDER", "RIGHT_HIP"),
}


# ---------------------------------------------------------------------------
# Math Helpers
# ---------------------------------------------------------------------------

def calculate_angle(a, b, c):
    """
    Calculates the internal angle between three points a, b, c using arctan2.
    b is the vertex (e.g. knee).
    a and c are the endpoints (e.g. hip and ankle).
    """
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)

    # Calculate radians then convert to degrees
    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)

    # Adjust to obtain the correct internal angle
    if angle > 180.0:
        angle = 360 - angle

    return angle


def calculate_torso_lean(shoulder, hip):
    """
    Calculates the torso lean angle relative to the vertical axis.
    0° means perfectly upright, 90° means horizontal.
    Uses the shoulder-to-hip vector compared against a vertical reference.
    """
    dx = shoulder[0] - hip[0]
    dy = shoulder[1] - hip[1]
    # In MediaPipe coordinates, y increases downward, so a perfectly upright
    # torso has dy < 0 (shoulder above hip) and dx ≈ 0.
    # Angle from vertical = arctan2(|dx|, |dy|)
    lean = math.degrees(math.atan2(abs(dx), abs(dy)))
    return lean


def build_telemetry_string(joint_tracker, max_torso_lean):
    """
    Compiles the tracked joint extremes into a single formatted telemetry string
    for Gemini to reason over.
    """
    parts = []
    for joint_name, extremes in joint_tracker.items():
        min_val = extremes["min"]
        max_val = extremes["max"]
        parts.append(f"{joint_name} ROM: {max_val:.0f}\u00b0 to {min_val:.0f}\u00b0")

    parts.append(f"Max Torso Lean: {max_torso_lean:.0f}\u00b0 from vertical")

    return "Biometric Telemetry: " + ". ".join(parts) + "."


# ---------------------------------------------------------------------------
# Main API Endpoint
# ---------------------------------------------------------------------------

@app.post("/analyze-form")
async def analyze_form(file: UploadFile = File(...), user_id: str = Form(...)):
    """
    POST route to accept a workout video, run MediaPipe biomechanical tracking,
    build a biometric telemetry string, and send ONLY the text to Gemini
    for exercise identification and coaching feedback.
    """
    temp_path = "temp_video.mp4"

    # Save the uploaded file temporarily to process with OpenCV
    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())

    cap = cv2.VideoCapture(temp_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0  # fallback to 30 fps

    # Initialize the generic joint angle tracker (min/max per joint)
    joint_tracker = {}
    for joint_name in JOINT_DEFINITIONS:
        joint_tracker[joint_name] = {"min": 360.0, "max": 0.0}

    max_torso_lean = 0.0
    frame_count = 0

    # Create the PoseLandmarker with VIDEO running mode
    base_options = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
    )

    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # Convert frame to RGB and wrap in MediaPipe Image
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

            # Calculate timestamp in milliseconds for VIDEO mode
            frame_timestamp_ms = int((frame_count / fps) * 1000)
            results = landmarker.detect_for_video(mp_image, frame_timestamp_ms)

            if results.pose_landmarks and len(results.pose_landmarks) > 0:
                landmarks = results.pose_landmarks[0]  # First detected person

                # --- Track all joints generically ---
                for joint_name, (lm_a, lm_b, lm_c) in JOINT_DEFINITIONS.items():
                    idx_a = LANDMARK_INDEX[lm_a]
                    idx_b = LANDMARK_INDEX[lm_b]
                    idx_c = LANDMARK_INDEX[lm_c]

                    pt_a = [landmarks[idx_a].x, landmarks[idx_a].y]
                    pt_b = [landmarks[idx_b].x, landmarks[idx_b].y]
                    pt_c = [landmarks[idx_c].x, landmarks[idx_c].y]

                    angle = calculate_angle(pt_a, pt_b, pt_c)

                    # Update extremes
                    if angle < joint_tracker[joint_name]["min"]:
                        joint_tracker[joint_name]["min"] = angle
                    if angle > joint_tracker[joint_name]["max"]:
                        joint_tracker[joint_name]["max"] = angle

                # --- Calculate torso lean (both sides, take the max) ---
                l_shoulder = [landmarks[LANDMARK_INDEX["LEFT_SHOULDER"]].x,
                              landmarks[LANDMARK_INDEX["LEFT_SHOULDER"]].y]
                l_hip = [landmarks[LANDMARK_INDEX["LEFT_HIP"]].x,
                         landmarks[LANDMARK_INDEX["LEFT_HIP"]].y]
                r_shoulder = [landmarks[LANDMARK_INDEX["RIGHT_SHOULDER"]].x,
                              landmarks[LANDMARK_INDEX["RIGHT_SHOULDER"]].y]
                r_hip = [landmarks[LANDMARK_INDEX["RIGHT_HIP"]].x,
                         landmarks[LANDMARK_INDEX["RIGHT_HIP"]].y]

                left_lean = calculate_torso_lean(l_shoulder, l_hip)
                right_lean = calculate_torso_lean(r_shoulder, r_hip)
                frame_lean = max(left_lean, right_lean)

                if frame_lean > max_torso_lean:
                    max_torso_lean = frame_lean

            frame_count += 1

    cap.release()

    # Cleanup local file
    if os.path.exists(temp_path):
        os.remove(temp_path)

    # Build the telemetry string from all tracked data
    telemetry_string = build_telemetry_string(joint_tracker, max_torso_lean)

    # Construct the exercise-agnostic coaching prompt (TEXT ONLY to Gemini)
    prompt = (
        "You are an elite powerlifting and bodybuilding coach. "
        "The user performed an exercise. Based on the following raw biometric "
        "telemetry extracted from their video, identify the likely exercise, "
        "evaluate their form, and provide 1 positive feedback and 1 area for "
        "improvement. "
        f"Telemetry Data: {telemetry_string} "
        "Return ONLY a raw JSON object matching this schema exactly: "
        '{ "exercise_name": "...", "score": 85, '
        '"feedback": { "positive": "...", "improvement": "..." } }'
    )

    # Call Gemini to get the NLP feedback based on telemetry text
    try:
        if not gemini_client:
            raise ValueError("Gemini API key not configured")
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        raw_text = response.text.replace("```json", "").replace("```", "").strip()
        report = json.loads(raw_text)
    except Exception as e:
        report = {
            "exercise_name": "Unknown",
            "score": 0,
            "feedback": {
                "positive": "",
                "improvement": f"Error parsing AI response: {str(e)}",
            },
        }

    # Save the successful analysis to Supabase
    if supabase and report.get("score", 0) > 0:
        try:
            supabase.table("form_analyses").insert(
                {
                    "user_id": user_id,
                    "exercise_name": report.get("exercise_name", "Unknown"),
                    "score": report.get("score"),
                    "feedback": report.get("feedback"),
                }
            ).execute()
        except Exception as e:
            print(f"Supabase write error: {e}")

    # Return directly to Next.js
    return report


if __name__ == "__main__":
    import uvicorn

    # Starts server on http://0.0.0.0:8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
