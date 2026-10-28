// Admin dashboard - unified with student data layer
const api = window.FixOAU;

function badgeClass(status) {
  if (status === "Resolved") return "badge-resolved";
  if (status === "In Progress") return "badge-progress";
  return "badge-pending";
}

function loadAdminData() {
  let complaints = [];
  if (api && typeof api.getAllComplaints === "function") {
    complaints = api.getAllComplaints();
  } else {
    complaints = window.complaints || [];
  }

  // Greeting
  const greetingEl = document.getElementById("greeting");
  if (greetingEl && !greetingEl.textContent.includes(",")) {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const session = window.AdminAuth ? window.AdminAuth.getSession() : null;
    const name = session && session.admin && session.admin.name ? session.admin.name : "Admin";
    greetingEl.textContent = timeOfDay + ", " + name + " Ã°Å¸â€˜â€¹";
  }

  // Stats
  const count = (s) => complaints.filter((c) => c.status === s).length;
  const statTotal = document.getElementById("stat-total");
  const statPending = document.getElementById("stat-pending");
  const statProgress = document.getElementById("stat-progress");
  const statResolved = document.getElementById("stat-resolved");
  if (statTotal) statTotal.textContent = complaints.length;
  if (statPending) statPending.textContent = count("Pending");
  if (statProgress) statProgress.textContent = count("In Progress");
  if (statResolved) statResolved.textContent = count("Resolved");

  // Recent complaints (latest 5)
  const tableBody = document.getElementById("table-body");
  if (tableBody) {
    const recent = complaints.slice(0, 5);
    tableBody.innerHTML = recent.map((c) => 
      <tr>
        <td></td>
        <td></td>
        <td></td>
        <td><span class="badge "></span></td>
        <td></td>
        <td></td>
      </tr>).join("");
  }
}

// Mobile sidebar
const menuBtn = document.getElementById("menu-btn");
if (menuBtn) {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    let overlay = document.querySelector(".sidebar-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "sidebar-overlay";
      document.body.appendChild(overlay);
    }
    
    function openSidebar() {
      sidebar.classList.add("open");
      overlay.classList.add("active");
      document.body.classList.add("sidebar-open");
      menuBtn.setAttribute("aria-expanded", "true");
    }
    
    function closeSidebar() {
      sidebar.classList.remove("open");
      overlay.classList.remove("active");
      document.body.classList.remove("sidebar-open");
      menuBtn.setAttribute("aria-expanded", "false");
    }
    
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (sidebar.classList.contains("open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
    
    overlay.addEventListener("click", closeSidebar);
    
    const navLinks = sidebar.querySelectorAll(".side-nav a, .logout");
    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 800) {
          closeSidebar();
        }
      });
    });
    
    window.addEventListener("resize", () => {
      if (window.innerWidth > 800) {
        closeSidebar();
      }
    });
  }
}

loadAdminData();
window.addEventListener("focus", loadAdminData);