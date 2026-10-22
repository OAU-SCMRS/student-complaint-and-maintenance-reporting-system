// Sample notifications for now. The backend person will send real ones
// (for example when a student submits a new complaint).
const notifications = [
  { id: "a1", type: "New", text: "New complaint FX-012: Blocked drainage, Behind SUB", complaint: "FX-012", date: "21 Oct 2026" },
  { id: "a2", type: "Unassigned", text: "FX-017 (Broken tap, Hostel B) has not been assigned to a worker", complaint: "FX-017", date: "21 Oct 2026" },
  { id: "a3", type: "Overdue", text: "FX-014 (Electrical fault, Block C) has been pending for 3 days", complaint: "FX-014", date: "20 Oct 2026" },
  { id: "a4", type: "New", text: "New complaint FX-015: Water leakage, Hostel C", complaint: "FX-015", date: "19 Oct 2026" },
  { id: "a5", type: "Resolved", text: "FX-016 (Damaged chair) was marked as resolved", complaint: "FX-016", date: "18 Oct 2026" }
];

// Change this name to reset the notifications and see the red dot again
const READ_KEY = "fixoau-admin-read";

function getRead() {
  try {
    const saved = JSON.parse(localStorage.getItem(READ_KEY));
    return saved || ["a4", "a5"]; // at first, a1 to a3 are unread
  } catch (e) {
    return ["a4", "a5"];
  }
}
function saveRead(list) {
  try { localStorage.setItem(READ_KEY, JSON.stringify(list)); } catch (e) {}
}
function isUnread(id) { return !getRead().includes(id); }
function unreadCount() { return notifications.filter((n) => isUnread(n.id)).length; }
function markRead(id) {
  const read = getRead();
  if (!read.includes(id)) { read.push(id); saveRead(read); }
}
function markAllRead() { saveRead(notifications.map((n) => n.id)); }

// Updates the bell and the sidebar link on every admin page
function updateBell() {
  const unread = unreadCount();

  document.querySelectorAll(".bell").forEach((bell) => {
    bell.href = "admin-notifications.html";
    bell.classList.toggle("has-unread", unread > 0);
  });

  document.querySelectorAll(".side-nav a").forEach((link) => {
    if (!link.dataset.nav && link.textContent.trim() === "Notifications") link.dataset.nav = "notifications";
    if (link.dataset.nav !== "notifications") return;
    link.href = "admin-notifications.html";
    const old = link.querySelector(".count");
    if (old) old.remove();
    if (unread > 0) {
      const pill = document.createElement("span");
      pill.className = "count";
      pill.textContent = unread;
      link.append(pill);
    }
  });
}

updateBell();