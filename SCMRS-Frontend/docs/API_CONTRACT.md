# API contract: front end <-> FastAPI backend

The front end was written without seeing your FastAPI routes, so this file defines what it
sends and expects. If your routes differ, either change the backend or edit the path map in
`js/config.js` (`ENDPOINTS`). A working reference implementation (FastAPI + SQLite) is in `dev/mock_server.py`.

All paths below are relative to `API_BASE` (default `/api`). All bodies are JSON unless stated.

## Conventions

| Topic | Rule |
|---|---|
| Auth | Bearer token (the usual FastAPI setup). `POST /auth/login` returns `"token"` (`"access_token"` is accepted too) and the front end sends `Authorization: Bearer <token>` on every call. A cookie session also works if you set `CREDENTIALS` in `config.js`. |
| Errors | Non-2xx. FastAPI's native `{"detail": "Human readable text"}` is shown as is. Validation failures (`422`, `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}`) are turned into one readable sentence, e.g. "Password is required." `{"message": ...}`, `{"error": ...}` and `{"errors": {...}}` are also understood. |
| 401 | Means "not logged in / token expired". The front end clears its session and redirects to the login page. **Do not return 401 for a wrong current password**, use 400/403. |
| 403 | Wrong role for the route (a student calling `/admin/...`). Older FastAPI versions answer a missing token with `403 {"detail": "Not authenticated"}`; the front end treats exactly that response as a 401. |
| Timestamps | ISO 8601 in **UTC**, e.g. `2026-10-23T14:05:00+00:00`. (Naive timestamps are treated as UTC.) |
| Roles | `"student"` or `"admin"`. Every `/student/*` route must check the student role and scope rows to the logged-in student. Every `/admin/*` route must check the admin role. **The front-end guard is only for UX; the backend is the real security.** |
| Status values | `Pending`, `In Progress`, `Resolved` (editable in `config.js` -> `STATUSES`). |

### Objects

```jsonc
User         { "id": 1, "role": "student", "login_id": "CSC/2021/045", "full_name": "Ada Okafor",
               "email": "ada@oau.edu", "phone": "" }

Complaint    { "id": 12, "ref": "FIX-0012",            // ref is what people see; falls back to #id
               "title": "...", "category": "...", "location": "...",
               "status": "Pending", "assigned_to": "",   // "" or null = unassigned
               "created_at": "...", "updated_at": "..." }
  + detail   { "description": "...", "photos": ["/uploads/a.jpg"],
               "updates": [ { "message": "...", "status": "In Progress", "author": "Mr Bello", "created_at": "..." } ],
               "student": { "id": 1, "name": "Ada Okafor", "login_id": "CSC/2021/045" } }   // student block: admin view

Notification { "id": 5, "type": "resolved", "message": "FIX-0012: ...", "complaint_id": 12,
               "is_read": false, "created_at": "..." }
```

## Auth and profile

| Method + path | Body | Success |
|---|---|---|
| `POST /auth/register` | `{role, login_id, full_name, email, password, access_code?}` | `201 {message}`. `access_code` is sent for **admin** sign-up only; validate it server side (otherwise anyone can become an admin). `409` if the ID or email exists. Hash the password. |
| `POST /auth/login` | `{role, login_id, password}` | `200 {user, token}`. `401` on bad credentials. Must only succeed if the account's role equals `role`. |
| `POST /auth/logout` | | `200`. Clear the session. |
| `GET /auth/me` | | `200 {user}` |
| `PATCH /auth/me` | `{full_name, email, phone}` | `200 {user}`. `409` if email is taken. |
| `POST /auth/change-password` | `{current_password, new_password}` | `200 {message}`. `400` if current password is wrong. |

## Student

| Method + path | Notes |
|---|---|
| `GET /meta` | `{categories: [str], locations: [str]}`. Fills the report form. Add a category in the DB and it appears with no front-end change. |
| `GET /student/dashboard` | `{stats: {total, pending, in_progress, resolved}, recent: [Complaint]}` (latest ~5) |
| `GET /student/complaints?status=&page=&per_page=` | `{items: [Complaint], total, page, per_page}`. Empty `status` = all. |
| `POST /student/complaints` | **multipart/form-data**: `title, category, location, description`, and zero or more files named `photos`. Returns `201 {complaint}`. Validate type/size server side. Create a `new_complaint` notification for admins here. |
| `GET /student/complaints/{id}` | `{complaint}` with detail fields. `404` if it is not this student's. |

## Admin

| Method + path | Notes |
|---|---|
| `GET /admin/dashboard` | same shape as the student dashboard, over **all** complaints |
| `GET /admin/complaints?q=&status=&page=&per_page=` | `{items, total, page, per_page}`. `q` searches ref, title and location. |
| `GET /admin/complaints/{id}` | `{complaint}` with detail fields, including `student` |
| `PATCH /admin/complaints/{id}` | `{status?, assigned_to?, note?}`, only changed fields are sent. Returns `{complaint}`. **This is the call that notifies the student**: store the change, add an entry to `updates` (use `note` as its message if given, otherwise generate one), set `resolved_at` when status becomes `Resolved`, and insert a notification for the student (`type`: `resolved`, `status_changed` or `update_added`). `400` if nothing changed. |
| `GET /admin/reports` | `{total, unassigned, resolution_rate (0-100), avg_resolution_hours, by_status: [{label,count}], by_category: [{label,count}], weekly: [{label,count}]}` |

## Notifications (both roles, scoped to the logged-in user)

| Method + path | Notes |
|---|---|
| `GET /notifications?filter=all\|unread&page=&per_page=` | `{items: [Notification], total, page, per_page}`, newest first |
| `GET /notifications/unread-count` | `{unread: 3}`. Polled every `POLL_MS` (30 s). Keep it cheap. |
| `POST /notifications/{id}/read` | mark one read (only if it belongs to the caller) |
| `POST /notifications/read-all` | mark all read |

Admin notification `type`s with a coloured tag: `new_complaint`, `unassigned`, `overdue`, `resolved`
(edit `NOTIF_TAGS` in `config.js`). Unknown types simply show no tag.

### How "resolved at admin -> student is notified" works

1. Admin saves in the dialog -> `PATCH /admin/complaints/{id}`.
2. Backend stores it and inserts a row in `notifications` for that student.
3. The student's open page polls `GET /notifications/unread-count`. When the number goes up the
   page lights the bell, shows the new message as a toast, and re-fetches whatever it is showing
   (dashboard numbers, complaint list, timeline) with no manual refresh.

If you later want instant push instead of polling, replace `pollNotifications()` in `js/core.js`
with a Server-Sent Events (`StreamingResponse`) or WebSocket listener that calls the same function; nothing else changes.

## FastAPI notes

* **Route shape.** Use plain `def` endpoints (or `async def` with an async DB driver). Use Pydantic models for the
  JSON bodies. `POST /student/complaints` is multipart: take the text fields with `Form(...)` and the files with
  `photos: List[UploadFile] = File(default=[])` (needs `pip install python-multipart`).
* **Query parameter named `filter`** (`GET /notifications?filter=unread`): declare it as
  `filter_: str = Query("all", alias="filter")` to avoid shadowing the Python built-in.
* **Wrong password is not a 401.** Raise `HTTPException(400, ...)` for a wrong current password so the front end
  does not treat it as an expired session.
* **Login payload is JSON** (`{role, login_id, password}`), not the form-encoded body used by
  `OAuth2PasswordRequestForm`. Use a Pydantic model for it. Return `{"user": {...}, "token": "..."}`.
* **Auth dependency.** `HTTPBearer(auto_error=False)` plus a dependency that raises `HTTPException(401)` gives the
  exact behaviour above. Build role checks as dependencies (`Depends(require("admin"))`) so no route can forget them.
* **Serving the front end from FastAPI:** mount the front-end folders with `StaticFiles` after your `/api` routes
  and keep `API_BASE: "/api"`. Do not mount the project root if it contains your database or source files.
* **Separate origin** (e.g. VS Code Live Server): set `API_BASE` to the full URL (e.g. `http://127.0.0.1:8000/api`) and add
  `CORSMiddleware(allow_origins=["http://127.0.0.1:5500"], allow_headers=["Authorization", "Content-Type"])`.
  Never combine `allow_origins=["*"]` with credentials. With bearer tokens no cookies are involved, so CSRF does not apply;
  if you use cookie sessions instead, set `CREDENTIALS: "include"`, `allow_credentials=True` and protect state-changing routes.
* **Trailing slashes.** The front end calls paths without a trailing slash (`/student/complaints`). Declare your routes
  the same way; FastAPI's slash redirect (307) can drop the `Authorization` header on some clients.
* **Uploaded photos:** check the real content type and size (the reference server caps each photo at 5 MB, up to 5 photos),
  generate your own file names, serve them from a dedicated `StaticFiles` mount and return URLs the browser can open.
* Parameterised queries only (SQLAlchemy or `?` placeholders), never string-built SQL.
