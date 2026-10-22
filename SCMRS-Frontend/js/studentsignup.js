// /js/studentsignup.js

// ---------- Configuration ----------
const API_URL = "/api/student/signup";   // change to your backend signup endpoint
const LOGIN_URL = "studentlogin.html";   // page to open after clicking Register

// Demo account: skips the backend entirely. It matches the demo account on the
// login page, so after "registering" the user can log in with the same details.
// NOTE: visible to anyone who views the page source, so the demo dashboard
// must never show real student data.
const DEMO_CREDENTIALS = {
    studentId: "group14",
    password: "group141234",
    email: "group14@demo.demo",
};

// ---------- Elements ----------
const form = document.getElementById("signupForm");
const studentIdInput = document.getElementById("studentId");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirmPassword");
const errorMsg = document.getElementById("errorMsg");
const registerBtn = form.querySelector("button[type='submit']");

const allInputs = [studentIdInput, emailInput, passwordInput, confirmInput];

// ---------- Helpers ----------
function showError(message, ...invalidInputs) {
    errorMsg.textContent = message;
    errorMsg.style.color = "";
    invalidInputs.forEach((input) => input.classList.add("invalid"));
    if (invalidInputs[0]) invalidInputs[0].focus();
}

function clearError() {
    errorMsg.textContent = "";
    allInputs.forEach((input) => input.classList.remove("invalid"));
}

function setLoading(isLoading) {
    registerBtn.disabled = isLoading;
    registerBtn.textContent = isLoading ? "Registering..." : "Register";
}

function goToLogin() {
    window.location.href = LOGIN_URL;
}

// ---------- Password visibility toggles ----------
function setupToggle(iconId, input) {
    const icon = document.getElementById(iconId);
    if (!icon) return;
    icon.addEventListener("click", () => {
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        icon.textContent = isHidden ? "visibility_off" : "visibility";
    });
}
setupToggle("visible", passwordInput);
setupToggle("visibleConfirm", confirmInput);

// Clear the error as soon as the user starts typing again
allInputs.forEach((input) => input.addEventListener("input", clearError));

// ---------- Signup ----------
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const studentId = studentIdInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    // 1. Demo access: skip validation and the backend, go straight to login
    if (
        studentId.toLowerCase() === DEMO_CREDENTIALS.studentId &&
        email === DEMO_CREDENTIALS.email &&
        password === DEMO_CREDENTIALS.password &&
        confirmPassword === DEMO_CREDENTIALS.password
    ) {
        errorMsg.style.color = "#188038";
        errorMsg.textContent = "Demo account ready! Redirecting to login...";
        setTimeout(goToLogin, 800);
        return;
    }

    // 2. Real signup: validate
    if (!studentId || !email || !password || !confirmPassword) {
        showError("Please fill in all fields.");
        return;
    }
    if (studentId.toLowerCase() === DEMO_CREDENTIALS.studentId) {
        showError("That Student ID is reserved. Please use your own.", studentIdInput);
        return;
    }
    if (!/^[A-Za-z0-9\/\-_]{3,30}$/.test(studentId)) {
        showError("Student ID must be 3-30 letters, numbers, / or -.", studentIdInput);
        return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        showError("Please enter a valid email address.", emailInput);
        return;
    }
    if (password.length < 8) {
        showError("Password must be at least 8 characters.", passwordInput);
        return;
    }
    if (password !== confirmPassword) {
        showError("Passwords do not match.", passwordInput, confirmInput);
        return;
    }

    // 3. Save to the backend, then send the user to the login page
    setLoading(true);
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId, email, password }),
            credentials: "same-origin",
        });

        let data = {};
        try {
            data = await response.json();
        } catch (_) {
            /* response had no JSON body */
        }

        if (response.ok) {
            errorMsg.style.color = "#188038";
            errorMsg.textContent = "Account created! Redirecting to login...";
            form.reset();
            setTimeout(goToLogin, 1000);
        } else if (response.status === 409) {
            showError(
                data.message || "Student ID or email is already registered.",
                studentIdInput,
                emailInput
            );
        } else if (response.status === 400) {
            showError(data.message || "Please check your details and try again.");
        } else {
            showError("Something went wrong on the server. Please try again later.");
        }
    } catch (err) {
        showError("Unable to reach the server. Check your connection and try again.");
    } finally {
        setLoading(false);
    }
});