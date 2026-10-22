// Sample notifications for now. The backend person will send real ones
// (for example when staff change a status or post an update).
const notifications = [
  { id: "n1", text: "Your complaint FX-001 is now In Progress", complaint: "FX-001", date: "13 Oct 2026" },
  { id: "n2", text: "An electrician has been assigned to FX-001", complaint: "FX-001", date: "13 Oct 2026" },
  { id: "n3", text: "Your complaint FX-003 has been resolved", complaint: "FX-003", date: "11 Oct 2026" },
  { id: "n4", text: "We received your complaint FX-002", complaint: "FX-002", date: "10 Oct 2026" },
  { id: "n5", text: "Your complaint FX-005 has been resolved", complaint: "FX-005", date: "6 Oct 2026" }
];

// Change this name to reset the notifications and see the red dot again
const READ_KEY = "fixoau-read";

function getRead() {
  try {
    const saved = JSON.parse(localStorage.getItem(READ_KEY));
    return saved || ["n4", "n5"]; // at first, n1 to n3 are unread
  } catch (e) {
    return ["n4", "n5"];
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

// Updates the bell and the sidebar link on every page
function updateBell() {
  const unread = unreadCount();

  document.querySelectorAll(".bell").forEach((bell) => {
    bell.href = "notifications.html";
    bell.classList.toggle("has-unread", unread > 0);
  });

  document.querySelectorAll(".side-nav a").forEach((link) => {
    if (!link.dataset.nav && link.textContent.trim() === "Notifications") link.dataset.nav = "notifications";
    if (link.dataset.nav !== "notifications") return;
    link.href = "notifications.html";
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