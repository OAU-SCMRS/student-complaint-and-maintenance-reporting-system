// FixOAU Platform Service
const api = window.FixOAU;
const user = api ? api.getCurrentUser() : { studentId: "group14", name: "Student" };

// Update topbar avatar and demo chip if elements exist
const avatarEl = document.getElementById("avatar");
if (avatarEl) avatarEl.textContent = (user.name || "S").charAt(0).toUpperCase();

const chipEl = document.getElementById("chip-user");
if (chipEl) chipEl.textContent = user.studentId || "group14";

// ==========================================
// 1. STUDENT PROBLEM REPORTING (report.html)
// ==========================================
const reportForm = document.getElementById("report-form");
if (reportForm) {
  const formPanel = document.getElementById("form-panel");
  const successPanel = document.getElementById("success");
  const complaintNumberEl = document.getElementById("complaint-number");
  const errorEl = document.getElementById("error");
  const photoInput = document.getElementById("photos");
  const dropzone = document.getElementById("dropzone");
  const thumbsContainer = document.getElementById("thumbs");

  let uploadedPhotos = []; // Base64 data URLs

  // Drag and drop events
  if (dropzone && photoInput) {
    ["dragenter", "dragover"].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add("over");
      });
    });
    ["dragleave", "drop"].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove("over");
      });
    });
    dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    });
    photoInput.addEventListener("change", (e) => {
      if (e.target.files) handleFiles(e.target.files);
    });
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList);
    files.forEach(file => {
      if (!file.type.startsWith("image/")) return;
      if (uploadedPhotos.length >= 5) {
        if (errorEl) errorEl.textContent = "You can upload a maximum of 5 photos.";
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedPhotos.push(e.target.result);
        renderThumbs();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderThumbs() {
    if (!thumbsContainer) return;
    thumbsContainer.innerHTML = uploadedPhotos.map((url, idx) => `
      <div class="thumb">
        <img src="${url}" alt="Preview thumbnail">
        <button type="button" data-index="${idx}" aria-label="Remove photo">×</button>
      </div>
    `).join("");

    thumbsContainer.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        uploadedPhotos.splice(idx, 1);
        renderThumbs();
      });
    });
  }

  // Submit report handler
  reportForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.textContent = "";

    const title = (document.getElementById("title").value || "").trim();
    const category = (document.getElementById("category").value || "").trim();
    const location = (document.getElementById("location").value || "").trim();
    const description = (document.getElementById("description").value || "").trim();

    // Validation
    if (!title) {
      if (errorEl) errorEl.textContent = "Please provide a problem title.";
      return;
    }
    if (!category) {
      if (errorEl) errorEl.textContent = "Please select a category.";
      return;
    }
    if (!location) {
      if (errorEl) errorEl.textContent = "Please specify a location.";
      return;
    }
    if (!description) {
      if (errorEl) errorEl.textContent = "Please enter a detailed description of the problem.";
      return;
    }

    const submitBtn = reportForm.querySelector("button[type='submit']");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting Report...";
    }

    try {
      const activeApi = window.FixOAU || api;
      if (!activeApi || typeof activeApi.submitComplaint !== "function") {
        throw new Error("FixOAU API service is not loaded.");
      }

      // Submit via FixOAU platform service (creates unique ID FX-XXX, saves to database & backend)
      const newComplaint = await activeApi.submitComplaint({
        title: title,
        category: category,
        location: location,
        description: description,
        photo: uploadedPhotos[0] || "",
        photos: uploadedPhotos
      });

      // Display success view with generated ID
      if (complaintNumberEl) complaintNumberEl.textContent = newComplaint.id;
      if (formPanel) formPanel.hidden = true;
      if (successPanel) successPanel.hidden = false;

      // Reset form
      reportForm.reset();
      uploadedPhotos = [];
      renderThumbs();
    } catch (err) {
      console.error("Submit report error:", err);
      if (errorEl) errorEl.textContent = "Error submitting report: " + (err.message || "Please check your details and try again.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Report";
      }
    }
  });
}

// ==========================================
// 2. ADMIN REPORTS & ANALYTICS (reports.html)
// ==========================================
const rTotalEl = document.getElementById("r-total");
if (rTotalEl) {
  const allComplaints = api ? api.getAllComplaints() : (window.complaints || []);
  const total = allComplaints.length;
  const count = (s) => allComplaints.filter((c) => c.status === s).length;
  const resolved = allComplaints.filter((c) => c.status === "Resolved");

  rTotalEl.textContent = total;
  const rRateEl = document.getElementById("r-rate");
  if (rRateEl) {
    rRateEl.textContent = total > 0 ? Math.round((count("Resolved") / total) * 100) + "%" : "0%";
  }

  const rTimeEl = document.getElementById("r-time");
  if (rTimeEl) {
    const avg = resolved.length > 0 ? (resolved.reduce((sum, c) => sum + (c.days || 3), 0) / resolved.length) : 2.5;
    rTimeEl.textContent = avg.toFixed(1) + " days";
  }

  const rUnassignedEl = document.getElementById("r-unassigned");
  if (rUnassignedEl) {
    rUnassignedEl.textContent = allComplaints.filter((c) => !c.assigned).length;
  }

  function drawBars(containerId, entries, fillClass) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = entries.map(([name, n]) => {
      const percent = total > 0 ? Math.round((n / total) * 100) : 0;
      const cls = typeof fillClass === "function" ? fillClass(name) : fillClass;
      return `
        <div class="bar-row">
          <div class="bar-label"><span>${name}</span><span>${n} (${percent}%)</span></div>
          <div class="bar-track"><div class="bar-fill ${cls}" style="width:${percent}%"></div></div>
        </div>`;
    }).join("");
  }

  drawBars("by-status", [
    ["Pending", count("Pending")],
    ["In Progress", count("In Progress")],
    ["Resolved", count("Resolved")]
  ], (name) => name === "Resolved" ? "f-resolved" : name === "Pending" ? "f-pending" : "f-progress");

  const categories = {};
  allComplaints.forEach((c) => { categories[c.category] = (categories[c.category] || 0) + 1; });
  drawBars("by-category", Object.entries(categories).sort((a, b) => b[1] - a[1]), "f-progress");

  const weeklyEl = document.getElementById("weekly");
  if (weeklyEl) {
    const weekly = [
      { label: "14 Sep", value: 3 },
      { label: "21 Sep", value: 5 },
      { label: "28 Sep", value: 4 },
      { label: "5 Oct", value: 6 },
      { label: "12 Oct", value: 8 },
      { label: "19 Oct", value: total }
    ];
    const max = Math.max(...weekly.map((w) => w.value), 1);
    weeklyEl.innerHTML = weekly.map((w) => `
      <div class="col">
        <span class="col-value">${w.value}</span>
        <div class="col-bar" style="height:${Math.round((w.value / max) * 150)}px"></div>
        <small>${w.label}</small>
      </div>`).join("");
  }
}

// UI bindings
if (api) {
  api.updateNavAndBell();
  api.wireAuthUI();
  api.wireMobileMenu();
} else {
  const menuBtn = document.getElementById("menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      const s = document.getElementById("sidebar");
      if (s) s.classList.toggle("open");
    });
  }
}
