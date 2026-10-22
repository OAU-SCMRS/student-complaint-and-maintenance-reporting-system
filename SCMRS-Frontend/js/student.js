/**
 * FixOAU - Core Platform Engine & Student Dashboard
 * 
 * Provides database syncing, demo authentication (group14 / grioup141234),
 * generic backend connectivity, complaints tracking, and dashboard metrics.
 */

window.FixOAU = window.FixOAU || (function () {
  const CONFIG = {
    // Generic backend API URL. Change to your live server or backend proxy if needed.
    BASE_URL: (window.FIXOAU_CONFIG && window.FIXOAU_CONFIG.API_URL) || "http://localhost:5000/api",
    DEMO_STUDENT_ID: "group14",
    DEMO_PASSWORD: "grioup141234"
  };

  const STORAGE = {
    USERS: "fixoau_users",
    SESSION: "fixoau_current_user",
    COMPLAINTS: "fixoau_complaints",
    NOTIFICATIONS: "fixoau_notifications",
    READ: "fixoau-read"
  };

  const DEFAULT_DEMO = {
    studentId: "group14",
    password: "grioup141234",
    name: "Group 14 Demo Student",
    email: "group14@student.oauife.edu.ng",
    phone: "08012345678",
    fixed: "group14",
    role: "student"
  };

  // Empty seed complaints and notifications - driven dynamically by user actions
  const SEED_COMPLAINTS = [];
  const SEED_NOTIFS = [];

  function getStored(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setStored(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  // Initialize persistent database and purge any previously stored mock complaints
  (function initDB() {
    const users = getStored(STORAGE.USERS, null);
    if (!users) {
      setStored(STORAGE.USERS, [DEFAULT_DEMO]);
    } else if (!users.some(u => u.studentId === CONFIG.DEMO_STUDENT_ID)) {
      users.push(DEFAULT_DEMO);
      setStored(STORAGE.USERS, users);
    }

    // Clean out old hardcoded sample mock complaints (FX-001 to FX-005) and old mock notifications (n1 to n5)
    const purgeKey = "fixoau_cleaned_mock_v3";
    if (!localStorage.getItem(purgeKey)) {
      const existing = getStored(STORAGE.COMPLAINTS, []);
      const cleanList = existing.filter(c => 
        !["FX-001", "FX-002", "FX-003", "FX-004", "FX-005"].includes(c.id)
      );
      setStored(STORAGE.COMPLAINTS, cleanList);
      
      // Clean mock notifications so unread count is not hardcoded to 5
      const existingNotifs = getStored(STORAGE.NOTIFICATIONS, []);
      const cleanNotifs = existingNotifs.filter(n => 
        !["n1", "n2", "n3", "n4", "n5"].includes(n.id)
      );
      setStored(STORAGE.NOTIFICATIONS, cleanNotifs);
      setStored(STORAGE.READ, []);
      localStorage.setItem(purgeKey, "true");
    } else if (getStored(STORAGE.COMPLAINTS, null) === null) {
      setStored(STORAGE.COMPLAINTS, []);
    }

    if (getStored(STORAGE.NOTIFICATIONS, null) === null) {
      setStored(STORAGE.NOTIFICATIONS, []);
    }
  })();

  const core = {
    config: CONFIG,

    getCurrentUser: function () {
      let u = getStored(STORAGE.SESSION, null);
      if (!u) {
        const users = getStored(STORAGE.USERS, [DEFAULT_DEMO]);
        u = users.find(x => x.studentId === CONFIG.DEMO_STUDENT_ID) || DEFAULT_DEMO;
        setStored(STORAGE.SESSION, u);
      }
      return u;
    },

    login: async function (studentId, password) {
      studentId = (studentId || "").trim();
      password = (password || "").trim();

      // DEMO ACCOUNT: Bypasses backend as requested
      if (studentId === CONFIG.DEMO_STUDENT_ID && password === CONFIG.DEMO_PASSWORD) {
        const users = getStored(STORAGE.USERS, [DEFAULT_DEMO]);
        let user = users.find(u => u.studentId === CONFIG.DEMO_STUDENT_ID) || DEFAULT_DEMO;
        setStored(STORAGE.SESSION, user);
        return { success: true, user: user, isDemo: true };
      }

      // GENERIC BACKEND INTEGRATION
      try {
        const res = await fetch(`${CONFIG.BASE_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, password })
        });
        if (res.ok) {
          const data = await res.json();
          const user = data.user || {
            studentId: studentId,
            name: data.name || studentId,
            email: data.email || `${studentId}@student.oauife.edu.ng`,
            phone: data.phone || "",
            fixed: studentId,
            role: "student",
            token: data.token
          };
          setStored(STORAGE.SESSION, user);
          return { success: true, user: user, isDemo: false };
        } else {
          const err = await res.json().catch(() => ({}));
          return { success: false, message: err.message || "Invalid credentials." };
        }
      } catch (err) {
        // Fallback to local accounts
        const users = getStored(STORAGE.USERS, []);
        const local = users.find(u => u.studentId === studentId && u.password === password);
        if (local) {
          setStored(STORAGE.SESSION, local);
          return { success: true, user: local, isDemo: false };
        }
        return {
          success: false,
          message: "Unable to reach server. For demo, use Student ID: 'group14' & Password: 'grioup141234'."
        };
      }
    },

    logout: function () {
      try { localStorage.removeItem(STORAGE.SESSION); } catch (e) {}
      window.location.reload();
    },

    updateProfile: async function (updates) {
      const current = this.getCurrentUser();
      const updated = Object.assign({}, current, updates);
      setStored(STORAGE.SESSION, updated);

      const users = getStored(STORAGE.USERS, []);
      const idx = users.findIndex(u => u.studentId === updated.studentId);
      if (idx !== -1) {
        users[idx] = Object.assign({}, users[idx], updates);
      } else {
        users.push(updated);
      }
      setStored(STORAGE.USERS, users);

      try {
        await fetch(`${CONFIG.BASE_URL}/profile`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": current.token ? `Bearer ${current.token}` : ""
          },
          body: JSON.stringify(updates)
        });
      } catch (e) {}

      return updated;
    },

    updatePassword: async function (currPw, newPw) {
      const user = this.getCurrentUser();
      if (user.password && user.password !== currPw) {
        return { success: false, message: "Current password does not match." };
      }
      user.password = newPw;
      setStored(STORAGE.SESSION, user);

      const users = getStored(STORAGE.USERS, []);
      const idx = users.findIndex(u => u.studentId === user.studentId);
      if (idx !== -1) {
        users[idx].password = newPw;
        setStored(STORAGE.USERS, users);
      }

      try {
        await fetch(`${CONFIG.BASE_URL}/password`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: user.studentId, currentPassword: currPw, newPassword: newPw })
        });
      } catch (e) {}

      return { success: true };
    },

    getComplaints: function (studentId) {
      const all = getStored(STORAGE.COMPLAINTS, SEED_COMPLAINTS);
      const target = studentId || (this.getCurrentUser() ? this.getCurrentUser().studentId : null);
      if (!target) return all;
      return all.filter(c => !c.studentId || c.studentId === target);
    },

    getAllComplaints: function () {
      return getStored(STORAGE.COMPLAINTS, SEED_COMPLAINTS);
    },

    submitComplaint: async function (data) {
      const user = this.getCurrentUser();
      const all = getStored(STORAGE.COMPLAINTS, []);

      // Generate sequential FX-XXX ID starting from FX-001
      let maxNum = 0;
      all.forEach(c => {
        if (c.id && c.id.startsWith("FX-")) {
          const n = parseInt(c.id.replace("FX-", ""), 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      });
      const newId = "FX-" + String(maxNum + 1).padStart(3, "0");

      const now = new Date();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const formattedDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

      const newComplaint = {
        id: newId,
        studentId: user.studentId || CONFIG.DEMO_STUDENT_ID,
        studentName: user.name || "Student",
        problem: data.title || data.problem || "Reported Issue",
        category: data.category || "General",
        location: data.location || "Campus",
        description: data.description || "",
        status: "Pending",
        date: formattedDate,
        photo: data.photo || "",
        photos: data.photos || [],
        updates: [{ text: "Complaint submitted", date: formattedDate }]
      };

      all.unshift(newComplaint);
      setStored(STORAGE.COMPLAINTS, all);

      this.addNotification({
        id: "n" + Date.now(),
        text: `We received your complaint ${newId}`,
        complaint: newId,
        date: formattedDate
      });

      try {
        await fetch(`${CONFIG.BASE_URL}/complaints`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": user.token ? `Bearer ${user.token}` : ""
          },
          body: JSON.stringify(newComplaint)
        });
      } catch (e) {}

      window.complaints = all;
      return newComplaint;
    },

    updateComplaintStatus: async function (id, newStatus, note) {
      const all = getStored(STORAGE.COMPLAINTS, []);
      const complaint = all.find(c => c.id === id);
      if (!complaint) return null;

      const oldStatus = complaint.status;
      complaint.status = newStatus;
      if (!complaint.updates) complaint.updates = [];

      const now = new Date();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const formattedDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

      complaint.updates.unshift({
        text: note || `Status updated from ${oldStatus} to ${newStatus}`,
        date: formattedDate
      });

      setStored(STORAGE.COMPLAINTS, all);

      // Emit notification for status change
      this.addNotification({
        id: "n" + Date.now(),
        text: `Your complaint ${id} is now ${newStatus}`,
        complaint: id,
        date: formattedDate
      });

      // Generic backend sync
      try {
        await fetch(`${CONFIG.BASE_URL}/complaints/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": this.getCurrentUser().token ? `Bearer ${this.getCurrentUser().token}` : ""
          },
          body: JSON.stringify({ status: newStatus, note: note })
        });
      } catch (e) {}

      window.complaints = all;
      return complaint;
    },

    getNotifications: function () {
      return getStored(STORAGE.NOTIFICATIONS, SEED_NOTIFS);
    },

    addNotification: function (notif) {
      const list = this.getNotifications();
      list.unshift(notif);
      setStored(STORAGE.NOTIFICATIONS, list);
      this.updateNavAndBell();
      return notif;
    },

    getReadNotifications: function () {
      return getStored(STORAGE.READ, []);
    },

    saveReadNotifications: function (list) {
      setStored(STORAGE.READ, list);
      this.updateNavAndBell();
    },

    isNotificationUnread: function (id) {
      return !this.getReadNotifications().includes(id);
    },

    unreadNotificationCount: function () {
      const read = this.getReadNotifications();
      return this.getNotifications().filter(n => !read.includes(n.id)).length;
    },

    markNotificationRead: function (id) {
      const read = this.getReadNotifications();
      if (!read.includes(id)) {
        read.push(id);
        this.saveReadNotifications(read);
      }
    },

    markAllNotificationsRead: function () {
      this.saveReadNotifications(this.getNotifications().map(n => n.id));
    },

    updateNavAndBell: function () {
      const unread = this.unreadNotificationCount();
      document.querySelectorAll(".bell").forEach(b => {
        b.href = "notifications.html";
        b.classList.toggle("has-unread", unread > 0);
      });
      document.querySelectorAll(".side-nav a").forEach(link => {
        if (!link.dataset.nav && link.textContent.trim().startsWith("Notifications")) {
          link.dataset.nav = "notifications";
        }
        if (link.dataset.nav === "notifications") {
          link.href = "notifications.html";
          const old = link.querySelector(".count");
          if (old) old.remove();
          if (unread > 0) {
            const pill = document.createElement("span");
            pill.className = "count";
            pill.textContent = unread;
            link.append(pill);
          }
        }
      });
    },

    badgeClass: function (status) {
      if (status === "Resolved") return "badge-resolved";
      if (status === "In Progress") return "badge-progress";
      return "badge-pending";
    },

    showToast: function (msg) {
      const t = document.getElementById("toast");
      if (!t) return;
      t.textContent = msg;
      t.classList.add("show");
      setTimeout(() => t.classList.remove("show"), 2600);
    },

    wireAuthUI: function () {
      const dialog = document.getElementById("auth-dialog");
      const chip = document.getElementById("demo-chip");
      const logoutBtn = document.getElementById("logout-btn");
      const cancelBtn = document.getElementById("login-cancel-btn");
      const fillDemoBtn = document.getElementById("fill-demo-btn");
      const form = document.getElementById("login-form");
      const errorP = document.getElementById("login-error");

      if (chip && dialog) chip.addEventListener("click", () => dialog.showModal());
      if (cancelBtn && dialog) cancelBtn.addEventListener("click", () => dialog.close());
      if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
          e.preventDefault();
          if (dialog) dialog.showModal();
          else this.logout();
        });
      }
      if (fillDemoBtn) {
        fillDemoBtn.addEventListener("click", () => {
          const sInput = document.getElementById("login-student-id");
          const pInput = document.getElementById("login-password");
          if (sInput) sInput.value = CONFIG.DEMO_STUDENT_ID;
          if (pInput) pInput.value = CONFIG.DEMO_PASSWORD;
          if (errorP) errorP.textContent = "";
        });
      }
      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const sId = (document.getElementById("login-student-id").value || "").trim();
          const pW = (document.getElementById("login-password").value || "").trim();
          if (errorP) errorP.textContent = "Checking credentials...";
          const res = await this.login(sId, pW);
          if (res.success) {
            if (dialog) dialog.close();
            this.showToast(`Logged in as ${res.user.name || res.user.studentId}`);
            setTimeout(() => window.location.reload(), 400);
          } else {
            if (errorP) errorP.textContent = res.message || "Login failed.";
          }
        });
      }
    },

    wireMobileMenu: function () {
      const btn = document.getElementById("menu-btn");
      const sidebar = document.getElementById("sidebar");
      if (btn && sidebar) {
        btn.addEventListener("click", () => sidebar.classList.toggle("open"));
      }
    }
  };

  return core;
})();

// Dashboard page rendering logic
function renderDashboard() {
  const api = window.FixOAU;
  if (!api) return;
  const user = api.getCurrentUser();

  // Populate user header
  const firstName = (user.name || "Student").split(" ")[0];
  const greetingEl = document.getElementById("greeting");
  if (greetingEl) greetingEl.textContent = `Hello, ${firstName} 👋`;

  const avatarEl = document.getElementById("avatar");
  if (avatarEl) avatarEl.textContent = (user.name || "S").charAt(0).toUpperCase();

  const chipEl = document.getElementById("chip-user");
  if (chipEl) chipEl.textContent = user.studentId || "group14";

  // Complaints from database
  const myComplaints = api.getComplaints(user.studentId);
  window.complaints = myComplaints;

  // Stat metrics calculated dynamically from database
  const count = (status) => myComplaints.filter(c => c.status === status).length;
  const statTotal = document.getElementById("stat-total");
  const statPending = document.getElementById("stat-pending");
  const statProgress = document.getElementById("stat-progress");
  const statResolved = document.getElementById("stat-resolved");

  if (statTotal) statTotal.textContent = myComplaints.length;
  if (statPending) statPending.textContent = count("Pending");
  if (statProgress) statProgress.textContent = count("In Progress");
  if (statResolved) statResolved.textContent = count("Resolved");

  // Recent complaints table (top 4 latest, updated dynamically)
  const tbody = document.getElementById("table-body");
  if (tbody) {
    if (myComplaints.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:36px 16px;color:var(--muted)">
            <p style="font-size:1rem;font-weight:700;margin-bottom:6px;color:var(--navy)">No complaints recorded yet</p>
            <p style="font-size:.88rem;margin-bottom:14px">Report a problem or update complaints in My Complaints to see them here.</p>
            <a href="report.html" class="btn-small" style="display:inline-block">+ Report a Problem</a>
          </td>
        </tr>`;
    } else {
      tbody.innerHTML = myComplaints.slice(0, 4).map(c => `
        <tr>
          <td><strong>${c.id}</strong></td>
          <td>${c.problem}</td>
          <td>${c.location}</td>
          <td><span class="badge ${api.badgeClass(c.status)}">${c.status}</span></td>
          <td>${c.date}</td>
        </tr>
      `).join("");
    }
  }

  // Wires UI elements
  api.updateNavAndBell();
  api.wireAuthUI();
  api.wireMobileMenu();
}

// Initial render
renderDashboard();

// Auto-sync dashboard whenever complaints are modified or updated from My Complaints
window.addEventListener("storage", renderDashboard);
window.addEventListener("focus", renderDashboard);
