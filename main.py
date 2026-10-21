from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
import shutil

app = FastAPI(title="Student Complaint System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- IN-MEMORY TABLES ---
users_db = [
    {"id": 1, "name": "Student User", "email": "student@oau.edu", "password": "password123", "role": "student"},
    {"id": 2, "name": "Maintenance Admin", "email": "admin@oau.edu", "password": "admin123", "role": "admin"}
]
complaints_db = []
updates_db = []
notifications_db = []

# --- SCHEMAS ---
class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    role: str = "student"

class UserLogin(BaseModel):
    email: str
    password: str

# --- 1. AUTHENTICATION ---
@app.post("/auth/register")
def register(user: UserRegister):
    for u in users_db:
        if u["email"] == user.email:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = {
        "id": len(users_db) + 1,
        "name": user.name,
        "email": user.email,
        "password": user.password,
        "role": user.role
    }
    users_db.append(new_user)
    return {"message": "User registered successfully", "user_id": new_user["id"], "role": new_user["role"]}

@app.post("/auth/login")
def login(credentials: UserLogin):
    for u in users_db:
        if u["email"] == credentials.email and u["password"] == credentials.password:
            return {
                "message": "Login successful",
                "user_id": u["id"],
                "name": u["name"],
                "role": u["role"]
            }
    raise HTTPException(status_code=401, detail="Invalid email or password")


# --- 2. REPORT AN ISSUE (WITH LOCATION & DUPLICATE CHECK) ---
@app.post("/complaints/")
async def create_complaint(
    user_id: int = Form(...),
    title: str = Form(...),
    category: str = Form(...),
    location: str = Form(...),
    description: str = Form(...),
    file: Optional[UploadFile] = File(None)
):
    # Rule 1: Validate specific campus location
    if not location or len(location.strip()) < 3:
        raise HTTPException(
            status_code=400, 
            detail="A specific campus location is required (e.g., 'Fajuyi Hall Block B, Room 12')."
        )

    # Rule 2: Duplicate detection logic (checks category + location)
    for existing in complaints_db:
        if (
            existing["location"].strip().lower() == location.strip().lower() 
            and existing["category"].strip().lower() == category.strip().lower()
            and existing["status"] != "Resolved"
        ):
            return {
                "warning": "DUPLICATE_REPORT_DETECTED",
                "message": f"A similar active complaint at '{location}' is already recorded.",
                "existing_complaint_id": existing["id"],
                "status": existing["status"]
            }

    # Save uploaded file
    image_url = None
    if file:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        image_url = f"/uploads/{file.filename}"

    new_id = len(complaints_db) + 1
    new_complaint = {
        "id": new_id,
        "user_id": user_id,
        "title": title,
        "category": category,
        "location": location,
        "description": description,
        "status": "Pending",
        "image_url": image_url,
        "created_at": str(datetime.now())
    }
    complaints_db.append(new_complaint)
    return new_complaint


# --- 3. DASHBOARD & TRACKING ENDPOINTS ---
@app.get("/complaints/")
def get_all_complaints():
    return complaints_db

@app.get("/complaints/user/{user_id}")
def get_user_complaints(user_id: int):
    return [c for c in complaints_db if c["user_id"] == user_id]

@app.get("/complaints/{complaint_id}/history")
def get_complaint_history(complaint_id: int):
    history = [u for u in updates_db if u["complaint_id"] == complaint_id]
    return history


# --- 4. ADMIN STATUS UPDATES (ROLE SECURITY RESTRICTION) ---
@app.patch("/complaints/{complaint_id}/status")
def update_complaint_status(
    complaint_id: int, 
    updater_user_id: int, 
    new_status: str, 
    message: str = ""
):
    # Rule 3: Verify user identity and role
    updater = next((u for u in users_db if u["id"] == updater_user_id), None)
    if not updater:
        raise HTTPException(status_code=404, detail="User requesting status change not found")

    if updater["role"] != "admin":
        raise HTTPException(
            status_code=403, 
            detail="Permission denied: Students cannot alter complaint statuses."
        )

    # Locate complaint
    target_complaint = next((c for c in complaints_db if c["id"] == complaint_id), None)
    if not target_complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
        
    prev_status = target_complaint["status"]
    target_complaint["status"] = new_status
    
    # Audit log entry
    update_entry = {
        "id": len(updates_db) + 1,
        "complaint_id": complaint_id,
        "previous_status": prev_status,
        "new_status": new_status,
        "message": message,
        "updated_by": updater["name"],
        "date": str(datetime.now())
    }
    updates_db.append(update_entry)
    
    # Send notification to student
    notif_entry = {
        "id": len(notifications_db) + 1,
        "user_id": target_complaint["user_id"],
        "message": f"Your complaint '{target_complaint['title']}' was updated to '{new_status}'.",
        "is_read": False,
        "date": str(datetime.now())
    }
    notifications_db.append(notif_entry)
    
    return {"message": "Status updated successfully", "complaint": target_complaint}


# --- 5. NOTIFICATIONS ---
@app.get("/notifications/{user_id}")
def get_user_notifications(user_id: int):
    return [n for n in notifications_db if n["user_id"] == user_id]