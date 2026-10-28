const $ = (id) => document.getElementById(id);
const api = window.FixOAU;

// Retrieve profile synced with user login credentials from database
let profile = api ? api.getCurrentUser() : {
  studentId: "group14",
  name: "Group 14 Demo Student",
  email: "group14@student.oauife.edu.ng",
  phone: "08012345678",
  fixed: "group14",
  role: "student"
};

// Fill the header card and the form from synced database credentials
function show() {
  if (api) profile = api.getCurrentUser();

  if ($("name")) $("name").value = profile.name || "";
  if ($("email")) $("email").value = profile.email || "";
  if ($("phone")) $("phone").value = profile.phone || "";
  if ($("fixed")) $("fixed").value = profile.fixed || profile.studentId || "group14";

  if ($("hdr-name")) $("hdr-name").textContent = profile.name || "Student";
  if ($("hdr-email")) $("hdr-email").textContent = profile.email || "";
  if ($("hdr-role")) $("hdr-role").textContent = profile.role === "admin" ? "Administrator" : "Student";

  const initial = (profile.name || "S").charAt(0).toUpperCase();
  if ($("hdr-avatar")) $("hdr-avatar").textContent = initial;
  if ($("avatar")) $("avatar").textContent = initial;

  const chipEl = $("chip-user");
  if (chipEl) chipEl.textContent = profile.studentId || "group14";
}

function toast(message) {
  if (api) {
    api.showToast(message);
  } else {
    const box = $("toast");
    if (!box) return;
    box.textContent = message;
    box.classList.add("show");
    setTimeout(() => box.classList.remove("show"), 2600);
  }
}

// Save personal information and sync to database / generic backend
const infoForm = $("info-form");
if (infoForm) {
  infoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("name").value.trim();
    const email = $("email").value.trim();
    const phone = $("phone").value.trim();
    const error = $("info-error");

    if (name.length < 3) {
      if (error) error.textContent = "Enter your full name.";
      return;
    }
    if (!email.includes("@") || !email.includes(".")) {
      if (error) error.textContent = "Enter a valid email address.";
      return;
    }
    if (phone && !/^[0-9+\s-]{7,15}$/.test(phone)) {
      if (error) error.textContent = "Enter a valid phone number, or leave it empty.";
      return;
    }

    if (error) error.textContent = "";

    // Sync to database and backend via FixOAU API
    if (api) {
      profile = await api.updateProfile({ name, email, phone });
    } else {
      profile = Object.assign(profile, { name, email, phone });
    }

    show();
    toast("Profile updated and synced with database");
  });
}

// Change password
const pwForm = $("pw-form");
if (pwForm) {
  pwForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const current = $("current").value;
    const next = $("new").value;
    const confirm = $("confirm").value;
    const error = $("pw-error");

    if (!current || !next || !confirm) {
      if (error) error.textContent = "Please fill in all three password boxes.";
      return;
    }
    if (next.length < 8) {
      if (error) error.textContent = "Your new password must be at least 8 characters.";
      return;
    }
    if (next === current) {
      if (error) error.textContent = "Your new password must be different from the current one.";
      return;
    }
    if (next !== confirm) {
      if (error) error.textContent = "The two new passwords do not match.";
      return;
    }

    if (error) error.textContent = "";

    if (api) {
      const res = await api.updatePassword(current, next);
      if (!res.success) {
        if (error) error.textContent = res.message || "Failed to update password.";
        return;
      }
    }

    pwForm.reset();
    toast("Password updated and synced with database");
  });
}

// Show / hide password buttons
document.querySelectorAll(".pw-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = $(btn.dataset.target);
    if (!input) return;
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    btn.textContent = hidden ? "Hide" : "Show";
  });
});

if (api) {
  api.updateNavAndBell();
  api.wireAuthUI();
  api.wireMobileMenu();
} else {
  const menuBtn = $("menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      const s = $("sidebar");
      if (s) s.classList.toggle("open");
    });
  }
}

show();
