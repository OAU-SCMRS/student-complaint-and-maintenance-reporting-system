/*
 * Login (student + admin).  <body data-auth-role="student|admin">
 * Sends the credentials to the backend; on success goes straight to that role's dashboard.
 */
SCMRS.onReady(() => {
  const { $, auth, ui, config } = SCMRS;
  const role = document.body.dataset.authRole;
  if (!role || auth.redirectIfLoggedIn(role)) return;

  const form = $("#loginForm");
  const idInput = $('input[name="studentId"], input[name="adminId"]', form);
  const pwInput = $("#password", form);
  const msg = $("#errorMsg");
  const submit = $('button[type="submit"]', form);

  // Notices passed from other pages (after registering, or when a session ran out)
  if (ui.param("registered")) ui.say(msg, "Account created. Log in to continue.", "ok");
  else if (ui.param("expired")) ui.say(msg, "Your session has expired. Please log in again.");

  [idInput, pwInput].forEach(i => i.addEventListener("input", () => ui.invalid(i, false)));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const loginId = idInput.value.trim();
    const password = pwInput.value;

    ui.invalid(idInput, !loginId);
    ui.invalid(pwInput, !password);
    if (!loginId || !password) { ui.say(msg, `Enter your ${role === "admin" ? "admin" : "student"} ID and password.`); return; }

    ui.say(msg, "");
    ui.busy(submit, true, "Logging in...");
    try {
      await auth.login(role, loginId, password);
      window.location.href = config.ROUTES[role].home;
    } catch (err) {
      ui.say(msg, err.status === 401 ? "Incorrect ID or password." : err.message);
      ui.invalid(pwInput, err.status === 401);
      pwInput.value = "";
      pwInput.focus();
      ui.busy(submit, false);
    }
  });
});
