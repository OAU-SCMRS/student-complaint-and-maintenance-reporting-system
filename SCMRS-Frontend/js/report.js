/*
 * Student: Report a Problem.
 * Sends the complaint (text + photos) to the backend as multipart/form-data.
 * The backend stores it and surfaces it to the admin dashboard.
 */
SCMRS.page(() => {
  const { $, api, config, ui, meta } = SCMRS;
  const form = $("#report-form");
  const errorEl = $("#error");
  const submit = $('button[type="submit"]', form);
  const dropzone = $("#dropzone");
  const fileInput = $("#photos");
  const thumbs = $("#thumbs");
  const { max, maxMB } = config.PHOTOS;
  let files = [];

  $("#photo-hint").textContent = `Up to ${max} photos, ${maxMB} MB each`;

  /* categories + locations come from the backend, so adding one never needs a code change */
  meta().then(m => {
    const sel = $("#category");
    m.categories.forEach(c => sel.add(new Option(c, c)));
    const list = $("#locations");
    m.locations.forEach(l => list.appendChild(new Option(l, l)));
  });

  /* ---------- photos ---------- */
  function addFiles(list) {
    const problems = [];
    Array.from(list).forEach(file => {
      if (!file.type.startsWith("image/")) { problems.push(`${file.name} is not an image.`); return; }
      if (file.size > maxMB * 1024 * 1024) { problems.push(`${file.name} is larger than ${maxMB} MB.`); return; }
      if (files.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) return;
      if (files.length >= max) { problems.push(`You can attach up to ${max} photos.`); return; }
      files.push(file);
    });
    fileInput.value = "";                      // lets the same file be picked again later
    ui.say(errorEl, problems[0] || "");
    drawThumbs();
  }

  function drawThumbs() {
    thumbs.querySelectorAll("img").forEach(i => URL.revokeObjectURL(i.src));
    thumbs.innerHTML = "";
    files.forEach((file, i) => {
      const box = document.createElement("div");
      box.className = "thumb";
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      const x = document.createElement("button");
      x.type = "button"; x.textContent = "\u00d7"; x.setAttribute("aria-label", `Remove ${file.name}`);
      x.addEventListener("click", () => { files.splice(i, 1); drawThumbs(); });
      box.append(img, x);
      thumbs.appendChild(box);
    });
  }

  fileInput.addEventListener("change", () => addFiles(fileInput.files));
  ["dragenter", "dragover"].forEach(t => dropzone.addEventListener(t, e => { e.preventDefault(); dropzone.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => dropzone.addEventListener(t, e => { e.preventDefault(); dropzone.classList.remove("over"); }));
  dropzone.addEventListener("drop", e => addFiles(e.dataTransfer.files));

  /* ---------- submit ---------- */
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const v = {
      title: $("#title").value.trim(),
      category: $("#category").value,
      location: $("#location").value.trim(),
      description: $("#description").value.trim()
    };
    const problem =
      v.title.length < 3 ? ["#title", "Give the problem a short title."] :
      !v.category ? ["#category", "Choose a category."] :
      !v.location ? ["#location", "Tell us where the problem is."] :
      v.description.length < 10 ? ["#description", "Describe the problem in a little more detail (at least 10 characters)."] : null;
    if (problem) { ui.say(errorEl, problem[1]); $(problem[0]).focus(); return; }

    const data = new FormData();
    Object.entries(v).forEach(([k, val]) => data.append(k, val));
    files.forEach(f => data.append("photos", f));

    ui.say(errorEl, "");
    ui.busy(submit, true, "Submitting...");
    try {
      const res = await api("POST", config.ENDPOINTS.studentComplaints, { form: data });
      const c = (res && res.complaint) || {};
      $("#complaint-number").textContent = ui.refOf(c);
      $("#form-panel").hidden = true;
      $("#success").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      ui.say(errorEl, err.message);
      ui.busy(submit, false);
    }
  });
});
