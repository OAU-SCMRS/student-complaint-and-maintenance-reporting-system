const api = window.FixOAU;
let studentName = 'Student';
if (api) {
  const user = api.getCurrentUser();
  studentName = user.name || user.studentId || 'Student';
}
const avatarEl = document.getElementById('avatar');
if (avatarEl) avatarEl.textContent = studentName.charAt(0).toUpperCase();

function badgeClass(status) {
  if (api && api.badgeClass) return api.badgeClass(status);
  if (status === 'Resolved') return 'badge-resolved';
  if (status === 'In Progress') return 'badge-progress';
  return 'badge-pending';
}

function esc(text) {
  const div = document.createElement('div');
  div.textContent = text === undefined || text === null ? '' : text;
  return div.innerHTML;
}

const id = new URLSearchParams(window.location.search).get('id');
let c = null;
if (api) {
  const user = api.getCurrentUser();
  const complaints = api.getComplaints(user.studentId);
  c = complaints.find((item) => item.id === id);
} else {
  if (typeof complaints !== 'undefined') {
    c = complaints.find((item) => item.id === id);
  }
}

const detail = document.getElementById('detail');

if (!c) {
  if (detail) {
    detail.innerHTML = '<h2>Complaint not found</h2><p style=\"color:var(--muted);margin:8px 0 18px\">We could not find that complaint.</p><a class=\"btn\" href=\"complaints.html\">Back to My Complaints</a>';
  }
} else {
  let photoHtml = '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z\"/></svg><span>No photo added</span>';
  if (c.photo) {
    photoHtml = '<img src=\"' + esc(c.photo) + '\" alt=\"Photo of the problem\">';
  } else if (c.photos && c.photos.length > 0) {
    photoHtml = '<img src=\"' + esc(c.photos[0]) + '\" alt=\"Photo of the problem\">';
  }

  const updates = c.updates || c.notes || [];
  let updatesHtml = '<li><small></small><strong>No updates yet.</strong></li>';
  if (updates.length > 0) {
    updatesHtml = updates.map(function(u) { 
      return '<li><small>' + esc(u.date || '') + '</small><strong>' + esc(u.text || u.note || '') + '</strong></li>'; 
    }).join('');
  }

  detail.innerHTML = 
    '<div class=\"detail-head\">' +
      '<h2>' + esc(c.id) + '</h2>' +
      '<span class=\"badge ' + badgeClass(c.status) + '\">' + esc(c.status) + '</span>' +
    '</div>' +
    '<div class=\"detail-grid\">' +
      '<div class=\"photo-box\">' + photoHtml + '</div>' +
      '<dl class=\"facts\">' +
        '<div><dt>Problem</dt><dd>' + esc(c.problem) + '</dd></div>' +
        '<div><dt>Category</dt><dd>' + esc(c.category || '-') + '</dd></div>' +
        '<div><dt>Location</dt><dd>' + esc(c.location) + '</dd></div>' +
        '<div><dt>Date Reported</dt><dd>' + esc(c.date) + '</dd></div>' +
        '<div><dt>Description</dt><dd class=\"desc\">' + esc(c.description || '-') + '</dd></div>' +
      '</dl>' +
    '</div>' +
    '<h3 class=\"updates-title\">Updates</h3>' +
    '<ul class=\"timeline\">' + updatesHtml + '</ul>';

  document.title = c.id + ' | FixOAU';
}

// Mobile sidebar
const menuBtn = document.getElementById('menu-btn');
if (menuBtn) {
  var sidebar = document.getElementById('sidebar');
  if (sidebar) {
    var overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }
    
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
      document.body.classList.toggle('sidebar-open');
    });
    
    overlay.addEventListener('click', function() {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
      document.body.classList.remove('sidebar-open');
    });
  }
}

if (api) {
  if (typeof api.updateNavAndBell === 'function') api.updateNavAndBell();
  if (typeof api.wireAuthUI === 'function') api.wireAuthUI();
  if (typeof api.wireMobileMenu === 'function') api.wireMobileMenu();
}