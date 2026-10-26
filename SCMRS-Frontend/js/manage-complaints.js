/*
 * Admin: Manage Complaints.
 * List (search, status filter, paging) -> open one -> set status / assignee / write an update.
 * Saving sends ONE request to the backend, which stores it and notifies the student.
 */
SCMRS.page(() => {
  const { $, api, config, ui } = SCMRS;
  const tbody = $("#table-body");
  const empty = $("#empty");
  const pager = $("#pager");
  const search = $("#search");
  const filter = $("#filter");
  const dialog = $("#dialog");
  const statusSel = $("#dialog-status");
  const assignee = $("#dialog-assignee");
  const note = $("#note-text");
  const noteErr = $("#note-error");
  const saveBtn = $("#note-save");
  const state = { q: "", status: "", page: 1, perPage: config.PAGE_SIZE };
  let current = null;                       // the complaint open in the dialog
  const knownAssignees = new Set();

  config.STATUSES.forEach(s => { filter.add(new Option(s.value, s.value)); statusSel.add(new Option(s.value, s.value)); });

  function row(c) {
    if (c.assigned_to) knownAssignees.add(c.assigned_to);
    return `<tr>
      <td><strong>${ui.esc(ui.refOf(c))}</strong></td>
      <td>${ui.esc(c.title)}</td>
      <td>${ui.esc(c.location)}</td>
      <td>${ui.badge(c.status)}</td>
      <td>${c.assigned_to ? ui.esc(c.assigned_to) : '<span class="muted">Unassigned</span>'}</td>
      <td><button type="button" class="btn-small" data-open="${ui.esc(c.id)}">Update</button></td>
    </tr>`;
  }

  async function load() {
    try {
      const data = await api("GET", config.ENDPOINTS.adminComplaints, {
        query: { q: state.q, status: state.status, page: state.page, per_page: state.perPage }
      });
      const items = (data && data.items) || [];
      tbody.innerHTML = items.map(row).join("");
      empty.hidden = items.length > 0;
      $("#assignee-list").innerHTML = Array.from(knownAssignees).map(n => `<option value="${ui.esc(n)}">`).join("");
      ui.renderPager(pager, { page: state.page, perPage: state.perPage, total: (data && data.total) || 0 }, p => { state.page = p; load(); });
    } catch (err) {
      empty.hidden = true; pager.hidden = true;
      ui.tableMessage(tbody, 6, err.message, load);
    }
  }

  search.addEventListener("input", ui.debounce(() => { state.q = search.value.trim(); state.page = 1; load(); }, 300));
  filter.addEventListener("change", () => { state.status = filter.value; state.page = 1; load(); });
  tbody.addEventListener("click", e => { const b = e.target.closest("[data-open]"); if (b) openComplaint(b.dataset.open, b); });

  /* ---------- dialog ---------- */
  async function openComplaint(id, trigger) {
    if (trigger) ui.busy(trigger, true, "Opening...");
    try {
      const res = await api("GET", config.ENDPOINTS.adminComplaint(id));
      current = res.complaint;
      fillDialog(current);
      if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    } catch (err) { ui.toast(err.message, "error"); }
    if (trigger) ui.busy(trigger, false);
  }

  function fillDialog(c) {
    $("#dialog-title").textContent = `${ui.refOf(c)} \u2013 ${c.title}`;
    const photos = (c.photos || []).map((u, i) =>
      `<a href="${ui.esc(u)}" target="_blank" rel="noopener"><img src="${ui.esc(u)}" alt="Photo ${i + 1}"></a>`).join("");
    const s = c.student || {};
    $("#dialog-info").innerHTML = `
      <dl>
        <dt>Student</dt><dd>${ui.esc(s.name || s.login_id || "Unknown")}${s.login_id && s.name ? ` (${ui.esc(s.login_id)})` : ""}</dd>
        <dt>Category</dt><dd>${ui.esc(c.category)}</dd>
        <dt>Location</dt><dd>${ui.esc(c.location)}</dd>
        <dt>Submitted</dt><dd>${ui.esc(ui.fmtDateTime(c.created_at))}</dd>
      </dl>
      <p>${ui.esc(c.description)}</p>
      ${photos ? `<div class="dialog-photos">${photos}</div>` : ""}`;

    statusSel.value = ui.statusMeta(c.status).value;
    assignee.value = c.assigned_to || "";
    note.value = ""; ui.say(noteErr, "");

    const updates = c.updates || [];
    $("#dialog-notes").innerHTML = updates.length
      ? updates.map(u => `<li>${ui.esc(u.message)}<small>${ui.esc(ui.fmtDateTime(u.created_at))}${u.author ? " \u00b7 " + ui.esc(u.author) : ""}</small></li>`).join("")
      : '<li class="muted">No updates sent yet.</li>';
  }

  $("#note-cancel").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });   // click on the backdrop

  saveBtn.addEventListener("click", async () => {
    const changes = {};
    const newStatus = statusSel.value;
    const newAssignee = assignee.value.trim();
    if (newStatus !== ui.statusMeta(current.status).value) changes.status = newStatus;
    if (newAssignee !== (current.assigned_to || "")) changes.assigned_to = newAssignee;
    if (note.value.trim()) changes.note = note.value.trim();

    if (!Object.keys(changes).length) { ui.say(noteErr, "Change the status, the assignee or write an update first."); return; }

    ui.say(noteErr, ""); ui.busy(saveBtn, true, "Saving...");
    try {
      await api("PATCH", config.ENDPOINTS.adminComplaint(current.id), { body: changes });
      dialog.close();
      ui.toast("Saved. The student has been notified.");
      load();
    } catch (err) { ui.say(noteErr, err.message); }
    ui.busy(saveBtn, false);
  });

  /* ---------- go ---------- */
  ui.tableMessage(tbody, 6, "Loading...");
  load().then(() => {
    const id = ui.param("open");               // arrives from a notification or the dashboard
    if (id) { history.replaceState(null, "", location.pathname); openComplaint(id); }
  });

  document.addEventListener("scmrs:notifications", e => { if (e.detail.increased) load(); });
});
