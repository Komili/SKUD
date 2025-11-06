# Project Overview

This is a full-stack web application designed for employee time and attendance tracking. It features a React frontend, a Node.js (Express) backend, and a MySQL database. The system is capable of integrating with Hikvision access control terminals to automatically log employee check-in and check-out events, and it can send real-time notifications to a Telegram chat.

**Key Features:**

*   **Dashboard:** Provides an overview of key attendance statistics.
*   **Employee Management:** Full CRUD (Create, Read, Update, Delete) functionality for employee records, including photo uploads.
*   **Attendance Reporting:** Generate and view attendance reports for different time periods and filter by company.
*   **Authentication:** Secure login for administrators.
*   **Hardware Integration:** Listens for events from Hikvision terminals.
*   **Notifications:** Sends updates to a Telegram bot.

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