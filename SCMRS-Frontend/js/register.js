/*
 * Register (student + admin).  <body data-auth-role="student|admin">
 * Validates in the browser for quick feedback, then stores the account through the backend
 * (which must validate again). The login page later authenticates against that stored account.
 */
SCMRS.onReady(() => {
  const { $, auth, ui, config } = SCMRS;
  const role = document.body.dataset.authRole;
  if (!role || auth.redirectIfLoggedIn(role)) return;

  const form = $("#signupForm") || $("#registerForm");
  const msg = $("#errorMsg");
  const submit = $('button[type="submit"]', form);
  const idLabel = role === "admin" ? "Admin ID" : "Student ID";

  const f = {
    name: $("#fullName", form),
    id: $('input[name="studentId"], input[name="adminId"]', form),
    email: $("#email", form),
    password: $("#password", form),
    confirm: $("#confirmPassword", form),
    code: $("#accessCode", form)          // admin only
  };
  Object.values(f).forEach(i => i && i.addEventListener("input", () => ui.invalid(i, false)));

  function validate() {
    const rules = [
      [f.name, ui.check.name(f.name.value)],
      [f.id, ui.check.loginId(f.id.value, idLabel)],
      [f.email, ui.check.email(f.email.value)],
      [f.password, ui.check.password(f.password.value)],
      [f.confirm, f.confirm.value !== f.password.value ? "Passwords do not match." : ""]
    ];
    if (f.code) rules.push([f.code, f.code.value.trim() ? "" : "Enter the admin access code."]);
    let first = null;
    rules.forEach(([input, problem]) => {
      ui.invalid(input, !!problem);
      if (problem && !first) first = { input, problem };
    });
    return first;
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    ui.say(msg, "");
    const problem = validate();
    if (problem) { ui.say(msg, problem.problem); problem.input.focus(); return; }

    const payload = {
      login_id: f.id.value.trim(),
      full_name: f.name.value.trim(),
      email: f.email.value.trim(),
      password: f.password.value
    };
    if (f.code) payload.access_code = f.code.value.trim();

    ui.busy(submit, true, "Creating account...");
    try {
      await auth.register(role, payload);
      window.location.href = `${config.ROUTES[role].login}?registered=1`;
    } catch (err) {
      ui.say(msg, err.message);
      ui.busy(submit, false);
    }
  });
});
