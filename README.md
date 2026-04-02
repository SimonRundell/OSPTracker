# OSP Hours Tracker

A web application for recording and reporting student time spent on
Open-Supervised Projects (OSPs) — timed examination tasks typically
30 hours in total.

Replaces a manual Excel spreadsheet used by teaching staff at
Exeter College. Built by Simon Rundell, CodeMonkey Design Ltd.

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Directory Structure](#directory-structure)
4. [Database](#database)
5. [Configuration](#configuration)
6. [Installation](#installation)
7. [First Login](#first-login)
8. [User Roles](#user-roles)
9. [Key Workflows](#key-workflows)
10. [Authentication](#authentication)
11. [API Reference](#api-reference)
12. [Frontend Architecture](#frontend-architecture)
13. [Reporting & Export](#reporting--export)
14. [Styling](#styling)
15. [Deployment](#deployment)
16. [Logging](#logging)

---

## Overview

The OSP Hours Tracker allows teaching staff to:

- Create and manage OSP projects (each representing a distinct exam task)
- Enrol students onto projects with individual access arrangements
  (extra time: +10%, +20%, or +25%; separate rest-breaks flag)
- Record supervised sessions (whole-class or individual catch-up)
- Enter per-student attendance in minutes for each session
- View running totals — minutes used, minutes remaining, percentage consumed
- Generate professional reports; export to CSV and Excel; print to PDF

Access is login-only. No public registration. An admin account manages
all configuration; staff accounts are restricted to session and
attendance entry.

---

## Technology Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Frontend     | React 18, Vite, JavaScript (ES2022) |
| Routing      | React Router v6                     |
| HTTP client  | Axios                               |
| Excel export | SheetJS (xlsx)                      |
| Backend      | PHP 8.x (no Composer dependencies)  |
| Database     | MySQL 8.x                           |
| Auth         | Hand-rolled HS256 JWT               |
| Web server   | Apache (with mod_rewrite)           |

---

## Directory Structure

```
osp-tracker/
├── index.html                  SPA entry point
├── vite.config.js              Vite config (base: /osp-tracker/)
├── package.json
├── .config.json                Frontend config — DO NOT COMMIT
│
├── public/
│   ├── favicon.ico
│   └── .htaccess               Apache SPA rewrite rules
│
├── src/
│   ├── main.jsx                React entry point
│   ├── App.jsx                 Router + AuthProvider layout
│   ├── App.css                 All styles (single file, light theme)
│   ├── config.js               Loads .config.json
│   │
│   ├── context/
│   │   └── AuthContext.jsx     JWT auth state + login/logout
│   │
│   ├── api/
│   │   └── api.js              All Axios calls (one export per action)
│   │
│   └── components/
│       ├── shared/             NavBar, ProtectedRoute, LoadingSpinner, ConfirmDialog
│       ├── auth/               LoginPage, ChangePasswordPage
│       ├── dashboard/          DashboardPage
│       ├── admin/              AdminPage, StaffManager, StudentManager, ProjectManager
│       ├── projects/           ProjectListPage, ProjectDetailPage, EnrolStudentsModal
│       ├── sessions/           SessionListPage, SessionFormModal, AttendanceEntryPage
│       └── reports/            ReportPage, ExportButtons
│
└── api/                        PHP backend (served by Apache)
    ├── .config.json            DB credentials & JWT secret — DO NOT COMMIT
    ├── setup.php               Bootstrap (CORS, DB connection, helpers)
    ├── jwt_helpers.php         JWT encode/decode (no Composer)
    ├── setup_admin.php         One-time admin seed — DELETE after use
    ├── auth.php
    ├── staff.php
    ├── students.php
    ├── projects.php
    ├── sessions.php
    ├── attendance.php
    └── reports.php
```

---

## Database

Run `osp_tracker.sql` to create the `osp_tracker` database and all tables:

```bash
mysql -u root -p < osp_tracker.sql
```

### Tables

| Table                | Purpose                                              |
|----------------------|------------------------------------------------------|
| `staff`              | Login accounts (admin / staff roles)                 |
| `projects`           | OSP tasks — base hours, centre number, year          |
| `students`           | Student records with candidate number (mandatory)    |
| `project_students`   | Enrolment junction; stores per-student access flags  |
| `sessions`           | Supervised working periods (class or individual)     |
| `session_attendance` | Minutes present per student per session              |

### Views

| View                       | Purpose                                              |
|----------------------------|------------------------------------------------------|
| `student_project_summary`  | Running totals (allowed / used / remaining) per student per project |
| `session_summary`          | Sessions with calculated available_minutes and supervisor name |

### Key Derived Values

These are **never stored** — always calculated at query time:

```
total_minutes_allowed = base_hours x 60 x (1 + time_extension_percent / 100)
total_minutes_used    = SUM(session_attendance.minutes_present)
minutes_remaining     = total_minutes_allowed - total_minutes_used
available_minutes     = TIME_TO_SEC(TIMEDIFF(end_time, start_time)) / 60
```

---

## Configuration

### Backend: `api/.config.json`

```json
{
  "servername"    : "localhost",
  "username"      : "YOUR_DB_USER",
  "password"      : "YOUR_DB_PASSWORD",
  "dbname"        : "osp_tracker",
  "jwt_secret"    : "REPLACE_WITH_LONG_RANDOM_STRING_MIN_32_CHARS",
  "centre_number" : "54221",
  "log_enabled"   : true
}
```

**Never commit this file.** It is listed in `.gitignore`.

Generate a strong JWT secret:

```bash
openssl rand -base64 48
```

### Frontend: `.config.json`

```json
{
  "apiBase": "https://YOUR_DOMAIN/osp-tracker/api"
}
```

**Never commit this file.** It is listed in `.gitignore`.

---

## Installation

### Prerequisites

- Node.js 18+
- PHP 8.1+
- MySQL 8.x
- Apache with `mod_rewrite` enabled

### Steps

1. **Install Node dependencies:**
   ```bash
   cd osp-tracker
   npm install
   ```

2. **Create the database:**
   ```bash
   mysql -u root -p < osp_tracker.sql
   ```

3. **Configure the backend** — create and edit `api/.config.json`
   with your database credentials and a strong random JWT secret.

4. **Configure the frontend** — create `.config.json` in the project root
   pointing at your deployed API URL.

5. **Create the admin user** — browse to:
   ```
   https://yourdomain.example/osp-tracker/api/setup_admin.php
   ```
   Then **immediately delete** `api/setup_admin.php` from the server.

6. **Build the frontend:**
   ```bash
   npm run build
   ```

7. **Deploy** the contents of `dist/` to your web server document root
   (adjust `vite.config.js` base if using a different subfolder).

8. Ensure Apache serves `api/` at the URL in `.config.json`.
   Copy `public/.htaccess` into the deployment folder for SPA routing.

---

## First Login

Default admin credentials (created by `setup_admin.php`):

| Field    | Value        |
|----------|--------------|
| Username | `admin`      |
| Password | `Admin@OSP1` |

You will be **forced to change this password on first login** before
accessing any other part of the application.

**Password policy** (enforced server-side and client-side):
- Minimum 8 characters
- At least one uppercase letter [A-Z]
- At least one digit [0-9]

---

## User Roles

| Role    | Capabilities                                                          |
|---------|-----------------------------------------------------------------------|
| `admin` | Full CRUD on all entities. Staff/student/project management. Reports. |
| `staff` | Create sessions. Enter attendance. View reports. Read-only on students/projects. |

Role is embedded in the JWT payload and verified server-side on every
write action. `ProtectedRoute` also enforces role-based redirects
client-side as a UX safeguard.

---

## Key Workflows

### Set Up a New Project

1. **Admin > Admin panel > Projects tab** — create project, set base hours.
2. **Projects > [Project] > Detail** — click **Enrol Student** per student,
   setting `time_extension_percent` (0/10/20/25) and `rest_breaks` flag.

### Record a Class Session

1. **Projects > [Project] > Sessions > Add Session**
   Date, start/end time, supervisor, Type = **Class**.
2. Click **Attendance** on the session row.
3. Enter minutes present per student. Warnings show if an entry exceeds
   the session duration or the student's total allowed time.
4. Click **Save All**.

### Record an Individual Catch-Up

Same as above with **Type = Individual**, selecting a specific student.
Only that student appears on the attendance form.

### Generate a Report

1. **Projects > [Project] > Report** (or dashboard Report link).
2. A print-ready three-section layout is rendered.
3. Use the toolbar: **Print / Save PDF**, **Export CSV**, **Export Excel**.

---

## Authentication

- JWT (HS256), hand-rolled — no Composer or third-party library.
- Token lifetime: **8 hours**. Stored in `localStorage`.
- JWT payload: `{ sub: staff_id, role, must_change_password, exp }`.
- All API calls attach `Authorization: Bearer <token>`.
- HTTP 401 response: client clears localStorage and redirects to `/login`.
- `must_change_password === 1` forces redirect to `/change-password`
  before any other route is accessible.

---

## API Reference

All endpoints accept `POST` with JSON body `{ "action": "...", ...params }`.
Errors return `{ "message": "..." }` with an appropriate HTTP status code.

### `auth.php`

| Action            | Auth     | Description                              |
|-------------------|----------|------------------------------------------|
| `login`           | None     | Authenticate; returns JWT + staff object |
| `change_password` | Any role | Change current user's password           |

### `staff.php`

| Action           | Auth  | Description                           |
|------------------|-------|---------------------------------------|
| `get_all`        | Any   | List all staff                        |
| `get_one`        | Any   | Get one staff member by id            |
| `create`         | Admin | Create account; returns temp password |
| `update`         | Admin | Update editable fields                |
| `reset_password` | Admin | Generate new temp password            |
| `delete`         | Admin | Soft-deactivate (is_active = 0)       |

### `students.php`

| Action            | Auth  | Description                       |
|-------------------|-------|-----------------------------------|
| `get_all`         | Any   | List active students              |
| `get_one`         | Any   | Get one student by id             |
| `get_for_project` | Any   | Enrolled students + time totals   |
| `create`          | Any   | Create student record             |
| `update`          | Any   | Update student details            |
| `deactivate`      | Admin | Soft-deactivate                   |

### `projects.php`

| Action             | Auth  | Description                           |
|--------------------|-------|---------------------------------------|
| `get_all`          | Any   | List all projects                     |
| `get_one`          | Any   | Project + student/session counts      |
| `create`           | Admin | Create project                        |
| `update`           | Admin | Update including is_active toggle     |
| `enrol_student`    | Admin | Enrol student with access arrangements|
| `unenrol_student`  | Admin | Remove student (confirm if data)      |
| `update_enrolment` | Admin | Change access arrangements            |

### `sessions.php`

| Action                    | Auth  | Description                         |
|---------------------------|-------|-------------------------------------|
| `get_for_project`         | Any   | List sessions for a project         |
| `get_one`                 | Any   | Session + attendance records        |
| `create`                  | Any   | Create session (atomic numbering)   |
| `update`                  | Admin | Update mutable session fields       |
| `delete`                  | Admin | Delete (confirm if attendance data) |
| `get_next_session_number` | Any   | Preview next session number         |

### `attendance.php`

| Action                    | Auth | Description                           |
|---------------------------|------|---------------------------------------|
| `get_for_session`         | Any  | Students + current minutes_present    |
| `save_session_attendance` | Any  | Upsert all attendance for a session   |
| `get_student_summary`     | Any  | Per-session breakdown for one student |

### `reports.php`

| Action                 | Auth  | Description                              |
|------------------------|-------|------------------------------------------|
| `project_overview`     | Any   | Full report dataset                      |
| `all_projects_summary` | Admin | Aggregated stats for all active projects |

---

## Frontend Architecture

### State

Global auth state lives in `AuthContext`. All other state is component-local,
loaded on mount via the functions exported from `src/api/api.js`.

### Routes

```
/login                                         Public
/change-password                               Auth (forced if must_change_password)
/dashboard                                     Auth
/projects                                      Auth
/projects/:id                                  Auth
/projects/:id/sessions                         Auth
/projects/:id/sessions/:sessionId/attendance   Auth
/reports/:projectId                            Auth
/admin                                         Admin only
/                                              -> redirect to /dashboard
```

### Component Summary

| Component             | Responsibility                                             |
|-----------------------|------------------------------------------------------------|
| `AuthContext`         | JWT lifecycle: login, logout, restore session on mount     |
| `ProtectedRoute`      | Redirect to /login or /dashboard based on auth and role    |
| `NavBar`              | Fixed top bar with nav links and logout                    |
| `DashboardPage`       | Project cards                                              |
| `AdminPage`           | Tabbed shell: Staff / Students / Projects                  |
| `StaffManager`        | Staff CRUD + password reset                                |
| `StudentManager`      | Student CRUD + deactivate                                  |
| `ProjectManager`      | Project CRUD + activate/deactivate toggle                  |
| `ProjectDetailPage`   | Project info + enrolled students + enrolment management    |
| `SessionListPage`     | Session table with running total footer row                |
| `SessionFormModal`    | Create session (class or individual)                       |
| `AttendanceEntryPage` | Per-student minutes entry with live over-time warnings     |
| `ReportPage`          | Print-ready report: Summary / Session Log / Student Table  |
| `ExportButtons`       | CSV download, Excel workbook (SheetJS), print trigger      |

---

## Reporting & Export

### Print / PDF

Clicking **Print / Save PDF** calls `window.print()`. The `@media print`
block in `App.css` hides the navbar, toolbar, and modals, inserts a page
break before the Student Summary section, and sets tables to 10pt.
Use **A4 portrait** in the browser print dialog to save as PDF.

### CSV Export

Sessions and Students are written to a single `.csv` file separated by
a blank row and section label. Student columns include one column per
session for per-session minutes. A UTF-8 BOM is prepended for
compatibility with Excel on Windows.

### Excel Export

Two worksheets: **Sessions** and **Students**, built with SheetJS.
Time values are written as `HH:MM` strings (not Excel time serials).
Column widths are set manually for readability.

---

## Styling

A single `src/App.css`. No utility framework, no CSS-in-JS, no
component-level CSS files, no inline styles in components.

### Colour Palette

| Token                 | Value     | Usage                             |
|-----------------------|-----------|-----------------------------------|
| `--colour-primary`    | `#1a5276` | Navbar, headings, primary buttons |
| `--colour-secondary`  | `#2980b9` | Secondary buttons, links          |
| `--colour-accent`     | `#e67e22` | Warnings, highlights              |
| `--colour-success`    | `#27ae60` | On-track progress (< 80%)         |
| `--colour-danger`     | `#c0392b` | Over-time, errors (>= 100%)       |
| `--colour-bg`         | `#f4f6f9` | Page background                   |
| `--colour-surface`    | `#ffffff` | Cards, panels, tables             |

### Progress Bar Thresholds

| % Used  | Colour |
|---------|--------|
| < 80%   | Green  |
| 80-99%  | Amber  |
| >= 100% | Red    |

---

## Deployment

### Build

```bash
npm run build
```

Output is in `dist/`. Deploy its contents to the `/osp-tracker/` subfolder
on your web server (adjust `vite.config.js` base if needed).

### Apache

Enable `mod_rewrite`. Copy `public/.htaccess` into the deployment folder:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /osp-tracker/
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /osp-tracker/index.html [L]
</IfModule>
```

The `api/` directory must be accessible at the URL in `.config.json`.
HTTPS is strongly recommended — JWTs are transmitted on every request.

---

## Logging

Log entries are written to `api/server.log`.
Format: `YYYY-MM-DD HH:MM:SS : message`

Events logged:

- Successful and failed login attempts (username + IP address)
- Password changes (staff_id)
- Session creation and deletion (session_id, project_id, staff_id)
- Attendance saves (session_id, record count, staff_id)
- Database errors

The log file is excluded from `.gitignore`. Rotate or monitor it
periodically in production to prevent unbounded file growth.
