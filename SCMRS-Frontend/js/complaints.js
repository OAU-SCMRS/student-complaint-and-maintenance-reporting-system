/*
 * Student: My Complaints. Status tabs + paging are handled by the backend.
 */
SCMRS.page(() => {
  const { $, $$, api, config, ui } = SCMRS;
  const tbody = $("#table-body");
  const empty = $("#empty");
  const pager = $("#pager");
  const tableWrap = $(".table-wrap");
  const state = { status: "All", page: 1, perPage: config.PAGE_SIZE };

  const eye = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

  function row(c) {
    return `<tr>
      <td><strong>${ui.esc(ui.refOf(c))}</strong></td>
      <td>${ui.esc(c.title)}</td>
      <td>${ui.esc(c.location)}</td>
      <td>${ui.badge(c.status)}</td>
      <td>${ui.esc(ui.fmtDate(c.created_at))}</td>
      <td><a class="view-btn" href="${config.ROUTES.student.complaintLink(c.id)}" aria-label="View ${ui.esc(ui.refOf(c))}">${eye}</a></td>
    </tr>`;
  }

  async function load() {
    try {
      const data = await api("GET", config.ENDPOINTS.studentComplaints, {
        query: { status: state.status === "All" ? "" : state.status, page: state.page, per_page: state.perPage }
      });
      const items = (data && data.items) || [];
      const total = (data && data.total) || 0;
      empty.hidden = items.length > 0;
      tableWrap.hidden = items.length === 0;
      tbody.innerHTML = items.map(row).join("");
      ui.renderPager(pager, { page: state.page, perPage: state.perPage, total }, p => { state.page = p; load(); });
    } catch (err) {
      tableWrap.hidden = false; empty.hidden = true; pager.hidden = true;
      ui.tableMessage(tbody, 6, err.message, load);
    }
  }

  $$(".tab").forEach(tab => tab.addEventListener("click", () => {
    $$(".tab").forEach(t => t.classList.toggle("active", t === tab));
    state.status = tab.dataset.status;
    state.page = 1;
    load();
  }));

  ui.tableMessage(tbody, 6, "Loading...");
  load();

  // the admin changed one of my complaints: show it without a refresh
  document.addEventListener("scmrs:notifications", e => { if (e.detail.increased) load(); });
});
