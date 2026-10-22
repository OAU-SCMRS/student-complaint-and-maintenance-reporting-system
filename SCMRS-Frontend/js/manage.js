// Sample data for now. The backend person will replace this with real data from the server.
const workers = ["Ahmed", "Musa", "Tunde"];
const statuses = ["Pending", "In Progress", "Resolved"];

const complaints = [
  { id: "FX-018", problem: "Faulty light", location: "Block A", status: "In Progress", assigned: "Ahmed", notes: [] },
  { id: "FX-017", problem: "Broken tap", location: "Hostel B", status: "Pending", assigned: "", notes: [] },
  { id: "FX-016", problem: "Damaged chair", location: "Lecture Hall 2", status: "Resolved", assigned: "Musa", notes: [] },
  { id: "FX-015", problem: "Water leakage", location: "Hostel C", status: "In Progress", assigned: "Ahmed", notes: [] },
  { id: "FX-014", problem: "Electrical fault", location: "Block C", status: "Pending", assigned: "", notes: [] },
  { id: "FX-013", problem: "Broken window", location: "Hostel A", status: "Resolved", assigned: "Musa", notes: [] },
  { id: "FX-012", problem: "Blocked drainage", location: "Behind SUB", status: "Pending", assigned: "", notes: [] },
  { id: "FX-011", problem: "Faulty fan", location: "Lecture Hall 1", status: "In Progress", assigned: "Tunde", notes: [] }
];

const tableBody = document.getElementById("table-body");
const search = document.getElementById("search");
const filter = document.getElementById("filter");
const empty = document.getElementById("empty");
const dialog = document.getElementById("dialog");
const noteText = document.getElementById("note-text");
const noteError = document.getElementById("note-error");
let currentId = null;

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

function toast(message) {
  const box = document.getElementById("toast");
  box.textContent = message;
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 2600);
}

function render() {
  const text = search.value.trim().toLowerCase();
  const shown = complaints.filter((c) => {
    const matchesText = (c.id + " " + c.problem + " " + c.location).toLowerCase().includes(text);
    const matchesStatus = !filter.value || c.status === filter.value;
    return matchesText && matchesStatus;
  });

  tableBody.innerHTML = shown.map((c) => `
    <tr>
      <td>${c.id}</td>
      <td>${c.problem}</td>
      <td>${c.location}</td>
      <td>
        <select data-id="${c.id}" data-field="status" aria-label="Status of ${c.id}">
          ${statuses.map((s) => `<option ${s === c.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td>
        <select data-id="${c.id}" data-field="assigned" aria-label="Assign ${c.id}">
          <option value="">Unassigned</option>
          ${workers.map((w) => `<option ${w === c.assigned ? "selected" : ""}>${w}</option>`).join("")}
        </select>
      </td>
      <td><button class="btn-small" data-note="${c.id}">Add update${c.notes.length ? " (" + c.notes.length + ")" : ""}</button></td>
    </tr>`).join("");

  empty.hidden = shown.length > 0;
}

// Status and worker dropdowns
tableBody.addEventListener("change", (e) => {
  const id = e.target.dataset.id;
  const field = e.target.dataset.field;
  if (!id) return;
  const c = complaints.find((item) => item.id === id);

  if (field === "status") {
    c.status = e.target.value;
    toast(id + " is now " + c.status);
  } else {
    c.assigned = e.target.value;
    if (c.assigned && c.status === "Pending") c.status = "In Progress"; // assigning starts the work
    toast(c.assigned ? id + " assigned to " + c.assigned : id + " is now unassigned");
  }
  // TODO: the backend person will save this change here (fetch)
  render();
});

// "Add update" button opens the dialog
tableBody.addEventListener("click", (e) => {
  const id = e.target.dataset.note;
  if (!id) return;
  currentId = id;
  const c = complaints.find((item) => item.id === id);
  document.getElementById("dialog-title").textContent = "Update " + c.id + ": " + c.problem;
  document.getElementById("dialog-notes").innerHTML = c.notes
    .map((n) => `<li>${esc(n.text)}<small>${n.date}</small></li>`).join("");
  noteText.value = "";
  noteError.textContent = "";
  dialog.showModal();
});

document.getElementById("note-cancel").addEventListener("click", () => dialog.close());

document.getElementById("note-save").addEventListener("click", () => {
  const text = noteText.value.trim();
  if (text.length < 3) {
    noteError.textContent = "Write an update before saving.";
    return;
  }
  const c = complaints.find((item) => item.id === currentId);
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  c.notes.push({ text: text, date: date });
  // TODO: the backend person will save this update here (fetch)
  dialog.close();
  render();
  const q = new URLSearchParams(window.location.search).get("q");
if (q) search.value = q;
  toast("Update saved. The student will see it on their complaint.");
});

search.addEventListener("input", render);
filter.addEventListener("change", render);

// Mobile sidebar
document.getElementById("menu-btn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

render();