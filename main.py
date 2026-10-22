import os
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
from database import engine, get_db

# Create all MySQL database tables automatically on startup
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="OAU Student Complaint & Maintenance Reporting System API",
    description="Backend API for student complaint submission, tracking, and admin management.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "message": "Student Complaint System API is online!",
        "documentation": "/docs"
    }

# ---------------------------------------------------------
# AUTHENTICATION ENDPOINTS
# ---------------------------------------------------------

@app.post("/auth/register")
def register(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form("student"),
    db: Session = Depends(get_db)
):
    existing_user = db.query(models.User).filter(models.User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email is already registered")
    
    new_user = models.User(name=name, email=email, password=password, role=role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully", "user_id": new_user.id}


@app.post("/auth/login")
def login(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(
        models.User.email == email, 
        models.User.password == password
    ).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    return {
        "message": "Login successful",
        "user_id": user.id,
        "name": user.name,
        "role": user.role
    }

# ---------------------------------------------------------
# COMPLAINTS ENDPOINTS
# ---------------------------------------------------------

@app.get("/complaints/")
def get_all_complaints(db: Session = Depends(get_db)):
    return db.query(models.Complaint).all()


@app.post("/complaints/")
async def create_complaint(
    user_id: int = Form(...),
    title: str = Form(...),
    category: str = Form(...),
    location: str = Form(...),
    description: str = Form(...),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    image_url = None
    if file:
        os.makedirs("uploads", exist_ok=True)
        file_path = f"uploads/{file.filename}"
        with open(file_path, "wb") as f:
            f.write(await file.read())
        image_url = f"/{file_path}"

    new_complaint = models.Complaint(
        user_id=user_id,
        title=title,
        category=category,
        location=location,
        description=description,
        status="Pending",
        image_url=image_url
    )
    db.add(new_complaint)
    db.commit()
    db.refresh(new_complaint)
    return {"message": "Complaint submitted successfully", "complaint": new_complaint}


@app.get("/complaints/user/{user_id}")
def get_user_complaints(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Complaint).filter(models.Complaint.user_id == user_id).all()


@app.get("/complaints/{complaint_id}/history")
def get_complaint_history(complaint_id: int, db: Session = Depends(get_db)):
    updates = db.query(models.Update).filter(models.Update.complaint_id == complaint_id).all()
    return {"complaint_id": complaint_id, "history": updates}


@app.patch("/complaints/{complaint_id}/status")
def update_complaint_status(
    complaint_id: int,
    status: str = Form(...),
    message: str = Form(...),
    updated_by: str = Form(...),
    db: Session = Depends(get_db)
):
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    prev_status = complaint.status
    complaint.status = status
    
    # Track update history
    status_update = models.Update(
        complaint_id=complaint_id,
        previous_status=prev_status,
        new_status=status,
        message=message,
        updated_by=updated_by
    )
    
    # Notify user automatically
    notification = models.Notification(
        user_id=complaint.user_id,
        message=f"Your complaint '{complaint.title}' status was updated to {status}."
    )
    
    db.add(status_update)
    db.add(notification)
    db.commit()
    
    return {"message": "Complaint status updated successfully", "current_status": status}

# ---------------------------------------------------------
# NOTIFICATIONS ENDPOINTS
# ---------------------------------------------------------

@app.get("/notifications/{user_id}")
def get_user_notifications(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Notification).filter(models.Notification.user_id == user_id).all()