import os
import cv2
import json
import numpy as np
import mediapipe as mp
import google.generativeai as genai
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

# Setup Gemini AI Model
GEMINI_API_KEY = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
# We will use gemini-1.5-flash since gemini-2.5/3.0 naming conventions vary by SDK version.
model = genai.GenerativeModel("gemini-1.5-flash")

# Setup Supabase client
supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY")
supabase: Client | None = None
if supabase_url and supabase_key:
    supabase = create_client(supabase_url, supabase_key)

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

# Initialize MediaPipe Pose object globally to save reuse time
mp_pose = mp.solutions.pose

@app.post("/analyze-form")
async def analyze_form(file: UploadFile = File(...), user_id: str = Form(...)):
    """
    POST route to accept a workout video, run MediaPipe biomechanical tracking,
    and send the extracted kinematics to Gemini for coaching feedback.
    """
    temp_path = "temp_video.mp4"
    
    # Save the uploaded file temporarily to process with OpenCV
    with open(temp_path, "wb") as buffer:
        buffer.write(await file.read())
        
    cap = cv2.VideoCapture(temp_path)
    
    min_knee_angle = 360
    back_angle_at_min = 0
    
    # Run MediaPipe Pose Processing
    with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            # Convert frame to RGB for MediaPipe
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(image)
            
            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                
                # Extract specific landmarks (Left side assumed visible for 2D profile)
                shoulder = [landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].x, landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y]
                hip = [landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].x, landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].y]
                knee = [landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].x, landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].y]
                ankle = [landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].x, landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].y]
                
                # Calculate required joint angles
                # Knee angle: hip - knee - ankle
                knee_angle = calculate_angle(hip, knee, ankle)
                # Back/Hip angle: shoulder - hip - knee
                back_angle = calculate_angle(shoulder, hip, knee)
                
                # We want to identify the deepest part of the squat (minimum knee angle)
                if knee_angle < min_knee_angle:
                    min_knee_angle = knee_angle
                    back_angle_at_min = back_angle
                    
    cap.release()
    
    # Cleanup local file 
    if os.path.exists(temp_path):
        os.remove(temp_path)
        
    # Construct the coaching prompt
    prompt = f"""
    A user performed a squat. At maximum depth, their knee angle was {min_knee_angle:.1f} degrees 
    and their hip/back angle was {back_angle_at_min:.1f} degrees. As an expert powerlifting coach, 
    rate their form out of 100. Provide 1 positive feedback string and 1 improvement string. 
    Return ONLY raw JSON matching exactly: 
    {{ "exercise_name": "Squat", "score": 85, "feedback": {{ "positive": "...", "improvement": "..." }} }}
    """
    
    # Call Gemini to get the NLP feedback based on raw data
    try:
        response = model.generate_content(prompt)
        raw_text = response.text.replace('```json', '').replace('```', '').strip()
        report = json.loads(raw_text)
    except Exception as e:
        report = {
            "exercise_name": "Squat", 
            "score": 0, 
            "feedback": {
                "positive": "", 
                "improvement": f"Error parsing AI response: {str(e)}"
            }
        }
        
    # Save the successful analysis asynchronously to Supabase
    if supabase and report.get("score", 0) > 0:
        try:
            supabase.table("form_analyses").insert({
                "user_id": user_id,
                "exercise_name": report.get("exercise_name", "Squat"),
                "score": report.get("score"),
                "feedback": report.get("feedback")
            }).execute()
        except Exception as e:
            print(f"Supabase write error: {e}")
            
    # Return directly to Next.js
    return report

if __name__ == "__main__":
    import uvicorn
    # Starts server on http://0.0.0.0:8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
