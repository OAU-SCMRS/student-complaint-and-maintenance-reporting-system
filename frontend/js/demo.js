/*
 * FixOAU / SCMRS - DEMO MODE
 * ---------------------------------------------------------------
 * A tiny in-browser stand-in for the backend API so the student and admin dashboards can be
 * explored with no backend. Data lives in this browser's localStorage only.
 *
 * Safety:
 *  - Does nothing unless SCMRS_CONFIG.DEMO_MODE is true AND the host is in DEMO_ALLOWED_HOSTS.
 *  - core.js sends demo sessions here and NEVER to the network; a real session never comes here.
 *  - Switch DEMO_MODE off (or delete this file) and demo sessions are discarded on the next load.
 *  - There are no real credentials in this file, and it cannot grant access to the real backend.
 */
(function () {
  "use strict";

  const C = window.SCMRS_CONFIG;
  const S = window.SCMRS;
  const allowed = !!C.DEMO_MODE
    && (!Array.isArray(C.DEMO_ALLOWED_HOSTS) || C.DEMO_ALLOWED_HOSTS.indexOf(location.hostname) !== -1);

  if (!S || !allowed) { if (S) S.demo = { enabled: false }; return; }

  const E = C.ENDPOINTS;
  const DB_KEY = "scmrs.demo.db";
  const DELAY = 140;                                   // feels like a network call
  const ST = C.STATUSES.map(s => s.value);             // [Pending, In Progress, Resolved]

  /* ------------------------------------------------------------ store */
  const ago = (days, hours = 0) => new Date(Date.now() - days * 864e5 - hours * 36e5).toISOString();

  function seed() {
    const users = {
      student: { id: 1, role: "student", login_id: "demo.student", full_name: "Demo Student", email: "demo.student@example.com", phone: "", password: "Demo1234" },
      admin:   { id: 100, role: "admin", login_id: "demo.admin", full_name: "Demo Admin", email: "demo.admin@example.com", phone: "", password: "Demo1234" }
    };
    const others = { 2: { name: "Tunde Adeyemi", login_id: "DEMO/2022/014" }, 3: { name: "Ngozi Eze", login_id: "DEMO/2021/101" } };
    const C_ = (id, sid, title, category, location, description, status, assigned, d, updates) =>
      ({ id, student_id: sid, title, category, location, description, status, assigned_to: assigned,
         created_at: ago(d), updated_at: ago(Math.max(0, d - 1)), resolved_at: status === "Resolved" ? ago(Math.max(0, d - 2)) : null, photos: [], updates: updates || [] });
    const complaints = [
      C_(1, 1, "Broken light in the corridor", "Faulty lights", "Angola Hall", "The corridor light on the second floor has been out for over a week.", "Resolved", "Electrical unit", 9,
         [{ message: "An electrician has been assigned.", status: "In Progress", author: "Demo Admin", created_at: ago(8) },
          { message: "Light replaced. Please confirm it works.", status: "Resolved", author: "Demo Admin", created_at: ago(7) }]),
      C_(2, 1, "No running water in block B", "Water problems", "Moremi Hall", "Taps in block B have had no water since Monday morning.", "In Progress", "Plumbing unit", 4,
         [{ message: "The plumbing unit is checking the main valve.", status: "In Progress", author: "Demo Admin", created_at: ago(3) }]),
      C_(3, 1, "Cracked window in the library", "Broken doors and windows", "Library", "A window pane near the reading area is cracked and could fall.", "Pending", "", 1, []),
      C_(4, 2, "Blocked drain behind the SUB", "Blocked drainage", "Student Union Building", "Water collects behind the building whenever it rains.", "Pending", "", 2, []),
      C_(5, 2, "Socket sparks in lecture hall", "Electrical fault", "Lecture hall", "The socket by the lecturer's desk sparks when used.", "In Progress", "Electrical unit", 6,
         [{ message: "Marked urgent and assigned.", status: "In Progress", author: "Demo Admin", created_at: ago(5) }]),
      C_(6, 3, "Door lock broken", "Broken doors and windows", "Awolowo Hall", "The door to the common room cannot lock.", "Resolved", "Maintenance", 14,
         [{ message: "Lock replaced.", status: "Resolved", author: "Demo Admin", created_at: ago(12) }]),
      C_(7, 3, "Damaged bench at the amphitheatre", "Damaged facilities", "Amphitheatre", "Two benches have broken slats.", "Pending", "", 0)
    ];
    const notifications = [
      { id: 1, for_role: "student", type: "resolved", message: "FIX-0001: Light replaced. Please confirm it works.", complaint_id: 1, is_read: false, created_at: ago(7) },
      { id: 2, for_role: "student", type: "status_changed", message: "FIX-0002: The plumbing unit is checking the main valve.", complaint_id: 2, is_read: false, created_at: ago(3) },
      { id: 3, for_role: "admin", type: "new_complaint", message: "New complaint FIX-0007: Damaged bench at the amphitheatre", complaint_id: 7, is_read: false, created_at: ago(0, 2) },
      { id: 4, for_role: "admin", type: "unassigned", message: "FIX-0004 has not been assigned yet.", complaint_id: 4, is_read: false, created_at: ago(1) },
      { id: 5, for_role: "admin", type: "overdue", message: "FIX-0005 has been open for more than 5 days.", complaint_id: 5, is_read: true, created_at: ago(1, 3) }
    ];
    return { users, others, complaints, notifications };
  }

  let mem = null;
  function load() {
    try { const raw = localStorage.getItem(DB_KEY); if (raw) return JSON.parse(raw); } catch (e) { /* fall through */ }
    return seed();
  }
  const db = () => (mem || (mem = load()));
  function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(mem)); } catch (e) { /* quota: keep in memory */ } }
  // another tab (e.g. the admin) changed the data: pick it up on the next call
  window.addEventListener("storage", e => { if (e.key === DB_KEY) mem = null; });

  /* ------------------------------------------------------------ helpers */
  const fail = (message, status) => new S.ApiError(message, status);
  const ref = id => "FIX-" + String(id).padStart(4, "0");
  const publicUser = u => ({ id: u.id, role: u.role, login_id: u.login_id, full_name: u.full_name, email: u.email, phone: u.phone || "" });
  const nextId = list => list.reduce((m, x) => Math.max(m, x.id), 0) + 1;

  function studentOf(sid) {
    const d = db();
    if (sid === d.users.student.id) return { id: sid, name: d.users.student.full_name, login_id: d.users.student.login_id };
    const o = d.others[sid] || { name: "Student", login_id: "" };
    return { id: sid, name: o.name, login_id: o.login_id };
  }
  function view(c, full) {
    const o = { id: c.id, ref: ref(c.id), title: c.title, category: c.category, location: c.location, status: c.status,
                assigned_to: c.assigned_to || "", created_at: c.created_at, updated_at: c.updated_at };
    if (full) { o.description = c.description; o.photos = c.photos.slice(); o.updates = c.updates.slice(); o.student = studentOf(c.student_id); }
    return o;
  }
  function stats(list) {
    return { total: list.length, pending: list.filter(c => c.status === "Pending").length,
             in_progress: list.filter(c => c.status === "In Progress").length, resolved: list.filter(c => c.status === "Resolved").length };
  }
  function paged(list, q) {
    const page = Math.max(1, parseInt(q.page, 10) || 1), per = Math.min(100, Math.max(1, parseInt(q.per_page, 10) || 10));
    return { total: list.length, page, per_page: per, slice: list.slice((page - 1) * per, page * per) };
  }
  const newestFirst = (a, b) => b.id - a.id;
  function notify(role, type, message, complaintId) {
    const d = db();
    d.notifications.push({ id: nextId(d.notifications), for_role: role, type, message, complaint_id: complaintId, is_read: false, created_at: new Date().toISOString() });
  }
  function readAsDataUrl(file) {
    return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(file); });
  }

  /* ------------------------------------------------------------ routes */
  // build a matcher for endpoints that take an id, e.g. /student/complaints/{id}
  const withId = fn => { const s = fn("XIDX").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return new RegExp("^" + s.replace("XIDX", "([^/]+)") + "$"); };
  const R = {
    studentOne: withId(E.studentComplaint), adminOne: withId(E.adminComplaint), markRead: withId(E.markRead)
  };

  async function route(method, path, opts, role, me) {
    const d = db();
    const q = opts.query || {};
    const body = opts.body || {};
    let m;

    if (path === E.me) {
      if (method === "PATCH") {
        const email = String(body.email || me.email).trim();
        Object.assign(me, { full_name: String(body.full_name || me.full_name).trim(), email, phone: String(body.phone || "").trim() });
        save();
      }
      return { user: publicUser(me) };
    }
    if (path === E.changePassword) {
      if (body.current_password !== me.password) throw fail("Your current password is not correct.", 400);
      me.password = body.new_password; save();
      return { message: "Password updated." };
    }
    if (path === E.logout) return { message: "Logged out." };
    if (path === E.meta) {
      const cats = Array.from(new Set(d.complaints.map(c => c.category)));
      const locs = Array.from(new Set(d.complaints.map(c => c.location)));
      return { categories: cats.concat(C.FALLBACK_META.categories.filter(c => cats.indexOf(c) === -1)), locations: locs };
    }
    if (path === E.unreadCount) return { unread: d.notifications.filter(n => n.for_role === role && !n.is_read).length };
    if (path === E.notifications) {
      let list = d.notifications.filter(n => n.for_role === role);
      if (q.filter === "unread") list = list.filter(n => !n.is_read);
      const p = paged(list.sort(newestFirst), q);
      return { items: p.slice.map(n => ({ id: n.id, type: n.type, message: n.message, complaint_id: n.complaint_id, is_read: n.is_read, created_at: n.created_at })),
               total: p.total, page: p.page, per_page: p.per_page };
    }
    if (path === E.markAllRead) { d.notifications.forEach(n => { if (n.for_role === role) n.is_read = true; }); save(); return { message: "ok" }; }
    if ((m = path.match(R.markRead))) {
      const n = d.notifications.find(x => String(x.id) === m[1] && x.for_role === role);
      if (n) { n.is_read = true; save(); }
      return { message: "ok" };
    }

    if (path === E.dashboard(role)) {
      const mine = role === "student" ? d.complaints.filter(c => c.student_id === me.id) : d.complaints;
      return { stats: stats(mine), recent: mine.slice().sort(newestFirst).slice(0, 5).map(c => view(c)) };
    }

    /* ---- student ---- */
    if (role === "student") {
      if (path === E.studentComplaints) {
        if (method === "POST") {
          const f = opts.form;
          const v = k => String((f && f.get(k)) || "").trim();
          if (!v("title") || !v("category") || !v("location") || !v("description")) throw fail("Fill in every required field.", 400);
          const photos = [];
          for (const file of (f ? f.getAll("photos") : []).slice(0, C.PHOTOS.max)) {
            if (file && file.size <= 400 * 1024) { const u = await readAsDataUrl(file); if (u) photos.push(u); }   // keep demo storage small
          }
          const c = { id: nextId(d.complaints), student_id: me.id, title: v("title"), category: v("category"), location: v("location"),
                      description: v("description"), status: "Pending", assigned_to: "", created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(), resolved_at: null, photos, updates: [] };
          d.complaints.push(c);
          notify("admin", "new_complaint", `New complaint ${ref(c.id)}: ${c.title}`, c.id);
          save();
          return { complaint: view(c) };
        }
        let list = d.complaints.filter(c => c.student_id === me.id);
        if (ST.indexOf(q.status) !== -1) list = list.filter(c => c.status === q.status);
        const p = paged(list.sort(newestFirst), q);
        return { items: p.slice.map(c => view(c)), total: p.total, page: p.page, per_page: p.per_page };
      }
      if ((m = path.match(R.studentOne))) {
        const c = d.complaints.find(x => String(x.id) === m[1] && x.student_id === me.id);
        if (!c) throw fail("Complaint not found.", 404);
        return { complaint: view(c, true) };
      }
    }

    /* ---- admin ---- */
    if (role === "admin") {
      if (path === E.adminComplaints) {
        let list = d.complaints.slice();
        if (ST.indexOf(q.status) !== -1) list = list.filter(c => c.status === q.status);
        if (q.q) { const t = String(q.q).toLowerCase(); list = list.filter(c => (ref(c.id) + " " + c.title + " " + c.location).toLowerCase().indexOf(t) !== -1); }
        const p = paged(list.sort(newestFirst), q);
        return { items: p.slice.map(c => view(c)), total: p.total, page: p.page, per_page: p.per_page };
      }
      if ((m = path.match(R.adminOne))) {
        const c = d.complaints.find(x => String(x.id) === m[1]);
        if (!c) throw fail("Complaint not found.", 404);
        if (method === "PATCH") {
          const parts = [];
          const ts = new Date().toISOString();
          const note = String(body.note || "").trim();
          if (body.status !== undefined) {
            if (ST.indexOf(body.status) === -1) throw fail("Unknown status.", 400);
            if (body.status !== c.status) { c.status = body.status; c.resolved_at = body.status === "Resolved" ? ts : null; parts.push("is now " + body.status); }
          }
          if (body.assigned_to !== undefined && String(body.assigned_to).trim() !== (c.assigned_to || "")) {
            c.assigned_to = String(body.assigned_to).trim();
            parts.push(c.assigned_to ? "has been assigned to " + c.assigned_to : "is no longer assigned");
          }
          if (!parts.length && !note) throw fail("Nothing to update.", 400);
          const message = note || `Your complaint ${ref(c.id)} ${parts.join(" and ")}.`;
          c.updated_at = ts;
          c.updates.push({ message, status: body.status !== undefined ? c.status : null, author: me.full_name, created_at: ts });
          if (c.student_id === d.users.student.id) {
            notify("student", c.status === "Resolved" && body.status !== undefined ? "resolved" : (body.status !== undefined ? "status_changed" : "update_added"), `${ref(c.id)}: ${message}`, c.id);
          }
          save();
        }
        return { complaint: view(c, true) };
      }
      if (path === E.adminReports) {
        const all = d.complaints, s = stats(all);
        const resolved = all.filter(c => c.resolved_at);
        const hours = resolved.map(c => (new Date(c.resolved_at) - new Date(c.created_at)) / 36e5);
        const cats = {};
        all.forEach(c => { cats[c.category] = (cats[c.category] || 0) + 1; });
        const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        const weekly = [];
        for (let i = 5; i >= 0; i--) {
          const a = new Date(monday.getTime() - i * 7 * 864e5), b = new Date(a.getTime() + 7 * 864e5);
          weekly.push({ label: a.toLocaleDateString(C.LOCALE, { day: "2-digit", month: "short" }),
                        count: all.filter(c => { const t = new Date(c.created_at); return t >= a && t < b; }).length });
        }
        return { total: s.total, unassigned: all.filter(c => !c.assigned_to && c.status !== "Resolved").length,
                 resolution_rate: s.total ? Math.round((1000 * s.resolved) / s.total) / 10 : 0,
                 avg_resolution_hours: hours.length ? Math.round((hours.reduce((x, y) => x + y, 0) / hours.length) * 100) / 100 : 0,
                 by_status: [["Pending", s.pending], ["In Progress", s.in_progress], ["Resolved", s.resolved]].map(([label, count]) => ({ label, count })),
                 by_category: Object.keys(cats).map(label => ({ label, count: cats[label] })).sort((a, b) => b.count - a.count),
                 weekly };
      }
    }
    throw fail("That action is not available in demo mode.", 404);
  }

  /** Called by core.js for demo sessions. Mirrors the real API: JSON in, JSON out, ApiError on failure. */
  function handle(method, path, opts) {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const sess = S.session.get();
          const me = sess && sess.user ? db().users[sess.user.role] : null;
          if (!me) throw fail("Please log in.", 401);
          const out = await route(method, path, opts || {}, me.role, me);
          resolve(JSON.parse(JSON.stringify(out)));
        } catch (e) { reject(e); }
      }, DELAY);
    });
  }
  window.SCMRS_DEMO = { handle };

  /* ------------------------------------------------------------ public bits */
  function start(role) {
    const u = db().users[role];
    S.session.set({ token: null, demo: true, user: publicUser(u) });
    return publicUser(u);
  }
  function reset() { mem = null; try { localStorage.removeItem(DB_KEY); } catch (e) { /* ignore */ } }
  S.demo = { enabled: true, start, reset };

  /* "Try the demo" button under the real login form. Exists only while demo mode is on. */
  function addLoginButton() {
    const role = document.body.dataset.authRole;
    const form = document.getElementById("loginForm");
    if (!role || !form) return;
    const box = document.createElement("div");
    box.className = "demo-box";
    box.innerHTML = `<p>No account? Explore with sample data.</p>
      <button type="button" class="demo-btn">Try the ${role === "admin" ? "admin" : "student"} demo</button>
      <small>Demo mode: nothing is sent to the server.</small>`;
    const submit = form.querySelector('button[type="submit"]');
    (submit || form.lastElementChild).after(box);
    box.querySelector("button").addEventListener("click", () => { start(role); window.location.href = C.ROUTES[role].home; });
  }

  /* Strip across the top of every dashboard while a demo session is active. */
  function addBanner() {
    const main = document.querySelector(".main");
    if (!main || !document.body.dataset.role || !S.session.isDemo()) return;
    const bar = document.createElement("div");
    bar.className = "demo-banner";
    bar.setAttribute("role", "status");
    bar.innerHTML = `<span><strong>Demo mode.</strong> Sample data, saved only in this browser. Nothing reaches the server.</span>
      <span class="demo-actions"><button type="button" data-demo="reset">Reset data</button><button type="button" data-demo="exit">Exit demo</button></span>`;
    main.prepend(bar);
    bar.addEventListener("click", e => {
      const act = e.target.dataset && e.target.dataset.demo;
      if (act === "reset") { reset(); window.location.reload(); }
      if (act === "exit") { S.auth.logout(); }
    });
  }

  S.onReady(() => { addLoginButton(); addBanner(); });
})();
