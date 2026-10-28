import os
import sys

# Ensure backend directory is in python search path regardless of where uvicorn is launched
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import uuid
import secrets
import hashlib
import shutil
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Query,
    UploadFile,
    File,
    Form,
    status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from pydantic import BaseModel

import models
import database

# Ensure database tables exist
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(
    title="FixOAU Backend API",
    description="Centralized student complaint and maintenance tracking system for OAU",
    version="2.0.0"
)

# CORS Configuration
_cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins if _cors_origins else ["*"],
    allow_credentials=True if _cors_origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount upload static files
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Configuration Constants
ADMIN_ACCESS_CODE = os.environ.get("ADMIN_ACCESS_CODE", "FIXOAU-ADMIN")
MAX_PHOTOS = 5
MAX_PHOTO_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif"
}
DEFAULT_CATEGORIES = [
    "Faulty lights",
    "Water problems",
    "Damaged facilities",
    "Blocked drainage",
    "Broken doors and windows",
    "Electrical fault",
    "Other"
]
DEFAULT_LOCATIONS = [
    "Angola Hall",
    "Moremi Hall",
    "Mozambique Hall",
    "Awolowo Hall",
    "Fajuyi Hall",
    "Student Union Building",
    "Amphitheatre",
    "Library",
    "Lecture hall"
]

# --- SECURITY & AUTHENTICATION UTILITIES ---

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"pbkdf2:sha256:100000${salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    if not hashed_password.startswith("pbkdf2:sha256:"):
        return plain_password == hashed_password
    try:
        parts = hashed_password.split("$")
        salt, key = parts[1], parts[2]
        new_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100_000)
        return secrets.compare_digest(new_key.hex(), key)
    except Exception:
        return False

security_scheme = HTTPBearer(auto_error=False)

def create_session_token(db: Session, user_id: int) -> str:
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    db_token = models.Token(token_hash=token_hash, user_id=user_id, expires_at=expires)
    db.add(db_token)
    db.commit()
    return raw_token

def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(database.get_db)
) -> models.User:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    token_hash = hashlib.sha256(creds.credentials.encode("utf-8")).hexdigest()
    db_token = db.query(models.Token).filter(models.Token.token_hash == token_hash).first()
    
    if not db_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token")
    
    now = datetime.now(timezone.utc)
    token_exp = db_token.expires_at
    if token_exp.tzinfo is None:
        token_exp = token_exp.replace(tzinfo=timezone.utc)
        
    if token_exp < now:
        db.delete(db_token)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
        
    user = db.query(models.User).filter(models.User.id == db_token.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account not found")
        
    return user

def require_role(role: str):
    def checker(user: models.User = Depends(get_current_user)):
        if (user.role or "").lower() != role.lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Access denied: {role} privilege required")
        return user
    return checker


# --- PYDANTIC SCHEMAS ---

class UserRegister(BaseModel):
    role: str = "student"
    login_id: str
    full_name: str
    email: str
    password: str
    access_code: Optional[str] = None

class UserLogin(BaseModel):
    role: str = "student"
    login_id: str
    password: str

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ComplaintPatchRequest(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    note: Optional[str] = None


# --- AUTH & PROFILE ROUTES ---

@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(req: UserRegister, db: Session = Depends(database.get_db)):
    role = req.role.lower().strip()
    if role not in ("student", "admin"):
        raise HTTPException(status_code=400, detail="Invalid user role specified")

    if role == "admin":
        if not req.access_code or req.access_code.strip() != ADMIN_ACCESS_CODE:
            raise HTTPException(status_code=400, detail="Invalid administrative access code")

    login_id_clean = req.login_id.strip()
    email_clean = req.email.strip().lower()

    existing = db.query(models.User).filter(
        or_(
            func.lower(models.User.email) == email_clean,
            (func.lower(models.User.matric_number) == login_id_clean.lower()) & (models.User.role == role)
        )
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail="Account with this Email or Login ID already exists")

    hashed_pw = hash_password(req.password)
    new_user = models.User(
        role=role,
        matric_number=login_id_clean,
        name=req.full_name.strip(),
        email=email_clean,
        password=hashed_pw
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully", "id": new_user.id}

@app.post("/api/auth/login")
@app.post("/auth/login")
def login(req: UserLogin, db: Session = Depends(database.get_db)):
    role = req.role.lower().strip()
    login_id_clean = req.login_id.strip()

    user = db.query(models.User).filter(
        func.lower(models.User.matric_number) == login_id_clean.lower(),
        models.User.role == role
    ).first()

    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid login ID or password")

    # Upgrade plaintext passwords automatically on successful login
    if not user.password.startswith("pbkdf2:sha256:"):
        user.password = hash_password(req.password)
        db.commit()

    token = create_session_token(db, user.id)
    return {
        "user": user.to_dict(),
        "token": token
    }

@app.post("/api/auth/logout")
@app.post("/auth/logout")
def logout(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(database.get_db)
):
    if creds and creds.credentials:
        token_hash = hashlib.sha256(creds.credentials.encode("utf-8")).hexdigest()
        db.query(models.Token).filter(models.Token.token_hash == token_hash).delete()
        db.commit()
    return {"message": "Logged out successfully"}

@app.get("/api/auth/me")
@app.get("/auth/me")
def get_me(user: models.User = Depends(get_current_user)):
    return {"user": user.to_dict()}

@app.patch("/api/auth/me")
@app.patch("/auth/me")
def update_me(
    req: ProfileUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    if req.email and req.email.strip().lower() != (user.email or "").lower():
        email_clean = req.email.strip().lower()
        taken = db.query(models.User).filter(func.lower(models.User.email) == email_clean).first()
        if taken:
            raise HTTPException(status_code=409, detail="Email is already in use by another account")
        user.email = email_clean

    if req.full_name is not None:
        user.name = req.full_name.strip()
    if req.phone is not None:
        user.phone = req.phone.strip()

    db.commit()
    db.refresh(user)
    return {"user": user.to_dict()}

@app.post("/api/auth/change-password")
@app.post("/auth/change-password")
def change_password(
    req: ChangePasswordRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    if not verify_password(req.current_password, user.password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    user.password = hash_password(req.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


# --- METADATA ---

@app.get("/api/meta")
@app.get("/meta")
def get_metadata():
    return {
        "categories": DEFAULT_CATEGORIES,
        "locations": DEFAULT_LOCATIONS
    }


# --- STUDENT PORTAL ENDPOINTS ---

@app.get("/api/student/dashboard")
@app.get("/student/dashboard")
def student_dashboard(
    user: models.User = Depends(require_role("student")),
    db: Session = Depends(database.get_db)
):
    complaints = db.query(models.Complaint).filter(models.Complaint.user_id == user.id).all()
    
    total = len(complaints)
    pending = sum(1 for c in complaints if (c.status or "").lower() == "pending")
    in_progress = sum(1 for c in complaints if (c.status or "").lower() == "in progress")
    resolved = sum(1 for c in complaints if (c.status or "").lower() == "resolved")
    
    recent = (
        db.query(models.Complaint)
        .filter(models.Complaint.user_id == user.id)
        .order_by(desc(models.Complaint.created_at))
        .limit(5)
        .all()
    )

    return {
        "stats": {
            "total": total,
            "pending": pending,
            "in_progress": in_progress,
            "resolved": resolved
        },
        "recent": [c.to_summary_dict() for c in recent]
    }

@app.get("/api/student/complaints")
@app.get("/student/complaints")
def student_complaints_list(
    status: Optional[str] = "",
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    user: models.User = Depends(require_role("student")),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Complaint).filter(models.Complaint.user_id == user.id)
    if status and status.strip() and status.lower() != "all":
        query = query.filter(func.lower(models.Complaint.status) == status.strip().lower())

    total = query.count()
    items = (
        query.order_by(desc(models.Complaint.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "items": [c.to_summary_dict() for c in items],
        "total": total,
        "page": page,
        "per_page": per_page
    }

@app.post("/api/student/complaints", status_code=status.HTTP_201_CREATED)
@app.post("/student/complaints", status_code=status.HTTP_201_CREATED)
async def create_student_complaint(
    title: str = Form(...),
    category: str = Form(...),
    location: str = Form(...),
    description: str = Form(...),
    photos: List[UploadFile] = File(default=[]),
    user: models.User = Depends(require_role("student")),
    db: Session = Depends(database.get_db)
):
    if len(photos) > MAX_PHOTOS:
        raise HTTPException(status_code=400, detail=f"Maximum of {MAX_PHOTOS} photos allowed")

    saved_photo_urls = []
    for file in photos:
        if not file.filename:
            continue
            
        content_type = file.content_type or ""
        ext = ALLOWED_IMAGE_TYPES.get(content_type)
        if not ext:
            _, raw_ext = os.path.splitext(file.filename)
            ext = raw_ext.lower() if raw_ext.lower() in [".jpg", ".jpeg", ".png", ".webp", ".gif"] else ".jpg"

        unique_name = f"{uuid.uuid4().hex}{ext}"
        destination = os.path.join(UPLOAD_DIR, unique_name)

        content = await file.read()
        if len(content) > MAX_PHOTO_BYTES:
            raise HTTPException(status_code=400, detail=f"File {file.filename} exceeds maximum size of 5 MB")

        with open(destination, "wb") as f:
            f.write(content)

        saved_photo_urls.append(f"/uploads/{unique_name}")

    now = datetime.now(timezone.utc)
    new_complaint = models.Complaint(
        user_id=user.id,
        title=title.strip(),
        category=category.strip(),
        location=location.strip(),
        description=description.strip(),
        status="Pending",
        image_urls=saved_photo_urls,
        created_at=now,
        updated_at=now
    )
    db.add(new_complaint)
    db.commit()
    db.refresh(new_complaint)

    # Initial history log
    initial_update = models.Update(
        complaint_id=new_complaint.id,
        message="Complaint submitted by student",
        status="Pending",
        author="System",
        created_at=now
    )
    db.add(initial_update)

    # Notify all admin staff
    admins = db.query(models.User).filter(models.User.role == "admin").all()
    for admin in admins:
        notif = models.Notification(
            user_id=admin.id,
            type="new_complaint",
            message=f"{new_complaint.ref}: {new_complaint.title} reported at {new_complaint.location}",
            complaint_id=new_complaint.id,
            created_at=now
        )
        db.add(notif)

    db.commit()
    return {"complaint": new_complaint.to_detail_dict()}

@app.get("/api/student/complaints/{complaint_id}")
@app.get("/student/complaints/{complaint_id}")
def get_student_complaint(
    complaint_id: int,
    user: models.User = Depends(require_role("student")),
    db: Session = Depends(database.get_db)
):
    complaint = db.query(models.Complaint).filter(
        models.Complaint.id == complaint_id,
        models.Complaint.user_id == user.id
    ).first()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    return {"complaint": complaint.to_detail_dict()}


# --- ADMIN CONSOLE ENDPOINTS ---

@app.get("/api/admin/dashboard")
@app.get("/admin/dashboard")
def admin_dashboard(
    user: models.User = Depends(require_role("admin")),
    db: Session = Depends(database.get_db)
):
    complaints = db.query(models.Complaint).all()
    
    total = len(complaints)
    pending = sum(1 for c in complaints if (c.status or "").lower() == "pending")
    in_progress = sum(1 for c in complaints if (c.status or "").lower() == "in progress")
    resolved = sum(1 for c in complaints if (c.status or "").lower() == "resolved")
    
    recent = (
        db.query(models.Complaint)
        .order_by(desc(models.Complaint.created_at))
        .limit(5)
        .all()
    )

    return {
        "stats": {
            "total": total,
            "pending": pending,
            "in_progress": in_progress,
            "resolved": resolved
        },
        "recent": [c.to_summary_dict() for c in recent]
    }

@app.get("/api/admin/complaints")
@app.get("/admin/complaints")
def admin_complaints_list(
    q: Optional[str] = "",
    status: Optional[str] = "",
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    user: models.User = Depends(require_role("admin")),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Complaint)

    if q and q.strip():
        search = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(models.Complaint.title).like(search),
                func.lower(models.Complaint.location).like(search),
                func.lower(models.Complaint.category).like(search),
                models.Complaint.id.cast(models.String).like(search.replace("fix-", ""))
            )
        )

    if status and status.strip() and status.lower() != "all":
        query = query.filter(func.lower(models.Complaint.status) == status.strip().lower())

    total = query.count()
    items = (
        query.order_by(desc(models.Complaint.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "items": [c.to_summary_dict() for c in items],
        "total": total,
        "page": page,
        "per_page": per_page
    }

@app.get("/api/admin/complaints/{complaint_id}")
@app.get("/admin/complaints/{complaint_id}")
def get_admin_complaint(
    complaint_id: int,
    user: models.User = Depends(require_role("admin")),
    db: Session = Depends(database.get_db)
):
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    return {"complaint": complaint.to_detail_dict(include_student=True)}

@app.patch("/api/admin/complaints/{complaint_id}")
@app.patch("/admin/complaints/{complaint_id}")
def patch_admin_complaint(
    complaint_id: int,
    req: ComplaintPatchRequest,
    user: models.User = Depends(require_role("admin")),
    db: Session = Depends(database.get_db)
):
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    changed = False
    now = datetime.now(timezone.utc)
    status_changed = False

    if req.status is not None and req.status.strip() and req.status.strip() != complaint.status:
        complaint.status = req.status.strip()
        status_changed = True
        changed = True
        if complaint.status.lower() == "resolved":
            complaint.resolved_at = now

    if req.assigned_to is not None and req.assigned_to != complaint.assigned_to:
        complaint.assigned_to = req.assigned_to.strip()
        changed = True

    if req.note is not None and req.note.strip():
        changed = True

    if not changed:
        raise HTTPException(status_code=400, detail="No changes detected in request")

    complaint.updated_at = now

    # Record update timeline entry
    action_note = req.note.strip() if req.note and req.note.strip() else f"Status changed to {complaint.status}"
    update_log = models.Update(
        complaint_id=complaint.id,
        message=action_note,
        status=complaint.status,
        author=user.name or "Admin Staff",
        created_at=now
    )
    db.add(update_log)

    # Notify student
    if complaint.user_id:
        notif_type = "resolved" if complaint.status.lower() == "resolved" else "status_changed"
        notif = models.Notification(
            user_id=complaint.user_id,
            type=notif_type,
            message=f"{complaint.ref}: Status updated to '{complaint.status}' - {action_note}",
            complaint_id=complaint.id,
            created_at=now
        )
        db.add(notif)

    db.commit()
    db.refresh(complaint)
    return {"complaint": complaint.to_detail_dict(include_student=True)}

@app.get("/api/admin/reports")
@app.get("/admin/reports")
def admin_reports(
    user: models.User = Depends(require_role("admin")),
    db: Session = Depends(database.get_db)
):
    all_complaints = db.query(models.Complaint).all()
    total = len(all_complaints)
    unassigned = sum(1 for c in all_complaints if not c.assigned_to or not c.assigned_to.strip())
    resolved = [c for c in all_complaints if (c.status or "").lower() == "resolved"]
    resolved_count = len(resolved)
    
    resolution_rate = round((resolved_count / total * 100), 1) if total > 0 else 0.0

    # Calculate average resolution hours
    total_hours = 0.0
    resolved_with_time = 0
    for c in resolved:
        if c.created_at and c.resolved_at:
            t_created = c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at
            t_resolved = c.resolved_at.replace(tzinfo=timezone.utc) if c.resolved_at.tzinfo is None else c.resolved_at
            delta = t_resolved - t_created
            hours = delta.total_seconds() / 3600.0
            if hours >= 0:
                total_hours += hours
                resolved_with_time += 1
                
    avg_resolution_hours = round(total_hours / resolved_with_time, 1) if resolved_with_time > 0 else 0.0

    # Group by status
    status_counts = {}
    for c in all_complaints:
        st = c.status or "Pending"
        status_counts[st] = status_counts.get(st, 0) + 1
    by_status = [{"label": k, "count": v} for k, v in status_counts.items()]

    # Group by category
    cat_counts = {}
    for c in all_complaints:
        cat = c.category or "Other"
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
    by_category = [{"label": k, "count": v} for k, v in cat_counts.items()]

    # Weekly distribution (last 7 days)
    now = datetime.now(timezone.utc)
    weekly_map = {}
    for i in range(6, -1, -1):
        day_str = (now - timedelta(days=i)).strftime("%a")
        weekly_map[day_str] = 0

    for c in all_complaints:
        if c.created_at:
            created_tz = c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at
            if (now - created_tz).days < 7:
                day_key = created_tz.strftime("%a")
                if day_key in weekly_map:
                    weekly_map[day_key] += 1

    weekly = [{"label": k, "count": v} for k, v in weekly_map.items()]

    return {
        "total": total,
        "unassigned": unassigned,
        "resolution_rate": resolution_rate,
        "avg_resolution_hours": avg_resolution_hours,
        "by_status": by_status,
        "by_category": by_category,
        "weekly": weekly
    }


# --- NOTIFICATIONS (Both Roles) ---

@app.get("/api/notifications")
@app.get("/notifications")
def get_notifications(
    filter: str = Query("all", alias="filter"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Notification).filter(models.Notification.user_id == user.id)
    if filter.lower() == "unread":
        query = query.filter(models.Notification.is_read == False)

    total = query.count()
    items = (
        query.order_by(desc(models.Notification.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "items": [n.to_dict() for n in items],
        "total": total,
        "page": page,
        "per_page": per_page
    }

@app.get("/api/notifications/unread-count")
@app.get("/notifications/unread-count")
def get_unread_count(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    unread = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user.id, models.Notification.is_read == False)
        .count()
    )
    return {"unread": unread}

@app.post("/api/notifications/{notification_id}/read")
@app.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    notif = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == user.id
    ).first()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}

@app.post("/api/notifications/read-all")
@app.post("/notifications/read-all")
def mark_all_notifications_read(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    db.query(models.Notification).filter(
        models.Notification.user_id == user.id,
        models.Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}

# Serve Frontend static assets directly if accessed via this host
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
