// ============================================================
// adminregister.js  -  Admin sign-up logic for Fix OAU
// ============================================================

// ---------- CONFIG ----------
const CONFIG = {
    API_URL: "/api/admin/register",             // POST: creates the admin account
    CHECK_URL: "/api/admin/check-availability",  // GET ?adminId=..&email=.. (optional live duplicate check)
    LOGIN_URL: "adminlogin.html",                // where to go after successful registration
    TIMEOUT_MS: 10000,
    REDIRECT_DELAY_MS: 1500,                     // lets the user read the success message
    MIN_PASSWORD_LENGTH: 8,

    // DEMO MODE: bypasses the backend completely (nothing is stored).
    // !!! Set DEMO_MODE to false (and delete the demo credentials) before deploying !!!
    DEMO_MODE: true,
    DEMO_CREDENTIALS: {
        adminId: "demo-admin",
        email: "demo@fixoau.com",
        password: "Demo@1234",
    },
};

// ---------- ELEMENTS ----------
const form = document.getElementById("registerForm");
const adminIdInput = document.getElementById("adminId");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirmPassword");
const togglePassword = document.getElementById("togglePassword");
const toggleConfirm = document.getElementById("toggleConfirmPassword");
const errorMsg = document.getElementById("errorMsg");
const registerBtn = document.getElementById("registerBtn");

const allInputs = [adminIdInput, emailInput, passwordInput, confirmInput];

// ---------- HELPERS ----------
function showError(message, fields = allInputs) {
    errorMsg.classList.remove("success");
    errorMsg.classList.add("error");
    errorMsg.textContent = message;
    fields.forEach((f) => f.classList.add("invalid"));
}

function showSuccess(message) {
    errorMsg.classList.remove("error");
    errorMsg.classList.add("success");
    errorMsg.textContent = message;
}

function clearError() {
    errorMsg.textContent = "";
    errorMsg.classList.remove("error", "success");
    allInputs.forEach((f) => f.classList.remove("invalid"));
}

function setLoading(isLoading) {
    registerBtn.disabled = isLoading;
    registerBtn.textContent = isLoading ? "Creating account..." : "Register";
}

function goToLogin() {
    window.location.href = CONFIG.LOGIN_URL;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Returns an error message, or "" if the password is fine
function checkPasswordStrength(pw) {
    if (pw.length < CONFIG.MIN_PASSWORD_LENGTH)
        return `Password must be at least ${CONFIG.MIN_PASSWORD_LENGTH} characters.`;
    if (!/[a-z]/.test(pw)) return "Password must include a lowercase letter.";
    if (!/[A-Z]/.test(pw)) return "Password must include an uppercase letter.";
    if (!/[0-9]/.test(pw)) return "Password must include a number.";
    return "";
}

// ---------- SHOW / HIDE PASSWORD ----------
function setupToggle(input, icon) {
    icon.addEventListener("click", () => {
        const hidden = input.type === "password";
        input.type = hidden ? "text" : "password";
        icon.textContent = hidden ? "visibility_off" : "visibility";
    });
}
setupToggle(passwordInput, togglePassword);
setupToggle(confirmInput, toggleConfirm);

// Clear the error as soon as the user edits anything
allInputs.forEach((input) => input.addEventListener("input", clearError));

// ---------- FETCH WITH TIMEOUT ----------
async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// ---------- OPTIONAL LIVE DUPLICATE CHECK ----------
// Runs when the user leaves the Admin Id / Email field. Fails silently:
// the final check always happens on the server when registering.
async function checkAvailability(field) {
    const value = field.value.trim();
    const isEmail = field === emailInput;
    if (!value || (isEmail && !isValidEmail(value))) return;

    // Don't flag the demo values as "taken"
    const demoValue = CONFIG.DEMO_CREDENTIALS[isEmail ? "email" : "adminId"];
    if (CONFIG.DEMO_MODE && value.toLowerCase() === demoValue) return;

    const param = isEmail ? "email" : "adminId";
    try {
        const res = await request(`${CONFIG.CHECK_URL}?${param}=${encodeURIComponent(value)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.exists) {
            showError(
                isEmail
                    ? "An admin with this email already exists."
                    : "This Admin ID is already taken.",
                [field]
            );
        }
    } catch (_) { /* ignore - server will re-check on submit */ }
}
adminIdInput.addEventListener("blur", () => checkAvailability(adminIdInput));
emailInput.addEventListener("blur", () => checkAvailability(emailInput));

// ---------- BACKEND REGISTRATION ----------
// Expected backend contract:
//   POST /api/admin/register   body: { adminId, email, password }
//   200/201 -> { success: true, message? }
//   409     -> duplicate; optionally { field: "adminId" | "email", message }
//   400     -> validation error { message }
async function registerWithBackend(adminId, email, password) {
    try {
        const response = await request(CONFIG.API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ adminId, email, password }),
        });

        let data = {};
        try { data = await response.json(); } catch (_) { /* non-JSON response */ }

        if (response.ok && data.success !== false) {
            return { ok: true };
        }

        switch (response.status) {
            case 400:
                return { ok: false, message: data.message || "Please check your details and try again." };
            case 403:
                return { ok: false, message: data.message || "You are not allowed to create an admin account." };
            case 404:
                return { ok: false, message: "Registration service not found. Please contact support." };
            case 409: {
                const fields =
                    data.field === "adminId" ? [adminIdInput] :
                    data.field === "email" ? [emailInput] :
                    [adminIdInput, emailInput];
                return {
                    ok: false,
                    fields,
                    message: data.message || "An admin with this Admin ID or email already exists.",
                };
            }
            case 429:
                return { ok: false, message: "Too many attempts. Please wait a moment and try again." };
            default:
                if (response.status >= 500) {
                    return { ok: false, message: "Server error. Please try again later." };
                }
                return { ok: false, message: data.message || "Registration failed. Please try again." };
        }
    } catch (err) {
        if (err.name === "AbortError") {
            return { ok: false, message: "The server took too long to respond. Please try again." };
        }
        return { ok: false, message: "Cannot reach the server. Check your internet connection and try again." };
    }
}

// ---------- SUBMIT HANDLER ----------
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const adminId = adminIdInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    // --- Client-side validation ---
    if (!adminId || !email || !password || !confirm) {
        showError("Please fill in all fields.");
        return;
    }
    if (adminId.length < 3) {
        showError("Admin ID must be at least 3 characters.", [adminIdInput]);
        return;
    }
    if (!isValidEmail(email)) {
        showError("Please enter a valid email address.", [emailInput]);
        return;
    }
    const strengthError = checkPasswordStrength(password);
    if (strengthError) {
        showError(strengthError, [passwordInput]);
        return;
    }
    if (password !== confirm) {
        showError("Passwords do not match.", [passwordInput, confirmInput]);
        return;
    }

    // --- 1) Demo credentials: skip the backend, store nothing ---
    if (
        CONFIG.DEMO_MODE &&
        adminId === CONFIG.DEMO_CREDENTIALS.adminId &&
        email === CONFIG.DEMO_CREDENTIALS.email &&
        password === CONFIG.DEMO_CREDENTIALS.password
    ) {
        showSuccess("Demo account verified! Redirecting to login...");
        registerBtn.disabled = true;
        setTimeout(goToLogin, CONFIG.REDIRECT_DELAY_MS);
        return;
    }

    // --- 2) Real registration: backend checks duplicates and stores the admin ---
    setLoading(true);
    const result = await registerWithBackend(adminId, email, password);
    setLoading(false);

    if (!result.ok) {
        showError(result.message, result.fields);
        return;
    }

    showSuccess("Account created successfully! Redirecting to login...");
    registerBtn.disabled = true;
    setTimeout(goToLogin, CONFIG.REDIRECT_DELAY_MS);
});
