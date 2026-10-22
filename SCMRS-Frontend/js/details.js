const studentName = "Tayo";
document.getElementById("avatar").textContent = studentName.charAt(0).toUpperCase();

function badgeClass(status) {
  if (status === "Resolved") return "badge-resolved";
  if (status === "In Progress") return "badge-progress";
  return "badge-pending";
}

// Stops typed text from being read as HTML
function esc(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Find the complaint from the link, like complaint-details.html?id=FX-002
const id = new URLSearchParams(window.location.search).get("id");
const c = complaints.find((item) => item.id === id);
const detail = document.getElementById("detail");

if (!c) {
  detail.innerHTML = `
    <h2>Complaint not found</h2>
    <p style="color:var(--muted);margin:8px 0 18px">We could not find that complaint.</p>
    <a class="btn" href="complaints.html">Back to My Complaints</a>`;
} else {
  const photo = c.photo
    ? `<img src="${esc(c.photo)}" alt="Photo of the problem">`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg><span>No photo added</span>`;

  detail.innerHTML = `
    <div class="detail-head">
      <h2>${esc(c.id)}</h2>
      <span class="badge ${badgeClass(c.status)}">${esc(c.status)}</span>
    </div>

    <div class="detail-grid">
      <div class="photo-box">${photo}</div>
      <dl class="facts">
        <div><dt>Problem</dt><dd>${esc(c.problem)}</dd></div>
        <div><dt>Location</dt><dd>${esc(c.location)}</dd></div>
        <div><dt>Date Reported</dt><dd>${esc(c.date)}</dd></div>
        <div><dt>Description</dt><dd class="desc">${esc(c.description)}</dd></div>
      </dl>
    </div>

    <h3 class="updates-title">Updates</h3>
    <ul class="timeline">
      ${c.updates.map((u) => `<li><small>${esc(u.date)}</small><strong>${esc(u.text)}</strong></li>`).join("")}
    </ul>`;

  document.title = c.id + " | FixOAU";
}

// Mobile sidebar
document.getElementById("menu-btn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});