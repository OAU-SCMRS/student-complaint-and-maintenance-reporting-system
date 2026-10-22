const list = document.getElementById("list");
const empty = document.getElementById("empty");
const tabs = document.querySelectorAll(".tab");
let activeTab = "All";

function render() {
  const unread = unreadCount();

  tabs.forEach((tab) => {
    const name = tab.dataset.tab;
    tab.textContent = name + " (" + (name === "All" ? notifications.length : unread) + ")";
    tab.classList.toggle("active", name === activeTab);
    tab.setAttribute("aria-selected", name === activeTab);
  });

  const shown = notifications.filter((n) => activeTab === "All" || isUnread(n.id));

  list.innerHTML = shown.map((n) => `
    <a class="notif ${isUnread(n.id) ? "unread" : ""}" href="manage-complaints.html?q=${n.complaint}" data-id="${n.id}">
      <span class="notif-dot"></span>
      <span class="notif-text">
        <span class="notif-tag tag-${n.type.toLowerCase()}">${n.type}</span>
        ${n.text}<small>${n.date}</small>
      </span>
      <span class="notif-go">Open →</span>
    </a>`).join("");

  empty.hidden = shown.length > 0;
}

// Opening a notification marks it as read
list.addEventListener("click", (e) => {
  const item = e.target.closest(".notif");
  if (item) markRead(item.dataset.id);
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeTab = tab.dataset.tab;
    render();
  });
});

document.getElementById("mark-all").addEventListener("click", () => {
  markAllRead();
  updateBell();
  render();
});

// Mobile sidebar
document.getElementById("menu-btn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

render();