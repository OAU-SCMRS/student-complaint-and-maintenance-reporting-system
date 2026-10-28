import os
import shutil
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

import models
import database

# Create tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="FixOAU Backend API")

# Configure CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- PYDANTIC SCHEMAS ---
class UserRegister(BaseModel):
    name: str
    email: str
    matric_number: str
    phone: Optional[str] = None
    password: str

class UserLogin(BaseModel):
    matric_number: str
    password: str

class ProfileUpdate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

# --- AUTH & USER ENDPOINTS ---

@app.post("/auth/register")
def register_user(user: UserRegister, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(
        (models.User.email == user.email) | (models.User.matric_number == user.matric_number)
    ).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email or Matric Number already registered")
    
    new_user = models.User(
        name=user.name,
        email=user.email,
        matric_number=user.matric_number,
        phone=user.phone,
        password=user.password  # Note: In production, hash this password!
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully", "user_id": new_user.id}

@app.post("/auth/login")
def login_user(user: UserLogin, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.matric_number == user.matric_number).first()
    if not db_user or db_user.password != user.password:
        raise HTTPException(status_code=401, detail="Invalid matric number or password")
    
    return {
        "message": "Login successful", 
        "user_id": db_user.id, 
        "role": db_user.role,
        "name": db_user.name
    }

@app.put("/users/{user_id}")
def update_profile(user_id: int, profile: ProfileUpdate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_user.name = profile.name
    db_user.email = profile.email
    db_user.phone = profile.phone
    db.commit()
    return {"message": "Profile updated successfully"}

@app.put("/users/{user_id}/password")
def update_password(user_id: int, passwords: PasswordUpdate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user or db_user.password != passwords.current_password:
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    db_user.password = passwords.new_password
    db.commit()
    return {"message": "Password updated successfully"}

# --- COMPLAINT ENDPOINTS ---

@app.post("/complaints/")
async def submit_complaint(
    user_id: int = Form(...),
    title: str = Form(...),
    category: str = Form(...),
    location: str = Form(...),
    description: str = Form(...),
    files: List[UploadFile] = File(None),
    db: Session = Depends(database.get_db)
):
    image_urls = []
    
    if files:
        for file in files:
            file_location = f"{UPLOAD_DIR}/{file.filename}"
            with open(file_location, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            image_urls.append(f"/{file_location}")
            
    new_complaint = models.Complaint(
        user_id=user_id,
        title=title,
        category=category,
        location=location,
        description=description,
        image_urls=image_urls if image_urls else None
    )
    db.add(new_complaint)
    db.commit()
    db.refresh(new_complaint)
    return {"message": "Complaint submitted successfully", "complaint_id": new_complaint.id}

@app.get("/complaints/user/{user_id}")
def get_user_complaints(user_id: int, status: Optional[str] = None, db: Session = Depends(database.get_db)):
    query = db.query(models.Complaint).filter(models.Complaint.user_id == user_id)
    if status and status.lower() != "all":
        query = query.filter(models.Complaint.status == status)
    
    complaints = query.order_by(models.Complaint.created_at.desc()).all()
    return complaints

@app.get("/complaints/stats/{user_id}")
def get_dashboard_stats(user_id: int, db: Session = Depends(database.get_db)):
    complaints = db.query(models.Complaint).filter(models.Complaint.user_id == user_id).all()
    
    total = len(complaints)
    pending = sum(1 for c in complaints if c.status.lower() == "pending")
    in_progress = sum(1 for c in complaints if c.status.lower() == "in progress")
    resolved = sum(1 for c in complaints if c.status.lower() == "resolved")
    
    return {
        "total": total,
        "pending": pending,
        "in_progress": in_progress,
        "resolved": resolved
    }

# --- NOTIFICATION ENDPOINTS ---

@app.get("/notifications/{user_id}")
def get_notifications(user_id: int, db: Session = Depends(database.get_db)):
    notifications = db.query(models.Notification).filter(models.Notification.user_id == user_id).order_by(models.Notification.created_at.desc()).all()
    return notifications

@app.put("/notifications/read-all/{user_id}")
def mark_all_notifications_read(user_id: int, db: Session = Depends(database.get_db)):
    db.query(models.Notification).filter(
        models.Notification.user_id == user_id, 
        models.Notification.is_read == False
    ).update({"is_read": True})
    
    db.commit()
    return {"message": "All notifications marked as read"}