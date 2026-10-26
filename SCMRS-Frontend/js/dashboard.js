/*
 * Dashboards (student + admin share this file).
 * Fills every [data-stat] card from the backend and renders the recent-complaints table.
 * Student table: ID | Problem | Location | Status | Date
 * Admin table:   ID | Problem | Location | Status | Date | Assigned To
 */
SCMRS.page(({ role }) => {
  const { $, $$, api, config, ui } = SCMRS;
  const tbody = $("#table-body");
  const cols = $$("thead th", tbody.closest("table")).length;

  const idLink = c => role === "admin"
    ? `manage-complaints.html?open=${encodeURIComponent(c.id)}`
    : config.ROUTES.student.complaintLink(c.id);

  function row(c) {
    const assigned = c.assigned_to ? ui.esc(c.assigned_to) : '<span class="muted">Unassigned</span>';
    return `<tr>
      <td><a href="${idLink(c)}"><strong>${ui.esc(ui.refOf(c))}</strong></a></td>
      <td>${ui.esc(c.title)}</td>
      <td>${ui.esc(c.location)}</td>
      <td>${ui.badge(c.status)}</td>
      <td>${ui.esc(ui.fmtDate(c.created_at))}</td>
      ${role === "admin" ? `<td>${assigned}</td>` : ""}
    </tr>`;
  }

  async function load() {
    try {
      const data = await api("GET", config.ENDPOINTS.dashboard(role));
      const stats = (data && data.stats) || {};
      $$("[data-stat]").forEach(el => { el.textContent = stats[el.dataset.stat] ?? 0; });

      const recent = (data && data.recent) || [];
      if (!recent.length) {
        ui.tableMessage(tbody, cols, role === "admin" ? "No complaints have been submitted yet." : "You have not reported anything yet.");
      } else {
        tbody.innerHTML = recent.map(row).join("");
      }
    } catch (err) {
      ui.tableMessage(tbody, cols, err.message, load);
    }
  }

  tbody.innerHTML = "";
  ui.tableMessage(tbody, cols, "Loading...");
  load();

  // a status change or new complaint elsewhere: refresh the numbers
  document.addEventListener("scmrs:notifications", load);
});
