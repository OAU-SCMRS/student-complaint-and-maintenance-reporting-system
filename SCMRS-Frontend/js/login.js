// 1. Define your live Render API URL
const API_BASE_URL = "https://student-complaint-and-maintenance.onrender.com";

// 2. Select the login form and listen for the submit button
document.getElementById("loginForm").addEventListener("submit", async function(event) {
    event.preventDefault(); // Prevents the page from reloading

    // 3. Grab the typed values from the input boxes (check your HTML for the exact IDs)
    const matricNumberInput = document.getElementById("studentId").value;
    const passwordInput = document.getElementById("password").value;

    try {
        // 4. Send the POST request to your FastAPI backend
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                matric_number: matricNumberInput, 
                password: passwordInput 
            })
        });

        const data = await response.json();

        // 5. Handle the backend's response
        if (response.ok) {
            alert("Login Successful!");
            
          // Ensure we capture whatever fields your FastAPI backend returns
        const sessionData = {
            user: {
                id: data.user_id,
                matric_number: data.matric_number,
                name: data.name,
                role: data.role
            },
            token: data.token || "active-session"
        };
        localStorage.setItem("scmrs.session", JSON.stringify(sessionData));
        // Redirect to the student dashboard
        window.location.href = "./student.html";
        } else {
            // Shows the "Invalid matric number or password" error from your FastAPI code
            alert("Error: " + data.detail); 
        }
    } catch (error) {
        console.error("Failed to connect to the API", error);
        alert("Could not connect to the server.");
    }
});