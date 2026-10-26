/*
 * FixOAU / SCMRS - shared core
 * Session, API client, route guard, notification polling and UI helpers.
 * Everything is exposed on window.SCMRS.
 */
(function () {
  "use strict";

  const C = window.SCMRS_CONFIG;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ------------------------------------------------------------------ *
   * Session (who is logged in). The server stays the source of truth;
   * this only remembers the profile and, if the backend issues one, a token.
   * ------------------------------------------------------------------ */
  const KEY = "scmrs.session";
  const session = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } },
    set(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage blocked */ } },
    clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } },
    user() { const s = this.get(); return s && s.user ? s.user : null; },
    token() { const s = this.get(); return s && s.token ? s.token : null; },
    isDemo() { const s = this.get(); return !!(s && s.demo); },
    setUser(user) { const s = this.get() || {}; this.set({ token: s.token, demo: s.demo, user }); }
  };

  /* ------------------------------------------------------------------ *
   * API client
   * ------------------------------------------------------------------ */
  class ApiError extends Error {
    constructor(message, status, data) { super(message); this.name = "ApiError"; this.status = status; this.data = data; }
  }

  const FALLBACK_MESSAGES = {
    400: "Please check the details you entered and try again.",
    401: "Your session has expired. Please log in again.",
    403: "You do not have permission to do that.",
    404: "We could not find what you were looking for.",
    409: "That already exists.",
    413: "The files you attached are too large.",
    422: "Please check the details you entered and try again."
  };

  /* FastAPI reports errors as {"detail": ...}:
   *   - HTTPException            -> detail is a string
   *   - request validation (422) -> detail is a list of {loc, msg, type}
   * The older {"message"}, {"error"} and {"errors": {...}} shapes are still understood. */
  function humanField(loc) {
    const name = Array.isArray(loc) ? loc[loc.length - 1] : "";
    if (typeof name !== "string" || !name || /^\d+$/.test(name)) return "";
    const text = name.replace(/_/g, " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function validationMessage(items) {
    const first = items.find(i => i && typeof i.msg === "string");
    if (!first) return "";
    const msg = first.msg.replace(/^Value error,\s*/i, "");      // pydantic prefix on custom validators
    if (msg !== first.msg) return msg;                             // already a full sentence from our own validator
    if (/field required/i.test(msg)) { const f = humanField(first.loc); return f ? `${f} is required.` : "A required field is missing."; }
    const f = humanField(first.loc);
    return f ? `${f}: ${msg.charAt(0).toLowerCase()}${msg.slice(1)}` : msg;
  }

  function messageFrom(data, status) {
    if (data) {
      if (typeof data.detail === "string" && data.detail) return data.detail;
      if (Array.isArray(data.detail)) { const m = validationMessage(data.detail); if (m) return m; }
      if (data.detail && typeof data.detail === "object" && !Array.isArray(data.detail)) {
        if (typeof data.detail.message === "string" && data.detail.message) return data.detail.message;
      }
      if (typeof data.message === "string" && data.message) return data.message;
      if (typeof data.error === "string" && data.error) return data.error;
      if (data.errors && typeof data.errors === "object") {
        const first = Object.values(data.errors)[0];
        if (first) return Array.isArray(first) ? String(first[0]) : String(first);
      }
    }
    if (FALLBACK_MESSAGES[status]) return FALLBACK_MESSAGES[status];
    return status >= 500 ? "Something went wrong on the server. Please try again shortly."
                         : "The request could not be completed.";
  }

  let redirecting = false;

  /* Demo mode is allowed only when the config switch is on AND this host is on the allow-list.
   * Demo sessions never reach the backend and are rejected the moment demo mode is off. */
  const demoEnabled = () => !!C.DEMO_MODE
    && (!Array.isArray(C.DEMO_ALLOWED_HOSTS) || C.DEMO_ALLOWED_HOSTS.indexOf(location.hostname) !== -1)
    && !!window.SCMRS_DEMO;

  /**
   * api("GET", "/path", { query, body, form, auth:false, keepalive })
   * Resolves with parsed JSON (or null), rejects with ApiError.
   */
  async function api(method, path, opts = {}) {
    if (session.isDemo() && opts.auth !== false) {
      if (!demoEnabled()) { session.clear(); sessionExpired(); throw new ApiError("Demo mode is switched off.", 401); }
      return window.SCMRS_DEMO.handle(method, path, opts);     // answered locally, no network
    }
    let url = C.API_BASE + path;
    if (opts.query) {
      const q = new URLSearchParams();
      Object.entries(opts.query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, v); });
      const qs = q.toString();
      if (qs) url += (url.includes("?") ? "&" : "?") + qs;
    }

    const headers = { Accept: "application/json" };
    const token = session.token();
    if (token) headers.Authorization = "Bearer " + token;

    let body;
    if (opts.form) {
      body = opts.form;                                  // FormData: the browser sets the boundary
    } else if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }

    let res;
    try {
      res = await fetch(url, { method, headers, body, credentials: C.CREDENTIALS, keepalive: !!opts.keepalive });
    } catch (e) {
      throw new ApiError("Cannot reach the server. Check your connection and try again.", 0);
    }

    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (e) { data = null; } }

    if (!res.ok) {
      // Older FastAPI versions answer a missing/invalid bearer token with 403 "Not authenticated"
      // instead of 401. A real wrong-role 403 has a different detail, so only this exact case is remapped.
      const status = (res.status === 403 && data && data.detail === "Not authenticated") ? 401 : res.status;
      if (status === 401 && opts.auth !== false) sessionExpired();
      throw new ApiError(messageFrom(data, status), status, data);
    }
    return data;
  }

  /* ------------------------------------------------------------------ *
   * Auth
   * ------------------------------------------------------------------ */
  const roleLabel = role => (role === "admin" ? "an administrator" : "a student");

  async function login(role, loginId, password) {
    const data = await api("POST", C.ENDPOINTS.login, { body: { role, login_id: loginId, password }, auth: false });
    const user = data && data.user;
    if (!user) throw new ApiError("The server sent an unexpected response.", 0);
    if (String(user.role).toLowerCase() !== role) {
      api("POST", C.ENDPOINTS.logout, { auth: false }).catch(() => {});   // drop any server session just opened
      session.clear();
      const other = role === "admin" ? "student" : "admin";
      throw new ApiError(`That account is not ${roleLabel(role)}. Use the ${other} portal instead.`, 403);
    }
    user.role = role;
    session.set({ token: data.token || data.access_token || null, user });
    return user;
  }

  function register(role, fields) {
    return api("POST", C.ENDPOINTS.register, { body: Object.assign({ role }, fields), auth: false });
  }

  function goLogin(role, reason) {
    const target = C.ROUTES[role].login + (reason ? `?${reason}=1` : "");
    window.location.replace(target);
  }

  function sessionExpired() {
    if (redirecting) return;
    const role = document.body.dataset.role;
    if (!role) return;                       // login / register pages handle their own 401s
    redirecting = true;
    session.clear();
    goLogin(role, "expired");
  }

  async function logout() {
    const role = document.body.dataset.role || (session.user() || {}).role;
    if (!session.isDemo()) { try { await api("POST", C.ENDPOINTS.logout, { auth: false }); } catch (e) { /* still log out locally */ } }
    session.clear();
    window.location.replace(C.ROUTES.landing);
  }

  /** Returns the user if logged in with the right role, otherwise redirects and returns null. */
  function purgeDemoIfOff() { if (session.isDemo() && !demoEnabled()) session.clear(); }

  function requireRole(role) {
    purgeDemoIfOff();
    const user = session.user();
    if (!user || String(user.role).toLowerCase() !== role) {
      if (user) session.clear();
      redirecting = true;
      goLogin(role);
      return null;
    }
    return user;
  }

  /** On login/register pages: someone already signed in goes straight to their dashboard. */
  function redirectIfLoggedIn(role) {
    purgeDemoIfOff();
    const user = session.user();
    if (user && String(user.role).toLowerCase() === role) {
      window.location.replace(C.ROUTES[role].home);
      return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = v => String(v === null || v === undefined ? "" : v).replace(/[&<>"']/g, ch => ESC[ch]);

  /** Server timestamps are UTC. Naive strings (no zone) are treated as UTC, not local time. */
  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    let s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += "T00:00:00Z";
    else if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) s = s.replace(" ", "T") + "Z";
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function fmtDate(value) {
    const d = parseDate(value);
    return d ? d.toLocaleDateString(C.LOCALE, { day: "numeric", month: "short", year: "numeric" }) : "";
  }
  function fmtDateTime(value) {
    const d = parseDate(value);
    return d ? d.toLocaleString(C.LOCALE, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  }
  function timeAgo(value) {
    const d = parseDate(value);
    if (!d) return "";
    const sec = Math.round((Date.now() - d.getTime()) / 1000);
    if (sec < 45) return "Just now";
    const steps = [[60, "minute"], [3600, "hour"], [86400, "day"]];
    if (sec < 7 * 86400) {
      const [unit, name] = sec < 3600 ? steps[0] : sec < 86400 ? steps[1] : steps[2];
      const n = Math.round(sec / unit);
      return `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
    return fmtDate(d);
  }

  const initials = name => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  };
  const firstName = user => String((user && (user.full_name || user.login_id)) || "").trim().split(/\s+/)[0] || "";
  function greeting(user) {
    const h = new Date().getHours();
    const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    const n = firstName(user);
    return n ? `${part}, ${n}` : part;
  }

  function statusMeta(value) {
    const v = String(value || "").toLowerCase().replace(/_/g, " ");
    return C.STATUSES.find(s => s.value.toLowerCase() === v) || { value: value || "Unknown", badge: "badge-pending", fill: "f-pending" };
  }
  const badge = status => { const m = statusMeta(status); return `<span class="badge ${m.badge}">${esc(m.value)}</span>`; };
  const refOf = c => (c && (c.ref || (c.id !== undefined ? "#" + c.id : ""))) || "";

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }
  const param = name => new URLSearchParams(window.location.search).get(name);

  /** Toast. Uses the page's #toast if it has one, otherwise creates it. */
  let toastTimer;
  function toast(message, kind) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), kind === "error" ? 5000 : 3500);
  }

  /** Put text in an error/notice paragraph. kind "ok" turns it green. */
  function say(el, text, kind) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("ok", kind === "ok");
  }

  /** Disable a button while a request is running. */
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; if (label) btn.textContent = label; }
    else { btn.disabled = false; if (btn.dataset.label) btn.textContent = btn.dataset.label; }
  }

  const invalid = (input, on) => { if (input) { input.classList.toggle("invalid", !!on); input.setAttribute("aria-invalid", on ? "true" : "false"); } };

  /* Validation shared by register / profile pages. Return an error string or "". */
  const check = {
    name: v => (v.trim().length < 2 ? "Enter your full name." : ""),
    loginId: (v, label) => (/^[A-Za-z0-9][A-Za-z0-9/_.\-]{2,39}$/.test(v.trim()) ? "" : `${label} must be 3-40 characters (letters, numbers, / _ . -).`),
    email: v => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Enter a valid email address."),
    phone: v => (!v.trim() || /^\+?[0-9 ()\-]{7,20}$/.test(v.trim()) ? "" : "Enter a valid phone number or leave it blank."),
    password: v => (v.length < C.PASSWORD_MIN || !/[A-Za-z]/.test(v) || !/[0-9]/.test(v)
      ? `Password must be at least ${C.PASSWORD_MIN} characters and include a letter and a number.` : "")
  };

  /* ---- table / list helpers ---- */
  function tableMessage(tbody, cols, text, retry) {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="empty">${esc(text)}${retry ? ' <button type="button" class="btn-ghost" data-retry>Try again</button>' : ""}</td></tr>`;
    if (retry) { const b = $("[data-retry]", tbody); if (b) b.addEventListener("click", retry); }
  }

  /** Previous / Next controls. Hides itself when everything fits on one page. */
  function renderPager(nav, state, onChange) {
    if (!nav) return;
    const pages = Math.max(1, Math.ceil((state.total || 0) / state.perPage));
    nav.hidden = pages <= 1;
    if (pages <= 1) { nav.innerHTML = ""; return; }
    nav.innerHTML = `<button type="button" class="btn-ghost" data-dir="-1" ${state.page <= 1 ? "disabled" : ""}>Previous</button>
      <span>Page ${state.page} of ${pages}</span>
      <button type="button" class="btn-ghost" data-dir="1" ${state.page >= pages ? "disabled" : ""}>Next</button>`;
    $$("button", nav).forEach(b => b.addEventListener("click", () => onChange(state.page + Number(b.dataset.dir))));
  }

  /* Categories + locations for the report form (cached for the tab's lifetime). */
  let metaPromise;
  function meta() {
    if (!metaPromise) {
      metaPromise = api("GET", C.ENDPOINTS.meta).then(m => ({
        categories: (m && m.categories) || C.FALLBACK_META.categories,
        locations: (m && m.locations) || C.FALLBACK_META.locations
      })).catch(() => C.FALLBACK_META);
    }
    return metaPromise;
  }

  /* ------------------------------------------------------------------ *
   * Shared page behaviour
   * ------------------------------------------------------------------ */
  function paintUser(user) {
    const av = $("#avatar"); if (av) { av.textContent = initials(user.full_name || user.login_id); av.title = user.full_name || user.login_id || ""; }
    const g = $("#greeting"); if (g) g.textContent = greeting(user);
  }

  /** Show / hide password. Works for the icon buttons (.pw-eye) and text buttons (.pw-toggle). */
  document.addEventListener("click", e => {
    const btn = e.target.closest(".pw-eye, .pw-toggle");
    if (!btn || !btn.dataset.target) return;
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    if (btn.classList.contains("pw-eye")) btn.textContent = show ? "visibility_off" : "visibility";
    else btn.textContent = show ? "Hide" : "Show";
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    btn.setAttribute("aria-pressed", String(show));
  });

  document.addEventListener("click", e => {
    const link = e.target.closest(".logout");
    if (!link) return;
    e.preventDefault();
    logout();
  });

  /* ------------------------------------------------------------------ *
   * Notifications: the browser asks the backend how many unread there
   * are. When the number changes it tells the page (event) and, if it
   * went up, shows the newest message as a toast.
   * ------------------------------------------------------------------ */
  const notif = { unread: null, timer: null };

  function paintUnread(n) {
    const bell = $(".bell"); if (bell) bell.classList.toggle("has-unread", n > 0);
    const link = $('.side-nav a[href$="notifications.html"]');
    if (link) {
      let c = $(".count", link);
      if (n > 0) { if (!c) { c = document.createElement("span"); c.className = "count"; link.appendChild(c); } c.textContent = n > 99 ? "99+" : String(n); }
      else if (c) c.remove();
    }
  }

  async function announceLatest() {
    try {
      const r = await api("GET", C.ENDPOINTS.notifications, { query: { filter: "unread", per_page: 1 } });
      const first = r && r.items && r.items[0];
      toast(first ? first.message : "You have a new notification.");
    } catch (e) { /* the badge already shows it */ }
  }

  async function pollNotifications() {
    try {
      const r = await api("GET", C.ENDPOINTS.unreadCount);
      const n = Number(r && r.unread) || 0;
      const prev = notif.unread;
      notif.unread = n;
      paintUnread(n);
      if (prev !== null && n !== prev) {
        document.dispatchEvent(new CustomEvent("scmrs:notifications", { detail: { unread: n, previous: prev, increased: n > prev } }));
        if (n > prev) announceLatest();
      }
    } catch (e) { /* try again on the next tick */ }
  }

  function startNotifications() {
    pollNotifications();
    clearInterval(notif.timer);
    notif.timer = setInterval(() => { if (!document.hidden) pollNotifications(); }, C.POLL_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) pollNotifications(); });
  }

  /* ------------------------------------------------------------------ *
   * Page bootstrap
   * ------------------------------------------------------------------ */
  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  /**
   * Protected pages (<body data-role="student|admin">) call:
   *   SCMRS.page(async ({ user, role }) => { ... });
   * It checks the login, paints the header, starts notifications, then runs your code.
   */
  function page(init) {
    onReady(async () => {
      const role = document.body.dataset.role;
      const user = requireRole(role);
      if (!user) return;
      paintUser(user);
      startNotifications();
      // quietly refresh the profile; a 401 here sends an expired session back to login
      api("GET", C.ENDPOINTS.me).then(r => {
        if (r && r.user) { r.user.role = role; session.setUser(r.user); paintUser(r.user); }
      }).catch(() => {});
      try { await init({ user, role }); }
      catch (e) { console.error(e); toast(e.message || "Something went wrong.", "error"); }
    });
  }

  window.SCMRS = {
    config: C, $, $$, api, ApiError, session, page, onReady, demoEnabled,
    auth: { login, register, logout, requireRole, redirectIfLoggedIn, goLogin },
    notifications: { refresh: pollNotifications },
    meta, paintUser,
    ui: { esc, fmtDate, fmtDateTime, timeAgo, initials, greeting, badge, statusMeta, refOf,
          toast, say, busy, invalid, check, debounce, param, tableMessage, renderPager }
  };
})();
