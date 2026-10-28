/*
 * Notifications (student + admin).
 * Student: "your complaint is now Resolved", new admin updates.
 * Admin:   new complaints, unassigned, overdue.
 * The list is read from the backend; reading one marks it read there too.
 */
SCMRS.page(({ role }) => {
  const { $, $$, api, config, ui } = SCMRS;
  const list = $("#list");
  const empty = $("#empty");
  const markAll = $("#mark-all");
  const state = { filter: "all", page: 1, items: [], total: 0 };

  const more = document.createElement("button");
  more.type = "button"; more.className = "mark-all"; more.textContent = "Load more"; more.hidden = true;
  list.after(more);

  function item(n) {
    const tag = config.NOTIF_TAGS[n.type];
    const target = n.complaint_id ? config.ROUTES[role].complaintLink(n.complaint_id) : "";
    return `<div class="notif ${n.is_read ? "" : "unread"}" data-id="${ui.esc(n.id)}">
      <span class="notif-dot" aria-hidden="true"></span>
      <div class="notif-text">
        ${tag ? `<span class="notif-tag ${tag.cls}">${ui.esc(tag.label)}</span>` : ""}${ui.esc(n.message)}
        <small>${ui.esc(ui.timeAgo(n.created_at))}</small>
      </div>
      ${target ? `<a class="notif-go" href="${target}">View</a>` : ""}
    </div>`;
  }

  function draw() {
    list.innerHTML = state.items.map(item).join("");
    empty.hidden = state.items.length > 0;
    empty.textContent = state.filter === "unread" ? "No unread notifications." : "You are all caught up.";
    more.hidden = state.items.length >= state.total;
  }

  async function load(append) {
    try {
      const data = await api("GET", config.ENDPOINTS.notifications, {
        query: { filter: state.filter, page: state.page, per_page: config.NOTIF_PAGE_SIZE }
      });
      state.total = (data && data.total) || 0;
      state.items = (append ? state.items : []).concat((data && data.items) || []);
      draw();
    } catch (err) {
      list.innerHTML = ""; empty.hidden = false; empty.textContent = err.message;
    }
  }

  async function markRead(id) {
    const n = state.items.find(x => String(x.id) === String(id));
    if (!n || n.is_read) return;
    n.is_read = true;
    try { await api("POST", config.ENDPOINTS.markRead(id), { keepalive: true }); }
    catch (err) { n.is_read = false; ui.toast(err.message, "error"); }
    SCMRS.notifications.refresh();
  }

  list.addEventListener("click", async e => {
    const row = e.target.closest(".notif");
    if (!row) return;
    const link = e.target.closest(".notif-go");
    if (link) { e.preventDefault(); await markRead(row.dataset.id); window.location.href = link.getAttribute("href"); return; }
    await markRead(row.dataset.id);
    if (state.filter === "all") draw(); else load();
  });

  markAll.addEventListener("click", async () => {
    ui.busy(markAll, true);
    try {
      await api("POST", config.ENDPOINTS.markAllRead);
      state.page = 1; await load();
      SCMRS.notifications.refresh();
    } catch (err) { ui.toast(err.message, "error"); }
    ui.busy(markAll, false);
  });

  more.addEventListener("click", () => { state.page += 1; load(true); });

  $$(".tab").forEach(tab => tab.addEventListener("click", () => {
    $$(".tab").forEach(t => t.classList.toggle("active", t === tab));
    state.filter = tab.dataset.tab.toLowerCase();
    state.page = 1;
    load();
  }));

  // a new notification arrived while the page is open
  document.addEventListener("scmrs:notifications", e => { if (e.detail.increased) { state.page = 1; load(); } });

  load();
});
