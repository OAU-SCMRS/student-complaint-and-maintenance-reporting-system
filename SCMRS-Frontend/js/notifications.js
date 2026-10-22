// FixOAU Platform Service
const api = window.FixOAU;
const user = api ? api.getCurrentUser() : { studentId: "group14", name: "Student" };

// Update topbar avatar and demo chip
const avatarEl = document.getElementById("avatar");
if (avatarEl) avatarEl.textContent = (user.name || "S").charAt(0).toUpperCase();

const chipEl = document.getElementById("chip-user");
if (chipEl) chipEl.textContent = user.studentId || "group14";

const list = document.getElementById("list");
const empty = document.getElementById("empty");
const tabs = document.querySelectorAll(".tab");
let activeTab = "All";

function getActiveApi() {
  return window.FixOAU || api;
}

function getNotifs() {
  const a = getActiveApi();
  return a ? a.getNotifications() : [];
}

function checkUnread(id) {
  const a = getActiveApi();
  return a ? a.isNotificationUnread(id) : false;
}

function render() {
  const a = getActiveApi();
  const allNotifs = getNotifs();
  const unreadCount = a ? a.unreadNotificationCount() : 0;

  tabs.forEach((tab) => {
    const name = tab.dataset.tab;
    const count = name === "All" ? allNotifs.length : unreadCount;
    tab.textContent = name + " (" + count + ")";
    tab.classList.toggle("active", name === activeTab);
    tab.setAttribute("aria-selected", name === activeTab);
  });

  const shown = allNotifs.filter((n) => activeTab === "All" || checkUnread(n.id));

  if (!list) return;

  if (shown.length === 0) {
    list.innerHTML = "";
    if (empty) empty.hidden = false;
  } else {
    if (empty) empty.hidden = true;
    list.innerHTML = shown.map((n) => `
      <a class="notif ${checkUnread(n.id) ? "unread" : ""}" href="complaint-details.html?id=${n.complaint}" data-id="${n.id}">
        <span class="notif-dot"></span>
        <span class="notif-text">${n.text}<small>${n.date}</small></span>
        <span class="notif-go">View →</span>
      </a>`).join("");
  }

  if (a) a.updateNavAndBell();
}

// Opening a notification marks it as read and updates counter immediately
if (list) {
  list.addEventListener("click", (e) => {
    const item = e.target.closest(".notif");
    if (item && item.dataset.id) {
      const a = getActiveApi();
      if (a) {
        a.markNotificationRead(item.dataset.id);
        a.updateNavAndBell();
      }
    }
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeTab = tab.dataset.tab;
    render();
  });
});

const markAllBtn = document.getElementById("mark-all");
if (markAllBtn) {
  markAllBtn.addEventListener("click", () => {
    const a = getActiveApi();
    if (a) {
      a.markAllNotificationsRead();
      a.updateNavAndBell();
      a.showToast("All notifications marked as read");
    }
    render();
  });
}

const activeApi = getActiveApi();
if (activeApi) {
  activeApi.updateNavAndBell();
  activeApi.wireAuthUI();
  activeApi.wireMobileMenu();
} else {
  const menuBtn = document.getElementById("menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      const s = document.getElementById("sidebar");
      if (s) s.classList.toggle("open");
    });
  }
}

render();

// Auto-sync notifications when switching tabs or when new actions occur
window.addEventListener("storage", render);
window.addEventListener("focus", render);
