// Sample data for now. The backend person will replace this with real data from the server.
const complaints = [
  { id: "FX-018", problem: "Faulty light", location: "Block A", status: "In Progress", date: "12 Oct 2026", assigned: "Ahmed" },
  { id: "FX-017", problem: "Broken tap", location: "Hostel B", status: "Pending", date: "11 Oct 2026", assigned: "" },
  { id: "FX-016", problem: "Damaged chair", location: "Lecture Hall 2", status: "Resolved", date: "10 Oct 2026", assigned: "Musa" },
  { id: "FX-015", problem: "Water leakage", location: "Hostel C", status: "In Progress", date: "9 Oct 2026", assigned: "Ahmed" },
  { id: "FX-014", problem: "Electrical fault", location: "Block C", status: "Pending", date: "8 Oct 2026", assigned: "Tunde" },
  { id: "FX-013", problem: "Broken window", location: "Hostel A", status: "Resolved", date: "7 Oct 2026", assigned: "Musa" },
  { id: "FX-012", problem: "Blocked drainage", location: "Behind SUB", status: "Pending", date: "6 Oct 2026", assigned: "" },
  { id: "FX-011", problem: "Faulty fan", location: "Lecture Hall 1", status: "In Progress", date: "5 Oct 2026", assigned: "Tunde" }
];

function badgeClass(status) {
  if (status === "Resolved") return "badge-resolved";
  if (status === "In Progress") return "badge-progress";
  return "badge-pending";
}

// Greeting changes with the time of day
const hour = new Date().getHours();
const timeOfDay = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
document.getElementById("greeting").textContent = timeOfDay + ", Admin 👋";

// Stat cards
const count = (s) => complaints.filter((c) => c.status === s).length;
document.getElementById("stat-total").textContent = complaints.length;
document.getElementById("stat-pending").textContent = count("Pending");
document.getElementById("stat-progress").textContent = count("In Progress");
document.getElementById("stat-resolved").textContent = count("Resolved");

// Recent complaints (the latest 5)
document.getElementById("table-body").innerHTML = complaints.slice(0, 5).map((c) => `
  <tr>
    <td>${c.id}</td>
    <td>${c.problem}</td>
    <td>${c.location}</td>
    <td><span class="badge ${badgeClass(c.status)}">${c.status}</span></td>
    <td>${c.date}</td>
    <td>${c.assigned || '<span class="muted">Unassigned</span>'}</td>
  </tr>`).join("");

// Mobile sidebar
document.getElementById("menu-btn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});