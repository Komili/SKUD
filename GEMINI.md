# Project Overview

This is a full-stack web application designed for employee time and attendance tracking. It features a React frontend, a Node.js (Express) backend, and a MySQL database. The system is capable of integrating with Hikvision access control terminals to automatically log employee check-in and check-out events, and it can send real-time notifications to a Telegram chat.

**Key Features:**

*   **Dashboard:** Provides an overview of key attendance statistics.
*   **Employee Management:** Full CRUD (Create, Read, Update, Delete) functionality for employee records, including photo uploads.
*   **Attendance Reporting:** Generate and view attendance reports for different time periods and filter by company.
*   **Authentication:** Secure login for administrators.
*   **Public Employee Registration:** A public-facing form for new employees to submit their registration details and photo.
*   **Pending Approval Management:** An admin interface to approve or reject new employee submissions.
*   **Hardware Integration:** Listens for events from Hikvision terminals.
    *   **Notifications:** Sends updates to a Telegram bot.

**Recent Updates:**
*   **Enhanced Network Architecture:** Documented the two-office setup with specific IP addresses and port forwarding for Hikvision terminals.
*   **Improved Telegram Notifications:** Implemented clearer, more informative notifications with specific emojis (🟢 for entry, 🔴 for exit), detailed office and door information, and a dedicated alert for unknown employees.
*   **Admin User Management:** Added a script (`add-admin.js`) for secure creation/update of admin users with hashed passwords.
*   **Photo Display Fix:** Resolved an issue where employee photos were not displaying correctly due to incorrect URL construction in the frontend.
*   **Robust Event Handling:** Implemented error handling for Hikvision events to prevent server crashes when an unknown employee ID is received, sending a specific Telegram alert instead.
*   **Registration Workflow:** Added a complete workflow for public employee registration and a dedicated admin page for approving or rejecting pending applications.

**Technology Stack:**
*   **Frontend:** React, React Bootstrap, Axios, React Router
*   **Backend:** Node.js, Express.js, MySQL2, Multer, Bcrypt
*   **Database:** MySQL

# Building and Running

## 1. Database Setup

1.  Ensure you have a MySQL server running.
2.  Create a database named `skud`.
    ```sql
    CREATE DATABASE skud CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    ```
3.  Use the `skud` database.
    ```sql
    USE skud;
    ```
4.  Run the table creation scripts found in the `README.md` to set up the necessary tables (`companies`, `departments`, `users`, `employees`, `attendance_logs`).

## 2. Backend Setup

1.  Navigate to the `server` directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure the database connection and Telegram settings in `server/server.js`.
4.  Start the server:
    ```bash
    npm start
    ```
    The server will run on port 3001.

## 3. Frontend Setup

1.  In a new terminal, navigate to the `client` directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the client development server:
    ```bash
    npm start
    ```
    The application will open in your browser at `http://localhost:3000`.

# Development Conventions

*   The backend is a monolithic API located in `server/server.js`. It handles all business logic, database interaction, and communication with external services (Hikvision, Telegram).
*   The frontend is a single-page application (SPA) built with React. It uses component-based architecture, with pages located in `client/src/pages` and reusable components in `client/src/components`.
*   API requests from the client to the server are proxied to `http://localhost:3001` as configured in `client/package.json`.
*   Authentication is handled via session storage on the client-side.
*   File uploads (employee photos) are handled by `multer` on the backend and stored in the `server/uploads` directory.

# Network Architecture

The system is configured to operate across two offices, with the central server located in Office 1.

*   **Office 1 ("Makon" - Server Location):**
    *   **External IP:** `185.177.0.140`
    *   **Server Local IP:** `192.168.1.108`
    *   **Router Port Forwarding:** External port `7660` is forwarded to the server's local IP `192.168.1.108` (targeting the backend on port 3001).
    *   **Terminal IPs:**
        *   `192.168.1.190` (Outside, Entry)
        *   `192.168.1.191` (Inside, Exit)
    *   **Callback URL for Terminals:** `http://192.168.1.108:3001/api/hikvision/event`

*   **Office 2 ("Favz" - Remote):**
    *   **External IP:** `91.218.161.76`
    *   **Terminal IPs:**
        *   `192.168.0.161` (Outside, Entry)
        *   `192.168.0.160` (Inside, Exit)
    *   **Callback URL for Terminals:** `http://185.177.0.140:7660/api/hikvision/event`