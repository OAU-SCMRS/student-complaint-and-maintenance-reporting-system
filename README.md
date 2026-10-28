# FixOAU — Student Complaint & Maintenance Reporting System

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![JavaScript](https://img.shields.io/badge/Frontend-Vanilla_ES6+-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![SQLAlchemy](https://img.shields.io/badge/ORM-SQLAlchemy-D71F00?style=flat&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A centralized, responsive web platform engineered for students and facility administrators at **Obafemi Awolowo University (OAU)**. The system streamlines reporting, tracking, triaging, and resolving campus maintenance issues—such as electrical faults, plumbing failures, damaged hostel equipment, and lecture hall defects.

Developed as a Student Work Experience Program (SWEP 2024/25, Group 14) project.

---

## Table of Contents

- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Repository Structure](#repository-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#1-backend-setup)
  - [Frontend Setup](#2-frontend-setup)
  - [Standalone Mock Server (Testing)](#3-standalone-mock-server-testing)
- [Demo Mode](#demo-mode-zero-backend-simulation)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [Team & Disclaimer](#team--disclaimer)

---

## Key Features

### 🎓 Student Portal
- **Authentication & Profiles:** Secure registration and login using matriculation numbers and passwords.
- **Issue Submission:** Structured complaint lodging with category, specific location (hostel/hall), detailed narrative, and multi-photo attachments.
- **Lifecycle Tracking:** Real-time visibility into complaint states: `Pending`, `In Progress`, `Resolved`, and `Rejected`.
- **In-App Notifications:** Instant alerts triggered by administrative status updates and feedback.
- **Complaint History:** Centralized view of all past submissions and historical audit trails.

### 🛠️ Administrative & Maintenance Console
- **Staff Control Room:** Protected portal with administrative access passcodes (`ADMIN_ACCESS_CODE`).
- **Triage & Operations Management:** Search, filter, inspect details, append operational notes, and update complaint statuses.
- **Reporting & Analytics:** Aggregate complaint summaries, metrics by category/status, and performance visibility.
- **Notification Dispatch:** Automated trigger broadcasts to affected students upon resolution or status changes.

### ⚡ Client-Side Highlights
- **Build-Free Architecture:** Pure HTML5, CSS3, and ES6+ JavaScript—no complex build steps or bulky node_modules required.
- **Responsive & Dual Theme:** Fluid desktop and mobile interfaces with system-adaptive dark mode.
- **Isolated Demo Mode:** In-browser client simulation using `localStorage` for demonstrations without an active backend.

---

## System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Frontend Client                      │
│   (HTML5 / CSS3 Tokens / Vanilla ES6+ JS / No Build)   │
│   ├─ Landing Page (`index.html`)                       │
│   ├─ Student Portal (`/students/*`)                    │
│   └─ Admin Console (`/Admin/*`)                        │
└───────────────────────────┬────────────────────────────┘
                            │ REST API (JSON / FormData)
                            ▼
┌────────────────────────────────────────────────────────┐
│                  FastAPI Backend                       │
│   ├─ CORS Middleware & Route Protection                │
│   ├─ Pydantic Request Validation Schemas               │
│   ├─ Multipart File Upload Management (`/uploads`)     │
│   └─ SQLAlchemy ORM Layer                              │
└───────────────────────────┬────────────────────────────┘
                            │ Engine Connection
                            ▼
┌────────────────────────────────────────────────────────┐
│                      Database                          │
│     SQLite (Local Dev) / PostgreSQL / MySQL (Prod)     │
│       - Users (Students & Staff)                       │
│       - Complaints & Multi-Image Metadata              │
│       - Resolution Updates & Activity Logs             │
│       - Real-time Notifications                        │
└────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```text
student-complaint-and-maintenance-reporting-system/
├── backend/
│   ├── main.py                  # FastAPI server endpoints & CORS configuration
│   ├── database.py              # SQLAlchemy database session & engine binding
│   ├── models.py                # Database models (User, Complaint, Update, Notification)
│   ├── requirements.txt         # Python dependencies
│   ├── complaint_system.db      # Development SQLite database
│   └── README.md                # Backend specific documentation
├── frontend/
│   ├── index.html               # Public landing page
│   ├── Admin/                   # Staff administration console pages
│   ├── students/                # Student portal pages
│   ├── css/                     # Design tokens, reset, theme & layout stylesheets
│   ├── js/                      # Core runtime, configuration, routing, and controllers
│   │   ├── config.js            # Environment endpoints and system configuration
│   │   ├── core.js              # Auth sessions, API wrapper, route guard
│   │   └── demo.js              # Standalone local storage mock simulation
│   ├── dev/
│   │   └── mock_server.py       # Standalone testing mock server
│   ├── docs/
│   │   └── API_CONTRACT.md      # Detailed API contract specification
│   └── README.md                # Frontend specific documentation
└── README.md                    # Root project documentation (this file)
```

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (Custom Properties & Responsive Design), Modern ES6+ JavaScript |
| **Backend** | Python 3.10+, FastAPI, Starlette, Pydantic, Uvicorn |
| **Database & ORM** | SQLAlchemy 2.0+, SQLite (Local Dev), PostgreSQL / MySQL (Production ready via `psycopg` / `PyMySQL`) |
| **File Storage** | Local filesystem (`/uploads`) / Extendable to object storage |

---

## Getting Started

### Prerequisites

- **Python**: Version 3.10 or higher
- **Web Browser**: Any modern browser (Chrome, Firefox, Safari, Edge)
- **Git**

---

### 1. Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   - **Windows:**
     ```powershell
     python -m venv venv
     .\venv\Scripts\activate
     ```
   - **macOS / Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the development server:**
   ```bash
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```

   The API will be live at `http://127.0.0.1:8000`. Interactive Swagger UI is available at `http://127.0.0.1:8000/docs`.

---

### 2. Frontend Setup

1. **Configure API target:**
   Open `frontend/js/config.js` and verify the `API_BASE` setting:
   ```javascript
   API_BASE: "http://127.0.0.1:8000",
   ```

2. **Serve the frontend:**
   Because modern browsers restrict file protocol (`file://`) interactions with APIs, serve `frontend` via any static HTTP server.

   *Example using Python:*
   ```bash
   cd frontend
   python -m http.server 3000
   ```

3. **Access the application:**
   Open your browser to `http://localhost:3000`.

---

### 3. Standalone Mock Server (Testing)

If you wish to test the full frontend interface without configuring the main backend database:

```bash
python frontend/dev/mock_server.py
```
This runs a reference FastAPI server on `http://127.0.0.1:8000` that preloads sample complaints, serves the frontend files directly, and provides default admin registration passcode: `FIXOAU-ADMIN`.

---

## Demo Mode (Zero-Backend Simulation)

To review or demo the client experience without running any backend or database services:

1. Open `frontend/js/config.js`.
2. Toggle demo mode on:
   ```javascript
   DEMO_MODE: true,
   DEMO_ALLOWED_HOSTS: ["localhost", "127.0.0.1", ""]
   ```
3. Open `frontend/students/studentlogin.html` or `frontend/Admin/adminlogin.html`.
4. Click **"Try the student demo"** or **"Try the admin demo"** to explore with pre-populated dummy data directly stored in your browser's `localStorage`.

---

## API Documentation

The backend exposes RESTful endpoints adhering to standard HTTP statuses:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Register a new student account |
| `POST` | `/auth/login` | Authenticate student or administrative user |
| `PUT` | `/users/{id}` | Update student profile information |
| `PUT` | `/users/{id}/password`| Change user account password |
| `POST` | `/complaints/` | Submit a maintenance complaint (with multipart photos) |
| `GET` | `/complaints/user/{id}` | Retrieve complaints submitted by a student (filter by status) |
| `GET` | `/complaints/stats/{id}`| Compute dashboard metric counters (total, pending, resolved) |
| `GET` | `/notifications/{id}` | Retrieve all notification logs for a user |
| `PUT` | `/notifications/read-all/{id}` | Mark all notifications as read |

For full specification and payload schemas, inspect `frontend/docs/API_CONTRACT.md` or visit the OpenAPI endpoint at `/docs` when the backend is running.

---

## Contributing

1. **Fork** or branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Commit** clean, descriptive changes:
   ```bash
   git commit -m "feat: implement complaint priority badge"
   ```
3. **Push** to your remote branch:
   ```bash
   git push origin feature/your-feature-name
   ```
4. **Open a Pull Request** for team code review.

> *Never commit API keys, database credentials, production secrets, or private student data.*

---

## Team & Disclaimer

- **Developed By:** 2024/25 SWEP Group 14, Obafemi Awolowo University, Ile-Ife.
- **Disclaimer:** This project is an academic prototype designed to provide a digital framework for campus maintenance management. It is not an officially endorsed platform of Obafemi Awolowo University unless formally approved and adopted.

