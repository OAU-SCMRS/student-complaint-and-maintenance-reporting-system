// ============================================================
// adminlogin.js  -  Admin login logic for Fix OAU
// ============================================================

// ---------- CONFIG ----------
const CONFIG = {
    API_URL: "/api/admin/login",          // your backend login endpoint
    DASHBOARD_URL: "admin.html", // where to go after a successful login
    TIMEOUT_MS: 10000,                    // give up on the server after 10s

    // DEMO MODE: lets you in without touching the backend.
    // !!! Set DEMO_MODE to false (and delete the demo credentials) before deploying !!!
    DEMO_MODE: true,
    DEMO_CREDENTIALS: { adminId: "demo-admin", password: "Demo@1234" },
};

// ---------- ELEMENTS ----------
const form = document.getElementById("loginForm");
const adminIdInput = document.getElementById("adminId");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("errorMsg");
const toggleIcon = document.getElementById("visible");
const loginBtn = form.querySelector("button[type='submit']");

// ---------- HELPERS ----------
function showError(message) {
    errorMsg.textContent = message;
    adminIdInput.classList.add("invalid");
    passwordInput.classList.add("invalid");
}

function clearError() {
    errorMsg.textContent = "";
    adminIdInput.classList.remove("invalid");
    passwordInput.classList.remove("invalid");
}

function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    loginBtn.textContent = isLoading ? "Verifying..." : "Login";
}

function saveSession({ token, admin, isDemo }) {
    sessionStorage.setItem("adminSession", JSON.stringify({
        token: token || null,
        admin: admin || null,
        isDemo: !!isDemo,
        loggedInAt: Date.now(),
    }));
}

function goToDashboard() {
    window.location.href = CONFIG.DASHBOARD_URL;
}

// ---------- SHOW / HIDE PASSWORD ----------
toggleIcon.addEventListener("click", () => {
    const hidden = passwordInput.type === "password";
    passwordInput.type = hidden ? "text" : "password";
    toggleIcon.textContent = hidden ? "visibility_off" : "visibility";
});

// Clear the error as soon as the user starts typing again
[adminIdInput, passwordInput].forEach((input) =>
    input.addEventListener("input", clearError)
);

// ---------- BACKEND VERIFICATION ----------
async function verifyWithBackend(adminId, password) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ adminId, password }),
            signal: controller.signal,
        });

        // The server should reply with JSON, but don't crash if it doesn't
        let data = {};
        try {
            data = await response.json();
        } catch (_) { /* non-JSON response */ }

        if (response.ok && data.success) {
            return { ok: true, token: data.token, admin: data.admin };
        }

        // Map failures to clear messages
        switch (response.status) {
            case 400:
                return { ok: false, message: data.message || "Please enter a valid Admin ID and password." };
            case 401:
                return { ok: false, message: data.message || "Invalid Admin ID or password." };
            case 403:
                return { ok: false, message: data.message || "This account is not allowed to access the admin portal." };
            case 404:
                return { ok: false, message: "Login service not found. Please contact support." };
            case 429:
                return { ok: false, message: "Too many attempts. Please wait a moment and try again." };
            default:
                if (response.status >= 500) {
                    return { ok: false, message: "Server error. Please try again later." };
                }
                return { ok: false, message: data.message || "Login failed. Please try again." };
        }
    } catch (err) {
        if (err.name === "AbortError") {
            return { ok: false, message: "The server took too long to respond. Please try again." };
        }
        return { ok: false, message: "Cannot reach the server. Check your internet connection and try again." };
    } finally {
        clearTimeout(timer);
    }
}

// ---------- SUBMIT HANDLER ----------
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const adminId = adminIdInput.value.trim();
    const password = passwordInput.value;

    // Basic client-side checks
    if (!adminId || !password) {
        showError("Please enter both your Admin ID and password.");
        return;
    }

    // 1) Demo credential: skips the backend entirely
    if (
        CONFIG.DEMO_MODE &&
        adminId === CONFIG.DEMO_CREDENTIALS.adminId &&
        password === CONFIG.DEMO_CREDENTIALS.password
    ) {
        saveSession({ isDemo: true, admin: { adminId, name: "Demo Admin" } });
        goToDashboard();
        return;
    }

    // 2) Real credentials: verified by the backend against the database
    setLoading(true);
    const result = await verifyWithBackend(adminId, password);
    setLoading(false);

    if (!result.ok) {
        showError(result.message);
        passwordInput.value = "";
        passwordInput.focus();
        return;
    }

    saveSession({ token: result.token, admin: result.admin, isDemo: false });
    goToDashboard();
});
