/*
 * Student: one complaint. students/complaint-details.html?id=<complaint id>
 * Shows the report, its photos and the timeline of updates the admin has sent.
 */
SCMRS.page(async () => {
  const { $, api, config, ui } = SCMRS;
  const box = $("#detail");
  const id = ui.param("id");

  const fail = text => {
    box.innerHTML = `<p class="empty">${ui.esc(text)}</p>`;
  };
  if (!id) return fail("No complaint was selected. Go back to My Complaints and pick one.");

  box.innerHTML = '<p class="empty">Loading...</p>';
  let c;
  try {
    const res = await api("GET", config.ENDPOINTS.studentComplaint(id));
    c = res && res.complaint;
    if (!c) throw new Error("Complaint not found.");
  } catch (err) {
    return fail(err.status === 404 ? "We could not find that complaint." : err.message);
  }

  document.title = `${ui.refOf(c)} | FixOAU`;

  const photos = (c.photos || []).map((url, i) =>
    `<div class="photo-box"><a href="${ui.esc(url)}" target="_blank" rel="noopener"><img src="${ui.esc(url)}" alt="Photo ${i + 1} of the problem"></a></div>`).join("");
  const noPhoto = `<div class="photo-box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>No photo attached</div>`;

  // oldest first: the CSS highlights the last entry as the current state
  const updates = [{ message: "Complaint submitted", created_at: c.created_at }].concat(c.updates || []);
  const timeline = updates.map(u => `<li>
      <strong>${ui.esc(u.message)}</strong>
      <small>${ui.esc(ui.fmtDateTime(u.created_at))}${u.status ? " \u00b7 " + ui.esc(u.status) : ""}</small>
    </li>`).join("");

  box.innerHTML = `
    <div class="detail-head"><h2>${ui.esc(ui.refOf(c))}</h2>${ui.badge(c.status)}</div>
    <div class="detail-grid">
      <div class="photo-col">${photos || noPhoto}</div>
      <dl class="facts">
        <div><dt>Problem</dt><dd>${ui.esc(c.title)}</dd></div>
        <div><dt>Category</dt><dd>${ui.esc(c.category)}</dd></div>
        <div><dt>Location</dt><dd>${ui.esc(c.location)}</dd></div>
        <div><dt>Submitted</dt><dd>${ui.esc(ui.fmtDate(c.created_at))}</dd></div>
        <div><dt>Assigned to</dt><dd>${c.assigned_to ? ui.esc(c.assigned_to) : '<span class="muted">Not assigned yet</span>'}</dd></div>
        <div><dt>Description</dt><dd class="desc">${ui.esc(c.description)}</dd></div>
      </dl>
    </div>
    <h3 class="updates-title">Updates</h3>
    <ul class="timeline">${timeline}</ul>`;

  // a new update arrived while this page is open: redraw it
  document.addEventListener("scmrs:notifications", e => { if (e.detail.increased) location.reload(); });
});
