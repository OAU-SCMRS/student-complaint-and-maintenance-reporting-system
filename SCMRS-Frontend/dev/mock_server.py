"""
Reference implementation of docs/API_CONTRACT.md  (FastAPI + SQLite).

Purpose: develop / test the front end without your real backend, and show exactly what
the front end sends and expects. It is NOT meant to replace your backend.

    pip install fastapi "uvicorn[standard]" python-multipart
    python dev/mock_server.py          # http://127.0.0.1:8000  (serves the front end too)
    # or: uvicorn dev.mock_server:app --reload --port 8000   (run from the project root)

Auth is an opaque bearer token: POST /api/auth/login returns it, the front end sends
"Authorization: Bearer <token>" on every call, POST /api/auth/logout revokes it.
Errors use FastAPI's native {"detail": ...} shape (the front end understands it).

Environment variables
    ADMIN_ACCESS_CODE   admin sign-up code (default "FIXOAU-ADMIN")
    SCMRS_DB            path of the SQLite file (default dev/mock.db)
    CORS_ORIGINS        comma-separated origins, only needed when the front end is served from
                        another origin, e.g. "http://127.0.0.1:5500"
    PORT                default 8000
"""
import hashlib
import hmac
import os
import secrets
import sqlite3
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
UPLOADS = os.path.join(HERE, "uploads")
DB = os.environ.get("SCMRS_DB", os.path.join(HERE, "mock.db"))
os.makedirs(UPLOADS, exist_ok=True)

ADMIN_CODE = os.environ.get("ADMIN_ACCESS_CODE", "FIXOAU-ADMIN")
TOKEN_HOURS = 12
MAX_PHOTOS = 5
MAX_PHOTO_BYTES = 5 * 1024 * 1024
IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
STATUSES = ["Pending", "In Progress", "Resolved"]
CATEGORIES = ["Faulty lights", "Water problems", "Damaged facilities", "Blocked drainage",
              "Broken doors and windows", "Electrical fault", "Other"]
LOCATIONS = ["Angola Hall", "Moremi Hall", "Mozambique Hall", "Awolowo Hall", "Fajuyi Hall",
             "Student Union Building", "Amphitheatre", "Library", "Lecture hall"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, role TEXT NOT NULL, login_id TEXT NOT NULL, full_name TEXT NOT NULL,
  email TEXT NOT NULL, phone TEXT DEFAULT '', password_hash TEXT NOT NULL,
  UNIQUE(role, login_id), UNIQUE(email));
CREATE TABLE IF NOT EXISTS tokens(
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS complaints(
  id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, title TEXT, category TEXT, location TEXT,
  description TEXT, status TEXT DEFAULT 'Pending', assigned_to TEXT,
  created_at TEXT, updated_at TEXT, resolved_at TEXT);
CREATE TABLE IF NOT EXISTS photos(id INTEGER PRIMARY KEY, complaint_id INTEGER, filename TEXT);
CREATE TABLE IF NOT EXISTS updates(
  id INTEGER PRIMARY KEY, complaint_id INTEGER, message TEXT, status TEXT, author TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY, user_id INTEGER, type TEXT, message TEXT, complaint_id INTEGER,
  is_read INTEGER DEFAULT 0, created_at TEXT);
"""


@asynccontextmanager
async def lifespan(_app):
    conn = sqlite3.connect(DB)
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
    yield


app = FastAPI(title="FixOAU mock API", lifespan=lifespan)

_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
if _origins:
    app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_methods=["*"],
                       allow_headers=["Authorization", "Content-Type"], allow_credentials=True)


# ------------------------------------------------------------------ helpers
def get_db():
    # Sync endpoints run in a thread pool, so one request can touch the connection from
    # more than one thread: check_same_thread=False. Each request still gets its own connection.
    conn = sqlite3.connect(DB, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def now():
    return datetime.now(timezone.utc).isoformat()


def hash_password(pw: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)
    return f"{salt.hex()}${digest.hex()}"


def check_password(pw: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        digest = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt_hex), 200_000)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except ValueError:
        return False


def strong_password(pw: str) -> bool:
    return len(pw) >= 8 and any(c.isalpha() for c in pw) and any(c.isdigit() for c in pw)


PASSWORD_RULE = "Password must be at least 8 characters and include a letter and a number."


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def user_json(u):
    return {"id": u["id"], "role": u["role"], "login_id": u["login_id"],
            "full_name": u["full_name"], "email": u["email"], "phone": u["phone"] or ""}


bearer = HTTPBearer(auto_error=False)


def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer), db=Depends(get_db)):
    """401 when logged out or the token expired."""
    if not creds:
        raise HTTPException(401, "Please log in.", headers={"WWW-Authenticate": "Bearer"})
    row = db.execute(
        "SELECT u.* FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash=? AND t.expires_at>?",
        (token_hash(creds.credentials), now())).fetchone()
    if not row:
        raise HTTPException(401, "Please log in.", headers={"WWW-Authenticate": "Bearer"})
    return row


def require(role: Optional[str]):
    """Dependency factory: 401 if logged out, 403 if the account has the wrong role."""
    def dep(user=Depends(current_user)):
        if role and user["role"] != role:
            raise HTTPException(403, "You do not have permission to do that.")
        return user
    return dep


def notify(db, user_id, type_, message, complaint_id=None):
    db.execute("INSERT INTO notifications(user_id,type,message,complaint_id,created_at) VALUES(?,?,?,?,?)",
               (user_id, type_, message, complaint_id, now()))


def ref(cid):
    return f"FIX-{cid:04d}"


def complaint_json(db, row, full=False):
    d = {"id": row["id"], "ref": ref(row["id"]), "title": row["title"], "category": row["category"],
         "location": row["location"], "status": row["status"], "assigned_to": row["assigned_to"] or "",
         "created_at": row["created_at"], "updated_at": row["updated_at"]}
    if full:
        d["description"] = row["description"]
        d["photos"] = ["/uploads/" + p["filename"] for p in
                       db.execute("SELECT filename FROM photos WHERE complaint_id=?", (row["id"],))]
        d["updates"] = [dict(u) for u in db.execute(
            "SELECT message,status,author,created_at FROM updates WHERE complaint_id=? ORDER BY id", (row["id"],))]
        s = db.execute("SELECT full_name,login_id FROM users WHERE id=?", (row["student_id"],)).fetchone()
        d["student"] = {"id": row["student_id"], "name": s["full_name"], "login_id": s["login_id"]}
    return d


def paged(db, sql, args, count_sql, page, per_page):
    total = db.execute(count_sql, args).fetchone()[0]
    rows = db.execute(sql + " LIMIT ? OFFSET ?", (*args, per_page, (page - 1) * per_page)).fetchall()
    return rows, {"total": total, "page": page, "per_page": per_page}


def stats_for(db, where="", args=()):
    rows = db.execute(f"SELECT status, COUNT(*) n FROM complaints {where} GROUP BY status", args).fetchall()
    by = {r["status"]: r["n"] for r in rows}
    return {"total": sum(by.values()), "pending": by.get("Pending", 0),
            "in_progress": by.get("In Progress", 0), "resolved": by.get("Resolved", 0)}


# ------------------------------------------------------------------ request bodies
class RegisterIn(BaseModel):
    role: Literal["student", "admin"]
    login_id: str
    full_name: str
    email: str
    password: str
    access_code: Optional[str] = None


class LoginIn(BaseModel):
    role: Literal["student", "admin"]
    login_id: str
    password: str


class ProfileIn(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class PasswordIn(BaseModel):
    current_password: str
    new_password: str


class ComplaintPatch(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    note: Optional[str] = None


# ------------------------------------------------------------------ auth
@app.post("/api/auth/register", status_code=201)
def register(body: RegisterIn, db=Depends(get_db)):
    login_id, name, email = body.login_id.strip(), body.full_name.strip(), body.email.strip().lower()
    if not (login_id and name and email and body.password):
        raise HTTPException(400, "Fill in every field.")
    if "@" not in email:
        raise HTTPException(400, "Enter a valid email address.")
    if not strong_password(body.password):
        raise HTTPException(400, PASSWORD_RULE)
    if body.role == "admin" and not hmac.compare_digest((body.access_code or "").encode(), ADMIN_CODE.encode()):
        raise HTTPException(403, "That admin access code is not valid.")
    try:
        db.execute("INSERT INTO users(role,login_id,full_name,email,password_hash) VALUES(?,?,?,?,?)",
                   (body.role, login_id, name, email, hash_password(body.password)))
        db.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(409, "An account with that ID or email already exists.")
    return {"message": "Account created."}


@app.post("/api/auth/login")
def login(body: LoginIn, db=Depends(get_db)):
    u = db.execute("SELECT * FROM users WHERE role=? AND login_id=?", (body.role, body.login_id.strip())).fetchone()
    if not u or not check_password(body.password, u["password_hash"]):
        raise HTTPException(401, "Incorrect ID or password.")
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS)).isoformat()
    db.execute("DELETE FROM tokens WHERE expires_at<?", (now(),))
    db.execute("INSERT INTO tokens(token_hash,user_id,expires_at) VALUES(?,?,?)", (token_hash(token), u["id"], expires))
    db.commit()
    # "token" is what the front end reads; "access_token"/"token_type" are the OAuth2 names, also accepted.
    return {"user": user_json(u), "token": token, "access_token": token, "token_type": "bearer"}


@app.post("/api/auth/logout")
def logout(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer), db=Depends(get_db)):
    # Always 200, even with no/expired token: logging out twice must not be an error.
    if creds:
        db.execute("DELETE FROM tokens WHERE token_hash=?", (token_hash(creds.credentials),))
        db.commit()
    return {"message": "Logged out."}


@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return {"user": user_json(user)}


@app.patch("/api/auth/me")
def update_me(body: ProfileIn, user=Depends(current_user), db=Depends(get_db)):
    name = (body.full_name if body.full_name is not None else user["full_name"]).strip()
    email = (body.email if body.email is not None else user["email"]).strip().lower()
    phone = (body.phone if body.phone is not None else user["phone"] or "").strip()
    if not name or "@" not in email:
        raise HTTPException(400, "Enter your name and a valid email address.")
    try:
        db.execute("UPDATE users SET full_name=?, email=?, phone=? WHERE id=?", (name, email, phone, user["id"]))
        db.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(409, "That email is already in use.")
    return {"user": user_json(db.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone())}


@app.post("/api/auth/change-password")
def change_password(body: PasswordIn, user=Depends(current_user), db=Depends(get_db)):
    # 400, not 401: a wrong current password must not look like an expired session.
    if not check_password(body.current_password, user["password_hash"]):
        raise HTTPException(400, "Your current password is not correct.")
    if not strong_password(body.new_password):
        raise HTTPException(400, PASSWORD_RULE)
    db.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(body.new_password), user["id"]))
    db.commit()
    return {"message": "Password updated."}


@app.get("/api/meta")
def meta(_user=Depends(current_user)):
    return {"categories": CATEGORIES, "locations": LOCATIONS}


# ------------------------------------------------------------------ student
@app.get("/api/student/dashboard")
def student_dashboard(user=Depends(require("student")), db=Depends(get_db)):
    recent = db.execute("SELECT * FROM complaints WHERE student_id=? ORDER BY id DESC LIMIT 5", (user["id"],)).fetchall()
    return {"stats": stats_for(db, "WHERE student_id=?", (user["id"],)),
            "recent": [complaint_json(db, r) for r in recent]}


@app.get("/api/student/complaints")
def student_complaints(status: str = "", page: int = Query(1, ge=1), per_page: int = Query(10, ge=1, le=100),
                       user=Depends(require("student")), db=Depends(get_db)):
    where, args = "WHERE student_id=?", [user["id"]]
    if status in STATUSES:
        where += " AND status=?"
        args.append(status)
    rows, info = paged(db, f"SELECT * FROM complaints {where} ORDER BY id DESC", args,
                       f"SELECT COUNT(*) FROM complaints {where}", page, per_page)
    return {"items": [complaint_json(db, r) for r in rows], **info}


@app.post("/api/student/complaints", status_code=201)
def create_complaint(title: str = Form(...), category: str = Form(...), location: str = Form(...),
                     description: str = Form(...), photos: List[UploadFile] = File(default=[]),
                     user=Depends(require("student")), db=Depends(get_db)):
    title, category, location, description = (v.strip() for v in (title, category, location, description))
    if not (title and category and location and description):
        raise HTTPException(400, "Fill in every required field.")
    photos = [p for p in photos if p and p.filename]
    if len(photos) > MAX_PHOTOS:
        raise HTTPException(400, f"You can attach up to {MAX_PHOTOS} photos.")

    # Validate every file before anything is written, so a bad photo never leaves a half-made complaint.
    saved = []
    for f in photos:
        ext = IMAGE_TYPES.get(f.content_type or "")
        if not ext:
            raise HTTPException(400, "Photos must be JPG, PNG, WEBP or GIF images.")
        data = f.file.read(MAX_PHOTO_BYTES + 1)
        if len(data) > MAX_PHOTO_BYTES:
            raise HTTPException(413, f"Each photo must be {MAX_PHOTO_BYTES // (1024 * 1024)} MB or smaller.")
        saved.append((f"{uuid.uuid4().hex}{ext}", data))

    ts = now()
    cur = db.execute("INSERT INTO complaints(student_id,title,category,location,description,created_at,updated_at) "
                     "VALUES(?,?,?,?,?,?,?)", (user["id"], title, category, location, description, ts, ts))
    cid = cur.lastrowid
    for name, data in saved:
        with open(os.path.join(UPLOADS, name), "wb") as out:
            out.write(data)
        db.execute("INSERT INTO photos(complaint_id,filename) VALUES(?,?)", (cid, name))
    for a in db.execute("SELECT id FROM users WHERE role='admin'").fetchall():
        notify(db, a["id"], "new_complaint", f"New complaint {ref(cid)}: {title}", cid)
    db.commit()
    return {"complaint": complaint_json(db, db.execute("SELECT * FROM complaints WHERE id=?", (cid,)).fetchone())}


@app.get("/api/student/complaints/{cid}")
def student_complaint(cid: int, user=Depends(require("student")), db=Depends(get_db)):
    r = db.execute("SELECT * FROM complaints WHERE id=? AND student_id=?", (cid, user["id"])).fetchone()
    if not r:
        raise HTTPException(404, "Complaint not found.")
    return {"complaint": complaint_json(db, r, True)}


# ------------------------------------------------------------------ admin
@app.get("/api/admin/dashboard")
def admin_dashboard(_user=Depends(require("admin")), db=Depends(get_db)):
    recent = db.execute("SELECT * FROM complaints ORDER BY id DESC LIMIT 5").fetchall()
    return {"stats": stats_for(db), "recent": [complaint_json(db, r) for r in recent]}


@app.get("/api/admin/complaints")
def admin_complaints(q: str = "", status: str = "", page: int = Query(1, ge=1),
                     per_page: int = Query(10, ge=1, le=100),
                     _user=Depends(require("admin")), db=Depends(get_db)):
    where, args = "WHERE 1=1", []
    if status in STATUSES:
        where += " AND status=?"
        args.append(status)
    q = q.strip()
    if q:
        where += " AND (title LIKE ? OR location LIKE ? OR ('FIX-' || printf('%04d', id)) LIKE ?)"
        args += [f"%{q}%"] * 3
    rows, info = paged(db, f"SELECT * FROM complaints {where} ORDER BY id DESC", args,
                       f"SELECT COUNT(*) FROM complaints {where}", page, per_page)
    return {"items": [complaint_json(db, r) for r in rows], **info}


@app.get("/api/admin/complaints/{cid}")
def admin_complaint(cid: int, _user=Depends(require("admin")), db=Depends(get_db)):
    r = db.execute("SELECT * FROM complaints WHERE id=?", (cid,)).fetchone()
    if not r:
        raise HTTPException(404, "Complaint not found.")
    return {"complaint": complaint_json(db, r, True)}


@app.patch("/api/admin/complaints/{cid}")
def update_complaint(cid: int, body: ComplaintPatch, user=Depends(require("admin")), db=Depends(get_db)):
    r = db.execute("SELECT * FROM complaints WHERE id=?", (cid,)).fetchone()
    if not r:
        raise HTTPException(404, "Complaint not found.")
    status, assigned, note = body.status, body.assigned_to, (body.note or "").strip()
    if status is not None and status not in STATUSES:
        raise HTTPException(400, "Unknown status.")

    ts, parts = now(), []
    status_changed = status is not None and status != r["status"]
    new_status = status if status is not None else r["status"]
    if status_changed:
        db.execute("UPDATE complaints SET status=?, resolved_at=? WHERE id=?",
                   (status, ts if status == "Resolved" else None, cid))
        parts.append(f"is now {status}")
    if assigned is not None and assigned != (r["assigned_to"] or ""):
        db.execute("UPDATE complaints SET assigned_to=? WHERE id=?", (assigned, cid))
        parts.append(f"has been assigned to {assigned}" if assigned else "is no longer assigned")
    if not parts and not note:
        raise HTTPException(400, "Nothing to update.")

    db.execute("UPDATE complaints SET updated_at=? WHERE id=?", (ts, cid))
    message = note or f"Your complaint {ref(cid)} " + " and ".join(parts) + "."
    db.execute("INSERT INTO updates(complaint_id,message,status,author,created_at) VALUES(?,?,?,?,?)",
               (cid, message, new_status if status is not None else None, user["full_name"], ts))
    if status_changed and new_status == "Resolved":
        ntype = "resolved"
    elif status_changed:
        ntype = "status_changed"
    else:
        ntype = "update_added"
    notify(db, r["student_id"], ntype, f"{ref(cid)}: {message}", cid)
    db.commit()
    r = db.execute("SELECT * FROM complaints WHERE id=?", (cid,)).fetchone()
    return {"complaint": complaint_json(db, r, True)}


@app.get("/api/admin/reports")
def admin_reports(_user=Depends(require("admin")), db=Depends(get_db)):
    s = stats_for(db)
    by_cat = db.execute("SELECT category label, COUNT(*) count FROM complaints "
                        "GROUP BY category ORDER BY count DESC").fetchall()
    resolved = db.execute("SELECT created_at, resolved_at FROM complaints WHERE resolved_at IS NOT NULL").fetchall()
    hours = [(datetime.fromisoformat(x["resolved_at"]) - datetime.fromisoformat(x["created_at"])).total_seconds() / 3600
             for x in resolved]
    unassigned = db.execute("SELECT COUNT(*) FROM complaints "
                            "WHERE (assigned_to IS NULL OR assigned_to='') AND status!='Resolved'").fetchone()[0]
    weeks = []
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=today.weekday())
    for i in range(5, -1, -1):
        w0 = start - timedelta(weeks=i)
        n = db.execute("SELECT COUNT(*) FROM complaints WHERE substr(created_at,1,10)>=? AND substr(created_at,1,10)<?",
                       (w0.isoformat(), (w0 + timedelta(days=7)).isoformat())).fetchone()[0]
        weeks.append({"label": w0.strftime("%d %b"), "count": n})
    return {
        "total": s["total"], "unassigned": unassigned,
        "resolution_rate": round(100 * s["resolved"] / s["total"], 1) if s["total"] else 0,
        "avg_resolution_hours": round(sum(hours) / len(hours), 2) if hours else 0,
        "by_status": [{"label": k, "count": v} for k, v in
                      (("Pending", s["pending"]), ("In Progress", s["in_progress"]), ("Resolved", s["resolved"]))],
        "by_category": [dict(r) for r in by_cat], "weekly": weeks}


# ------------------------------------------------------------------ notifications (both roles)
@app.get("/api/notifications")
def notifications(filter_: str = Query("all", alias="filter"), page: int = Query(1, ge=1),
                  per_page: int = Query(10, ge=1, le=100),
                  user=Depends(current_user), db=Depends(get_db)):
    where, args = "WHERE user_id=?", [user["id"]]
    if filter_ == "unread":
        where += " AND is_read=0"
    rows, info = paged(db, f"SELECT * FROM notifications {where} ORDER BY id DESC", args,
                       f"SELECT COUNT(*) FROM notifications {where}", page, per_page)
    return {"items": [{**dict(r), "is_read": bool(r["is_read"])} for r in rows], **info}


@app.get("/api/notifications/unread-count")
def unread_count(user=Depends(current_user), db=Depends(get_db)):
    n = db.execute("SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0", (user["id"],)).fetchone()[0]
    return {"unread": n}


@app.post("/api/notifications/read-all")
def read_all(user=Depends(current_user), db=Depends(get_db)):
    db.execute("UPDATE notifications SET is_read=1 WHERE user_id=?", (user["id"],))
    db.commit()
    return {"message": "ok"}


@app.post("/api/notifications/{nid}/read")
def mark_read(nid: int, user=Depends(current_user), db=Depends(get_db)):
    db.execute("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?", (nid, user["id"]))
    db.commit()
    return {"message": "ok"}


# ------------------------------------------------------------------ static files
# Only the front-end folders are exposed (not dev/, so mock.db and this source stay private).
app.mount("/uploads", StaticFiles(directory=UPLOADS), name="uploads")
for _folder in ("css", "js", "images", "students", "Admin"):
    app.mount(f"/{_folder}", StaticFiles(directory=os.path.join(ROOT, _folder)), name=_folder)


@app.get("/", include_in_schema=False)
def landing():
    return FileResponse(os.path.join(ROOT, "index.html"))


@app.get("/index.html", include_in_schema=False)
def landing_html():
    return FileResponse(os.path.join(ROOT, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PORT", 8000)))
