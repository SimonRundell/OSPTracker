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

Save the following sql definitions to a file `osp_tracker.sql`:

```sql
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Staff login accounts
DROP TABLE IF EXISTS `staff`;
CREATE TABLE `staff` (
  `id`                   int NOT NULL AUTO_INCREMENT,
  `username`             varchar(50)  NOT NULL,
  `email`                varchar(100) NULL DEFAULT NULL,
  `password_hash`        varchar(255) NOT NULL,
  `first_name`           varchar(50)  NOT NULL,
  `last_name`            varchar(50)  NOT NULL,
  `role`                 enum('admin','staff') NOT NULL DEFAULT 'staff',
  `must_change_password` tinyint(1) NOT NULL DEFAULT 1,
  `is_active`            tinyint(1) NOT NULL DEFAULT 1,
  `last_login`           datetime NULL DEFAULT NULL,
  `created_at`           datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_staff_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OSP projects
DROP TABLE IF EXISTS `projects`;
CREATE TABLE `projects` (
  `id`             int NOT NULL AUTO_INCREMENT,
  `name`           varchar(150) NOT NULL,
  `description`    text NULL,
  `year`           year NOT NULL,
  `centre_number`  varchar(20) NOT NULL DEFAULT '54221',
  `base_hours`     decimal(6,2) NOT NULL DEFAULT 30.00,
  `start_date`     date NULL DEFAULT NULL,
  `end_date`       date NULL DEFAULT NULL,
  `created_by`     int NOT NULL,
  `is_active`      tinyint(1) NOT NULL DEFAULT 1,
  `created_at`     datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_project_creator` FOREIGN KEY (`created_by`) REFERENCES `staff` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Student master records
DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `id`               int NOT NULL AUTO_INCREMENT,
  `candidate_number` varchar(30) NOT NULL,
  `cis_ref`          varchar(30) NULL DEFAULT NULL,
  `surname`          varchar(60) NOT NULL,
  `first_name`       varchar(60) NOT NULL,
  `is_active`        tinyint(1) NOT NULL DEFAULT 1,
  `created_at`       datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_candidate_number` (`candidate_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enrolment junction: students on projects with access arrangements
DROP TABLE IF EXISTS `project_students`;
CREATE TABLE `project_students` (
  `id`                     int NOT NULL AUTO_INCREMENT,
  `project_id`             int NOT NULL,
  `student_id`             int NOT NULL,
  `time_extension_percent` tinyint NOT NULL DEFAULT 0 COMMENT '0, 10, 20 or 25',
  `rest_breaks`            tinyint(1) NOT NULL DEFAULT 0,
  `notes`                  text NULL,
  `created_at`             datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_project_student` (`project_id`, `student_id`),
  CONSTRAINT `fk_ps_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ps_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Supervised working sessions (class or individual)
DROP TABLE IF EXISTS `sessions`;
CREATE TABLE `sessions` (
  `id`             int NOT NULL AUTO_INCREMENT,
  `project_id`     int NOT NULL,
  `session_number` int NOT NULL,
  `session_date`   date NOT NULL,
  `start_time`     time NOT NULL,
  `end_time`       time NOT NULL,
  `supervisor_id`  int NOT NULL,
  `session_type`   enum('class','individual') NOT NULL DEFAULT 'class',
  `notes`          text NULL,
  `created_at`     datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_project_session_number` (`project_id`, `session_number`),
  CONSTRAINT `fk_session_project`    FOREIGN KEY (`project_id`)    REFERENCES `projects` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_session_supervisor` FOREIGN KEY (`supervisor_id`) REFERENCES `staff` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Minutes present per student per session
DROP TABLE IF EXISTS `session_attendance`;
CREATE TABLE `session_attendance` (
  `id`                  int NOT NULL AUTO_INCREMENT,
  `session_id`          int NOT NULL,
  `project_student_id`  int NOT NULL,
  `minutes_present`     int NOT NULL DEFAULT 0
    COMMENT 'Actual minutes the student worked in this session',
  `created_at`          datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_session_student` (`session_id`, `project_student_id`),
  CONSTRAINT `fk_att_session` FOREIGN KEY (`session_id`)         REFERENCES `sessions`         (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_att_ps`      FOREIGN KEY (`project_student_id`) REFERENCES `project_students` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- View: sessions with calculated available_minutes and supervisor name
DROP VIEW IF EXISTS `session_summary`;
CREATE VIEW `session_summary` AS
  SELECT se.id                                                        AS session_id,
         se.project_id,
         p.name                                                       AS project_name,
         se.session_number,
         se.session_date,
         se.start_time,
         se.end_time,
         (TIME_TO_SEC(TIMEDIFF(se.end_time, se.start_time)) / 60)    AS available_minutes,
         se.session_type,
         se.supervisor_id,
         CONCAT(st.first_name, ' ', st.last_name)                    AS supervisor_name,
         se.notes
  FROM   sessions se
  JOIN   projects p  ON p.id  = se.project_id
  JOIN   staff    st ON st.id = se.supervisor_id;

-- View: running totals (allowed / used / remaining) per student per project
DROP VIEW IF EXISTS `student_project_summary`;
CREATE VIEW `student_project_summary` AS
  SELECT ps.id                                                                    AS project_student_id,
         p.id                                                                     AS project_id,
         p.name                                                                   AS project_name,
         p.centre_number,
         p.year,
         s.id                                                                     AS student_id,
         s.candidate_number,
         s.cis_ref,
         s.surname,
         s.first_name,
         ps.time_extension_percent,
         ps.rest_breaks,
         ps.notes,
         ROUND(p.base_hours * 60 * (1 + ps.time_extension_percent / 100), 0)     AS total_minutes_allowed,
         COALESCE(SUM(sa.minutes_present), 0)                                     AS total_minutes_used,
         ROUND(p.base_hours * 60 * (1 + ps.time_extension_percent / 100), 0)
           - COALESCE(SUM(sa.minutes_present), 0)                                 AS minutes_remaining
  FROM       project_students ps
  JOIN       projects          p  ON p.id  = ps.project_id
  JOIN       students          s  ON s.id  = ps.student_id
  LEFT JOIN  session_attendance sa ON sa.project_student_id = ps.id
  GROUP BY   ps.id, p.id, p.name, p.centre_number, p.year,
             s.id, s.candidate_number, s.cis_ref, s.surname, s.first_name,
             ps.time_extension_percent, ps.rest_breaks, ps.notes, p.base_hours;

SET FOREIGN_KEY_CHECKS = 1;
```

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
- JWT payload: `{ sub: staff_id, role, must_change_password, exp }`. The
  client-side `user` object merges this with the staff record returned at
  login (`id, username, first_name, last_name`), persisted in `localStorage`
  as `osp_staff` so profile fields survive a page refresh.
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
| `create`         | Admin | Create account; returns temp password. Email is optional and not unique — allows the same address on both an admin and a staff account. |
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
| `SessionListPage`     | Session table; footer shows scheduled and remaining unscheduled time |
| `SessionFormModal`    | Create or edit a session (type/student locked after creation) |
| `AttendanceEntryPage` | Per-student minutes entry with live over-time warnings     |
| `ReportPage`          | Print-ready report: Summary / Session Log / Student Table  |
| `ExportButtons`       | CSV download, Excel workbook (SheetJS), print trigger      |

---

## Reporting & Export

### Print / PDF

Clicking **Print / Save PDF** calls `window.print()`. The `@media print`
block in `App.css` hides the navbar, toolbar, and modals, inserts a page
break before the Student Summary section, and sets tables to 10pt.
The `@page` rule forces **A4 landscape** orientation automatically — no
manual selection needed in the browser print dialog.

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
