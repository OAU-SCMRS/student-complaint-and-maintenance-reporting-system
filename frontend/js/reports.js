/*
 * Admin: Reports & Analytics. Every number and bar comes from GET /admin/reports.
 */
SCMRS.page(() => {
  const { $, $$, api, config, ui } = SCMRS;

  const formatters = {
    rate: v => `${Math.round(Number(v) || 0)}%`,
    time: v => {
      const h = Number(v);
      if (!isFinite(h) || h <= 0) return "\u2013";
      return h < 48 ? `${Math.round(h * 10) / 10} hrs` : `${Math.round((h / 24) * 10) / 10} days`;
    }
  };

  function bars(target, rows, fillFor) {
    const total = rows.reduce((n, r) => n + (Number(r.count) || 0), 0);
    target.innerHTML = rows.length ? rows.map(r => {
      const count = Number(r.count) || 0;
      const pct = total ? Math.round((count / total) * 100) : 0;
      return `<div class="bar-row">
        <div class="bar-label"><span>${ui.esc(r.label)}</span><strong>${count}</strong></div>
        <div class="bar-track"><div class="bar-fill ${fillFor(r)}" style="width:${pct}%"></div></div>
      </div>`;
    }).join("") : '<p class="empty">No data yet.</p>';
  }

  function weekly(target, rows) {
    const max = Math.max(0, ...rows.map(r => Number(r.count) || 0));
    target.innerHTML = rows.length ? rows.map(r => {
      const count = Number(r.count) || 0;
      const h = max ? Math.round((count / max) * 70) : 0;
      const label = r.label || (r.week_start ? ui.fmtDate(r.week_start) : "");
      return `<div class="col"><span class="col-value">${count}</span><div class="col-bar" style="height:${h}%"></div><small>${ui.esc(label)}</small></div>`;
    }).join("") : '<p class="empty">No data yet.</p>';
  }

  async function load() {
    try {
      const d = await api("GET", config.ENDPOINTS.adminReports);
      $$("[data-metric]").forEach(el => {
        const key = el.dataset.metric;
        const raw = key === "rate" ? d.resolution_rate : key === "time" ? d.avg_resolution_hours : d[key];
        el.textContent = formatters[key] ? formatters[key](raw) : (raw ?? 0);
      });
      bars($("#by-status"), d.by_status || [], r => ui.statusMeta(r.label).fill);
      bars($("#by-category"), d.by_category || [], () => "f-category");
      weekly($("#weekly"), d.weekly || []);
    } catch (err) { ui.toast(err.message, "error"); }
  }

  load();
  document.addEventListener("scmrs:notifications", e => { if (e.detail.increased) load(); });
});
