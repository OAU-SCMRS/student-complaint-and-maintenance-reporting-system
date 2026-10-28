const API_BASE_URL = "https://student-complaint-and-maintenance.onrender.com";

document.getElementById("signupForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const fullName = document.getElementById("fullName").value; // Adjust ID to match your HTML
    const studentId = document.getElementById("studentId").value; // Maps to matric_number
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: fullName,
                matric_number: studentId,
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert("Registration successful! Please log in.");
            window.location.href = "studentlogin.html";
        } else {
            alert("Error: " + (data.detail || "Registration failed"));
        }
    } catch (error) {
        console.error("Connection failed", error);
        alert("Could not connect to the server.");
    }
});