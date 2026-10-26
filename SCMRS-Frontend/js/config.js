/*
 * FixOAU / SCMRS - front-end configuration
 * ---------------------------------------------------------------
 * This is the ONLY file you should need to edit to point the
 * front end at your FastAPI backend or to change app-wide values.
 * Load order on every page:  config.js -> core.js -> <page>.js
 */
window.SCMRS_CONFIG = {

  /* Where the FastAPI app lives.
   *  - FastAPI serves this folder too (StaticFiles) or sits behind the same reverse proxy:
   *      keep "/api" and leave CREDENTIALS as "same-origin".
   *  - Front end served separately (Live Server, another port...):
   *      use the full URL, e.g. "http://127.0.0.1:8000/api" and add Starlette's CORSMiddleware
   *      with an explicit origin list (not "*"). The front end sends the login token as
   *      "Authorization: Bearer ...", so allow_headers must include "Authorization".
   *      Only set CREDENTIALS to "include" (and allow_credentials=True) if you use cookie sessions.
   */
  API_BASE: "/api",
  CREDENTIALS: "same-origin",

  /* DEMO MODE: lets people explore the student and admin dashboards with sample data and no
   * backend. Everything is stored in the visitor's own browser; nothing is sent to the server.
   *  - Keep false in production. When false the demo button is not shown, demo.js does nothing,
   *    and any leftover demo session is discarded on the next page load.
   *  - Even when true it only works on the hosts listed below (set to null to allow any host). */
  DEMO_MODE: true,
  DEMO_ALLOWED_HOSTS: ["localhost", "127.0.0.1", ""],   // "" = opened from a file (file://)

  /* How often (ms) the browser asks the backend for new notifications. */
  POLL_MS: 30000,

  /* Display */
  LOCALE: "en-GB",
  PAGE_SIZE: 10,          // rows per page in complaint tables
  NOTIF_PAGE_SIZE: 20,    // notifications loaded per request

  /* Validation limits (the backend must enforce the same rules) */
  PASSWORD_MIN: 8,
  PHOTOS: { max: 5, maxMB: 5 },

  /* Endpoint map. Change a path here if your FastAPI routes differ.
   * Paths are appended to API_BASE. See docs/API_CONTRACT.md. */
  ENDPOINTS: {
    register:      "/auth/register",
    login:         "/auth/login",
    logout:        "/auth/logout",
    me:            "/auth/me",                 // GET current user, PATCH to edit profile
    changePassword:"/auth/change-password",

    meta:          "/meta",                    // categories + locations for the report form

    // role is "student" or "admin" - used to build the paths below
    dashboard:     role => `/${role}/dashboard`,

    studentComplaints:  "/student/complaints",           // GET list, POST create
    studentComplaint:   id => `/student/complaints/${encodeURIComponent(id)}`,

    adminComplaints:    "/admin/complaints",             // GET list
    adminComplaint:     id => `/admin/complaints/${encodeURIComponent(id)}`, // GET, PATCH
    adminReports:       "/admin/reports",

    notifications:      "/notifications",
    unreadCount:        "/notifications/unread-count",
    markRead:           id => `/notifications/${encodeURIComponent(id)}/read`,
    markAllRead:        "/notifications/read-all"
  },

  /* Pages, relative to the page you are on (login + dashboards share a folder per role). */
  ROUTES: {
    landing: "../index.html",
    student: {
      login: "studentlogin.html",
      home: "student.html",
      complaintLink: id => `complaint-details.html?id=${encodeURIComponent(id)}`
    },
    admin: {
      login: "adminlogin.html",
      home: "admin.html",
      complaintLink: id => `manage-complaints.html?open=${encodeURIComponent(id)}`
    }
  },

  /* Complaint workflow. `value` must match what the backend stores/returns.
   * badge / fill are the CSS classes used to colour it. */
  STATUSES: [
    { value: "Pending",     badge: "badge-pending",  fill: "f-pending" },
    { value: "In Progress", badge: "badge-progress", fill: "f-progress" },
    { value: "Resolved",    badge: "badge-resolved", fill: "f-resolved" }
  ],

  /* Small coloured label shown on a notification, keyed by its `type`. */
  NOTIF_TAGS: {
    new_complaint: { label: "New",        cls: "" },
    unassigned:    { label: "Unassigned", cls: "tag-unassigned" },
    overdue:       { label: "Overdue",    cls: "tag-overdue" },
    resolved:      { label: "Resolved",   cls: "tag-resolved" }
  },

  /* Used ONLY if GET /meta fails, so the report form still works. */
  FALLBACK_META: {
    categories: ["Faulty lights", "Water problems", "Damaged facilities", "Blocked drainage",
                 "Broken doors and windows", "Electrical fault", "Other"],
    locations: []
  }
};
