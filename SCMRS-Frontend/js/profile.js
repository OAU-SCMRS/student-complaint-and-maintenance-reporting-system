/*
 * Profile + change password (student + admin).
 */
SCMRS.page(({ role }) => {
  const { $, api, config, session, ui } = SCMRS;
  const infoForm = $("#info-form");
  const pwForm = $("#pw-form");
  const infoErr = $("#info-error");
  const pwErr = $("#pw-error");

  function show(user) {
    $("#name").value = user.full_name || "";
    $("#email").value = user.email || "";
    $("#phone").value = user.phone || "";
    $("#fixed").value = role === "admin" ? "Administrator" : (user.login_id || "");
    $("#hdr-avatar").textContent = ui.initials(user.full_name || user.login_id);
    $("#hdr-name").textContent = user.full_name || user.login_id || "";
    $("#hdr-email").textContent = user.email || "";
    $("#hdr-role").textContent = role === "admin" ? "Administrator" : "Student";
    SCMRS.paintUser(user);
  }

  async function load() {
    try {
      const res = await api("GET", config.ENDPOINTS.me);
      const user = res.user; user.role = role;
      session.setUser(user);
      show(user);
    } catch (err) { ui.say(infoErr, err.message); }
  }

  infoForm.addEventListener("submit", async e => {
    e.preventDefault();
    const body = { full_name: $("#name").value.trim(), email: $("#email").value.trim(), phone: $("#phone").value.trim() };
    const problem = ui.check.name(body.full_name) || ui.check.email(body.email) || ui.check.phone(body.phone);
    if (problem) { ui.say(infoErr, problem); return; }

    const btn = $('button[type="submit"]', infoForm);
    ui.say(infoErr, ""); ui.busy(btn, true, "Saving...");
    try {
      const res = await api("PATCH", config.ENDPOINTS.me, { body });
      const user = res.user; user.role = role;
      session.setUser(user); show(user);
      ui.toast("Profile updated.");
    } catch (err) { ui.say(infoErr, err.message); }
    ui.busy(btn, false);
  });

  pwForm.addEventListener("submit", async e => {
    e.preventDefault();
    const current = $("#current").value, next = $("#new").value, confirm = $("#confirm").value;
    const problem =
      !current ? "Enter your current password." :
      ui.check.password(next) ||
      (next === current ? "Choose a password different from the current one." : "") ||
      (next !== confirm ? "The new passwords do not match." : "");
    if (problem) { ui.say(pwErr, problem); return; }

    const btn = $('button[type="submit"]', pwForm);
    ui.say(pwErr, ""); ui.busy(btn, true, "Updating...");
    try {
      await api("POST", config.ENDPOINTS.changePassword, { body: { current_password: current, new_password: next }, auth: false });
      pwForm.reset();
      ui.toast("Password updated.");
    } catch (err) { ui.say(pwErr, err.message); }
    ui.busy(btn, false);
  });

  load();
});
