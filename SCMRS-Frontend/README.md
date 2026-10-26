# FixOAU - Student Complaint Monitoring & Reporting System (front end)

Plain HTML + CSS + JavaScript (no build step). Talks to a FastAPI + SQL backend over JSON.

## Structure
```
index.html              landing page (CSS-only mobile menu)
css/style.css
js/config.js            <- edit this: API URL, endpoints, statuses, limits
js/core.js              session, API client, route guard, notification polling, helpers
js/demo.js              demo mode (off by default) - sample data in the browser, no backend
js/login.js register.js dashboard.js report.js complaints.js complaint-details.js
js/notifications.js profile.js manage-complaints.js reports.js
students/               student pages (login, signup, dashboard, report, complaints,
                        complaint-details, notifications, profile)
Admin/                  admin pages (login, register, dashboard, manage, reports,
                        notifications, profile)
docs/API_CONTRACT.md    what the backend must expose
dev/mock_server.py      reference FastAPI+SQLite backend for testing
                        (pip install fastapi "uvicorn[standard]" python-multipart)
```
Each page loads `config.js` -> `core.js` -> its own script. Protected pages set
`<body data-role="student|admin">`; login/register pages set `data-auth-role`.

## Run
1. Point `API_BASE` in `js/config.js` at your FastAPI app (see docs/API_CONTRACT.md).
2. No backend yet? `python dev/mock_server.py` serves the site and a test API at http://127.0.0.1:8000
   (interactive API docs at /docs)
   (admin sign-up code: `FIXOAU-ADMIN`, or set `ADMIN_ACCESS_CODE`).

## Demo mode (no backend needed)
Lets anyone open the student and admin dashboards with sample data. It is **off by default**.

In `js/config.js`:
```js
DEMO_MODE: true,                                   // false in production
DEMO_ALLOWED_HOSTS: ["localhost", "127.0.0.1", ""] // only these hosts; null = any host
```
When on, each login page shows a "Try the student/admin demo" button and dashboards show a
"Demo mode" banner with Reset data / Exit demo. Sample data lives in the visitor's own
localStorage; demo sessions never make a network request and cannot reach the real backend.

When off (or on a host that is not allowed): no button, `demo.js` defines nothing, and any leftover
or forged demo session is wiped on the next page load. For a hard guarantee in production, also delete
`js/demo.js` and its `<script>` tags; the app then runs unchanged.

Demo logins are by button only, so there are no demo credentials to leak.
