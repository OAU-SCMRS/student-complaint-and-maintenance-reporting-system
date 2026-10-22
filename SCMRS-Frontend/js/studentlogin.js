// /js/studentlogin.js

// ---------- Configuration ----------
const API_URL = "/api/student/login";          // change to your backend login endpoint
const DASHBOARD_URL = "student.html"; // page to open after a successful login

// Demo account: works without contacting the backend.
// NOTE: this is visible to anyone who views the page source, so the demo
// dashboard must never show real student data.
const DEMO_CREDENTIALS = {
    studentId: "group14",
    password: "group141234",
};

// ---------- Elements ----------
const form = document.getElementById("loginForm");
const studentIdInput = document.getElementById("studentId");
const passwordInput = document.getElementById("password");
const toggleIcon = document.getElementById("visible");
const errorMsg = document.getElementById("errorMsg");
const loginBtn = form.querySelector("button[type='submit']");

// ---------- Helpers ----------
function showError(message) {
    errorMsg.textContent = message;
    studentIdInput.classList.add("invalid");
    passwordInput.classList.add("invalid");
}

function clearError() {
    errorMsg.textContent = "";
    studentIdInput.classList.remove("invalid");
    passwordInput.classList.remove("invalid");
}

function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    loginBtn.textContent = isLoading ? "Logging in..." : "Login";
}

// ---------- Password visibility toggle ----------
toggleIcon.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    toggleIcon.textContent = isHidden ? "visibility_off" : "visibility";
});

// Clear the error as soon as the user starts typing again
[studentIdInput, passwordInput].forEach((input) =>
    input.addEventListener("input", clearError)
);

// ---------- Login ----------
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const studentId = studentIdInput.value.trim();
    const password = passwordInput.value;

    if (!studentId || !password) {
        showError("Please enter your Student ID and password.");
        return;
    }

    // 1. Demo access: skip the backend entirely
    if (
        studentId.toLowerCase() === DEMO_CREDENTIALS.studentId &&
        password === DEMO_CREDENTIALS.password
    ) {
        sessionStorage.setItem("demoMode", "true");
        sessionStorage.setItem("studentName", "Demo Student");
        window.location.href = DASHBOARD_URL;
        return;
    }

    // 2. Real login: ask the backend
    setLoading(true);
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId, password }),
            credentials: "same-origin", // lets the server set a session cookie
        });

        let data = {};
        try {
            data = await response.json();
        } catch (_) {
            /* response had no JSON body */
        }

        if (response.ok) {
            sessionStorage.removeItem("demoMode");
            if (data.name) sessionStorage.setItem("studentName", data.name);
            window.location.href = DASHBOARD_URL;
        } else if (response.status === 400 || response.status === 401) {
            showError(data.message || "Invalid Student ID or password.");
        } else {
            showError("Something went wrong on the server. Please try again later.");
        }
    } catch (err) {
        showError("Unable to reach the server. Check your connection and try again.");
    } finally {
        setLoading(false);
    }
});
