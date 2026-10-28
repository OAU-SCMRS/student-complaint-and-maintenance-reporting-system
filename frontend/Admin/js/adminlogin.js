// ============================================================
// adminlogin.js  -  Admin login logic for Fix OAU
// ============================================================

// ---------- CONFIG ----------
const CONFIG = {
    API_URL: "/api/admin/login",          
    DASHBOARD_URL: "admin.html", 
    TIMEOUT_MS: 10000,                    

    DEMO_MODE: true,
    DEMO_CREDENTIALS: { adminId: "demo-admin", password: "Demo@1234" },
};

// ---------- ELEMENTS ----------
const form = document.getElementById("loginForm");
const adminIdInput = document.getElementById("adminId");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("errorMsg");
const toggleIcon = document.getElementById("visible");
const loginBtn = form ? form.querySelector("button[type='submit']") : null;

// ---------- HELPERS ----------
function showError(message) {
    if (!errorMsg) return;
    errorMsg.textContent = message;
    if (adminIdInput) adminIdInput.classList.add("invalid");
    if (passwordInput) passwordInput.classList.add("invalid");
}

function clearError() {
    if (!errorMsg) return;
    errorMsg.textContent = "";
    if (adminIdInput) adminIdInput.classList.remove("invalid");
    if (passwordInput) passwordInput.classList.remove("invalid");
}

function setLoading(isLoading) {
    if (!loginBtn) return;
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
if (toggleIcon && passwordInput) {
    toggleIcon.addEventListener("click", () => {
        const hidden = passwordInput.type === "password";
        passwordInput.type = hidden ? "text" : "password";
        toggleIcon.textContent = hidden ? "visibility_off" : "visibility";
    });
}

// Clear the error as soon as the user starts typing again
if (adminIdInput && passwordInput) {
    [adminIdInput, passwordInput].forEach((input) =>
        input.addEventListener("input", clearError)
    );
}

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

        let data = {};
        try {
            data = await response.json();
        } catch (_) { /* non-JSON response */ }

        if (response.ok && data.success) {
            return { ok: true, token: data.token, admin: data.admin };
        }

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
if (form) {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearError();

        const adminId = adminIdInput ? adminIdInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";

        if (!adminId || !password) {
            showError("Please enter both your Admin ID and password.");
            return;
        }

        // Demo credential
        if (
            CONFIG.DEMO_MODE &&
            adminId === CONFIG.DEMO_CREDENTIALS.adminId &&
            password === CONFIG.DEMO_CREDENTIALS.password
        ) {
            saveSession({ isDemo: true, admin: { adminId, name: "Demo Admin", role: "admin" } });
            goToDashboard();
            return;
        }

        setLoading(true);
        const result = await verifyWithBackend(adminId, password);
        setLoading(false);

        if (!result.ok) {
            showError(result.message);
            if (passwordInput) {
                passwordInput.value = "";
                passwordInput.focus();
            }
            return;
        }

        saveSession({ token: result.token, admin: result.admin, isDemo: false });
        goToDashboard();
    });
}