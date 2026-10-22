// Initialize / verify FixOAU core is loaded
const api = window.FixOAU;
const user = api ? api.getCurrentUser() : { studentId: "group14", name: "Student" };

// Update topbar avatar and demo chip
const avatarEl = document.getElementById("avatar");
if (avatarEl) avatarEl.textContent = (user.name || "S").charAt(0).toUpperCase();

const chipEl = document.getElementById("chip-user");
if (chipEl) chipEl.textContent = user.studentId || "group14";

const tableBody = document.getElementById("table-body");
const empty = document.getElementById("empty");
const tabs = document.querySelectorAll(".tab");
let activeTab = "All";

// Fetch complaints for current student from database
function getStudentComplaints() {
  return api ? api.getComplaints(user.studentId) : (window.complaints || []);
}

function badgeClass(status) {
  if (api) return api.badgeClass(status);
  if (status === "Resolved") return "badge-resolved";
  if (status === "In Progress") return "badge-progress";
  return "badge-pending";
}

// Tab labels with counts, like "All (5)", "Pending (2)", "In Progress (1)", "Resolved (2)"
function renderTabs() {
  const currentList = getStudentComplaints();
  tabs.forEach((tab) => {
    const name = tab.dataset.status;
    const n = name === "All" ? currentList.length : currentList.filter((c) => c.status === name).length;
    tab.textContent = name + " (" + n + ")";
    tab.classList.toggle("active", name === activeTab);
    tab.setAttribute("aria-selected", name === activeTab);
  });
}

// Table rows for the chosen tab
function renderTable() {
  const currentList = getStudentComplaints();
  const shown = activeTab === "All" ? currentList : currentList.filter((c) => c.status === activeTab);

  if (shown.length === 0) {
    tableBody.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;
  tableBody.innerHTML = shown.map((c) => `
    <tr>
      <td><strong>${c.id}</strong></td>
      <td>${c.problem}</td>
      <td>${c.location}</td>
      <td><span class="badge ${badgeClass(c.status)}">${c.status}</span></td>
      <td>${c.date}</td>
      <td>
        <select class="status-select" data-id="${c.id}" aria-label="Change status of ${c.id}">
          <option value="Pending" ${c.status === "Pending" ? "selected" : ""}>Pending</option>
          <option value="In Progress" ${c.status === "In Progress" ? "selected" : ""}>In Progress</option>
          <option value="Resolved" ${c.status === "Resolved" ? "selected" : ""}>Resolved</option>
        </select>
      </td>
      <td>
        <a class="view-btn" href="complaint-details.html?id=${c.id}" aria-label="View ${c.id}">
          <svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
        </a>
      </td>
    </tr>`).join("");
}

// Handle updating status directly from My Complaints
tableBody.addEventListener("change", async (e) => {
  const select = e.target.closest(".status-select");
  if (!select) return;
  const id = select.dataset.id;
  const newStatus = select.value;
  if (api && api.updateComplaintStatus) {
    select.disabled = true;
    await api.updateComplaintStatus(id, newStatus);
    select.disabled = false;
    api.showToast(`Complaint ${id} updated to "${newStatus}"`);
    renderTabs();
    renderTable();
  }
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeTab = tab.dataset.status;
    renderTabs();
    renderTable();
  });
});


if (api) {
  api.updateNavAndBell();
  api.wireAuthUI();
  api.wireMobileMenu();
} else {
  const menuBtn = document.getElementById("menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      const s = document.getElementById("sidebar");
      if (s) s.classList.toggle("open");
    });
  }
}

renderTabs();
renderTable();