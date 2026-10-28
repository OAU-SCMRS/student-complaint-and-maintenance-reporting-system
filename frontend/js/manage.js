const api = window.FixOAU;
const workers = ['Ahmed', 'Musa', 'Tunde'];
const statuses = ['Pending', 'In Progress', 'Resolved'];

let complaints = [];

const tableBody = document.getElementById('table-body');
const search = document.getElementById('search');
const filter = document.getElementById('filter');
const empty = document.getElementById('empty');
const dialog = document.getElementById('dialog');
const noteText = document.getElementById('note-text');
const noteError = document.getElementById('note-error');
let currentId = null;

function badgeClass(status) {
  if (status === 'Resolved') return 'badge-resolved';
  if (status === 'In Progress') return 'badge-progress';
  return 'badge-pending';
}

function esc(text) {
  const div = document.createElement('div');
  div.textContent = text === undefined || text === null ? '' : text;
  return div.innerHTML;
}

function toast(message) {
  const box = document.getElementById('toast');
  if (!box) return;
  box.textContent = message;
  box.classList.add('show');
  setTimeout(function() { box.classList.remove('show'); }, 2600);
}

function loadComplaints() {
  if (api && typeof api.getAllComplaints === 'function') {
    complaints = api.getAllComplaints();
  } else {
    complaints = window.complaints || [];
  }
}

function render() {
  loadComplaints();
  const text = search && search.value ? search.value.trim().toLowerCase() : '';
  const shown = complaints.filter(function(c) {
    const matchesText = (c.id + ' ' + (c.problem || '') + ' ' + (c.location || '')).toLowerCase().indexOf(text) !== -1;
    const matchesStatus = !filter || !filter.value || c.status === filter.value;
    return matchesText && matchesStatus;
  });

  if (!tableBody) return;
  var rowsHtml = '';
  for (var i = 0; i < shown.length; i++) {
    var c = shown[i];
    var statusOptions = '';
    for (var s = 0; s < statuses.length; s++) {
      var st = statuses[s];
      statusOptions += '<option ' + (st === c.status ? 'selected' : '') + '>' + esc(st) + '</option>';
    }
    var workerOptions = '<option value=\"\">Unassigned</option>';
    for (var w = 0; w < workers.length; w++) {
      var wk = workers[w];
      workerOptions += '<option ' + (wk === c.assigned ? 'selected' : '') + '>' + esc(wk) + '</option>';
    }
    var notesCount = c.notes && c.notes.length ? ' (' + c.notes.length + ')' : '';
    rowsHtml += '<tr>' +
      '<td>' + esc(c.id) + '</td>' +
      '<td>' + esc(c.problem) + '</td>' +
      '<td>' + esc(c.location) + '</td>' +
      '<td><select data-id=\"' + esc(c.id) + '\" data-field=\"status\" aria-label=\"Status of ' + esc(c.id) + '\">' + statusOptions + '</select></td>' +
      '<td><select data-id=\"' + esc(c.id) + '\" data-field=\"assigned\" aria-label=\"Assign ' + esc(c.id) + '\">' + workerOptions + '</select></td>' +
      '<td><button class=\"btn-small\" data-note=\"' + esc(c.id) + '\">Add update' + notesCount + '</button></td>' +
      '</tr>';
  }
  tableBody.innerHTML = rowsHtml;

  if (empty) empty.hidden = shown.length > 0;
}

if (tableBody) {
  tableBody.addEventListener('change', function(e) {
    var target = e.target;
    var id = target.getAttribute('data-id');
    var field = target.getAttribute('data-field');
    if (!id) return;
    loadComplaints();
    var c = null;
    for (var i = 0; i < complaints.length; i++) {
      if (complaints[i].id === id) { c = complaints[i]; break; }
    }

    if (field === 'status') {
      if (c) {
        c.status = target.value;
        if (api && typeof api.updateComplaintStatus === 'function') {
          api.updateComplaintStatus(id, target.value);
        }
        toast(id + ' is now ' + c.status);
      }
    } else if (field === 'assigned') {
      if (c) {
        c.assigned = target.value;
        if (c.assigned && c.status === 'Pending') {
          c.status = 'In Progress';
          if (api && typeof api.updateComplaintStatus === 'function') {
            api.updateComplaintStatus(id, 'In Progress');
          }
        }
        if (api && typeof api.assignComplaint === 'function') {
          api.assignComplaint(id, target.value);
        }
        toast(c.assigned ? id + ' assigned to ' + c.assigned : id + ' is now unassigned');
      }
    }
    render();
  });

  tableBody.addEventListener('click', function(e) {
    var btn = e.target.closest('button[data-note]');
    if (!btn) return;
    var id = btn.getAttribute('data-note');
    if (!id) return;
    currentId = id;
    loadComplaints();
    var c = null;
    for (var i = 0; i < complaints.length; i++) {
      if (complaints[i].id === id) { c = complaints[i]; break; }
    }
    var dialogTitle = document.getElementById('dialog-title');
    var dialogNotes = document.getElementById('dialog-notes');
    if (dialogTitle) dialogTitle.textContent = 'Update ' + c.id + ': ' + c.problem;
    if (dialogNotes) {
      var notes = c.notes || c.updates || [];
      var notesHtml = '';
      if (notes.length > 0) {
        for (var n = 0; n < notes.length; n++) {
          var note = notes[n];
          var noteTextStr = typeof note === 'string' ? note : (note.text || note.note || '');
          notesHtml += '<li>' + esc(noteTextStr) + '<small>' + esc(note.date || '') + '</small></li>';
        }
      }
      dialogNotes.innerHTML = notesHtml;
    }
    if (noteText) noteText.value = '';
    if (noteError) noteError.textContent = '';
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else if (dialog) {
      dialog.setAttribute('open', '');
    }
  });
}

var noteCancel = document.getElementById('note-cancel');
if (noteCancel && dialog) {
  noteCancel.addEventListener('click', function() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  });
}

var noteSave = document.getElementById('note-save');
if (noteSave) {
  noteSave.addEventListener('click', function() {
    var text = noteText ? noteText.value.trim() : '';
    if (text.length < 3) {
      if (noteError) noteError.textContent = 'Write an update before saving.';
      return;
    }
    loadComplaints();
    var c = null;
    for (var i = 0; i < complaints.length; i++) {
      if (complaints[i].id === currentId) { c = complaints[i]; break; }
    }
    var date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (!c.notes) c.notes = [];
    c.notes.push({ text: text, date: date });
    if (api && typeof api.addComplaintUpdate === 'function') {
      api.addComplaintUpdate(currentId, { text: text, date: date });
    }
    if (dialog) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
    render();
    var q = new URLSearchParams(window.location.search).get('q');
    if (q && search) search.value = q;
    toast('Update saved. The student will see it on their complaint.');
  });
}

if (search) search.addEventListener('input', render);
if (filter) filter.addEventListener('change', render);

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
    
    function openSidebar() {
      sidebar.classList.add('open');
      overlay.classList.add('active');
      document.body.classList.add('sidebar-open');
      menuBtn.setAttribute('aria-expanded', 'true');
    }
    
    function closeSidebar() {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
      document.body.classList.remove('sidebar-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
    
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
    
    overlay.addEventListener('click', closeSidebar);
    
    var navLinks = sidebar.querySelectorAll('.side-nav a, .logout');
    for (var i = 0; i < navLinks.length; i++) {
      navLinks[i].addEventListener('click', function() {
        if (window.innerWidth <= 800) {
          closeSidebar();
        }
      });
    }
    
    window.addEventListener('resize', function() {
      if (window.innerWidth > 800) {
        closeSidebar();
      }
    });
  }
}

render();