# OSP Hours Tracker — Development Notes

Notes for future maintainers covering design decisions, known limitations,
and planned improvements.

Author: Simon Rundell, Exeter College / CodeMonkey Design Ltd.
Last updated: 2026-04-01

---

## Architecture Decisions

### No Composer (PHP)

The JWT implementation is hand-rolled HS256 in `jwt_helpers.php` — no
Composer dependency manager, no `vendor/` directory. This was a deliberate
choice for single-server deployments where Composer may not be available or
where keeping the deployment footprint minimal is preferred.

**Trade-off:** If more complex token handling is needed (e.g. RS256, JWKS,
token refresh), migrating to a library like `firebase/php-jwt` via Composer
would be the right move. The `jwt_helpers.php` functions can be replaced
with Composer equivalents without touching any endpoint files.

### Single `App.css`

All styles live in one file. This keeps the project simple and
print styles co-located with screen styles. If the project grows
significantly, consider CSS Modules per component, but the current
approach avoids build complexity and works well at this scale.

### No State Management Library

Global state is limited to auth (JWT + user object). React Context is
sufficient. If the app grows to require cross-component shared data
(e.g. a live session timer, multi-tab notifications), adding Zustand
or Jotai would be a lightweight upgrade path.

### Action-based API (Single Endpoint per Resource)

Each PHP file handles all actions for one resource via a `switch` on
`$data['action']`. This was chosen over RESTful routing to avoid the
complexity of an Apache routing layer or a PHP micro-framework. It
works well at this scale.

**Trade-off:** Not idiomatic REST. If you want to expose the API to
third-party consumers or build a mobile app, converting to a REST or
GraphQL API would be preferable.

---

## Known Limitations

### No Token Refresh

JWTs are issued with an 8-hour lifetime and there is no refresh mechanism.
A user active near the expiry boundary will be logged out mid-session.

**Fix:** Add a `refresh_token` action to `auth.php` that issues a new
token if the existing one is valid but within (say) 30 minutes of expiry.
In `AuthContext`, set a `setTimeout` to call refresh before expiry.

### No CSRF Protection

The API uses JWT Bearer tokens (not cookies), so traditional CSRF attacks
do not apply. However, if `api/.config.json` CORS is ever loosened to
allow external origins, review this.

### Passwords in Temporary State

When a staff account is created or a password is reset, the plain
temporary password is returned in the API response JSON and displayed
in the UI. It is the admin's responsibility to communicate it securely.
The password is not logged or stored after hashing.

### `server.log` Growth

`api/server.log` has no automatic rotation. On a busy server, it will
grow indefinitely. Use `logrotate` (Linux) or schedule a cleanup task.

### Excel Time Columns

Session start/end times are exported as `HH:MM` strings rather than
Excel time values. This means Excel arithmetic on time columns (e.g.
summing durations) will not work natively. This was intentional to
avoid Excel's date-serial format complexity.

### Session Type is Immutable After Creation

`session_type` ('class' or 'individual') cannot be changed after a session
is created. This prevents data inconsistency (individual sessions have a
pre-created attendance record for one student). If this is needed, the
fix involves deleting and recreating the session.

### `students.php` create/update Accessible to All Staff

The instructions specified staff can create and update student records
(not admin-only). If this should be admin-only, add `require_admin($jwtPayload)`
at the top of those two cases in `students.php`.

---

## Suggested Future Enhancements

### 1. JWT Token Refresh

As noted above — implement `refresh_token` action in `auth.php` and a
client-side auto-refresh timer in `AuthContext`.

### 2. Email Notifications

When a staff account is created or a password is reset, email the
temporary password directly rather than displaying it in the UI.
PHP's `mail()` function or a library like PHPMailer would work.
Store SMTP config in `api/.config.json`.

### 3. Session Edit UI

Currently, sessions can only be deleted and re-created by admins.
The `sessions.php` `update` action is implemented server-side but there
is no edit button in the UI. Add an edit button to the session row in
`SessionListPage` that opens a pre-populated `SessionFormModal`.

### 4. Student Detail Drilldown

The `attendance.php` `get_student_summary` action and the API function
`getStudentSummary` are implemented but not wired to any UI component.
A student-detail modal or page on `ProjectDetailPage` would let supervisors
see an individual student's full session-by-session history.

### 5. Multi-Project Enrolment View

Currently, a student's involvement across multiple projects is only visible
project-by-project. A "Student Profile" page showing all projects and
running totals for a student would be useful for exam officers.

### 6. Audit Log UI

Events are written to `server.log` as plain text. An admin page showing
a filterable, paginated view of recent log entries would improve
auditability. This could be a simple PHP script reading the log file.

### 7. Password Strength Meter

The change-password form validates on submit. A real-time strength meter
(e.g. using `zxcvbn`) would improve the user experience.

### 8. Bulk Student Import

Importing students from a CSV file (candidate number, CIS ref, surname,
first name) would save time when setting up a new academic year. Add a
file upload to `StudentManager` and a new `bulk_import` action to
`students.php`.

### 9. Academic Year Rollover

At the start of each year, admins need to create new projects and
re-enrol students. A "Copy Project" feature that creates a new project
with the same students (but no sessions or attendance) would streamline
this.

### 10. Per-Session Notes for Students

Currently, the `session_attendance` table stores only `minutes_present`.
Adding an optional `notes` column would allow supervisors to record
reasons for absences or partial attendance.

### 11. TypeScript Migration

The project is plain JavaScript. If the team grows or the codebase
expands significantly, migrating to TypeScript would improve IDE support,
catch type errors at compile time, and make the API layer's data shapes
self-documenting. The migration path with Vite is straightforward.

### 12. Automated Testing

No tests currently exist. Priorities for test coverage:

- **Backend (PHPUnit):** `jwt_helpers.php` functions; attendance upsert
  transaction; the 409-then-confirm pattern for unenrol/delete.
- **Frontend (Vitest + React Testing Library):** `AuthContext` token
  expiry and restoration; `AttendanceEntryPage` warning logic; export
  functions in `ExportButtons`.

### 13. Nginx Support

The application ships with an Apache `.htaccess` rewrite rule. An Nginx
equivalent config block would be:

```nginx
location /osp-tracker/ {
    try_files $uri $uri/ /osp-tracker/index.html;
}
```

### 14. Dark Mode

The CSS custom properties in `:root` make adding a dark theme
straightforward. Add a `[data-theme="dark"]` attribute variant to
`App.css` and a theme toggle in `NavBar`. User preference could be
persisted to `localStorage`.

---

## Code Conventions

### PHP

- All queries use `mysqli` prepared statements. Never concatenate
  user-supplied data into SQL.
- All inputs are sanitised with `trim()` and `strip_tags()` before use.
- Every endpoint file calls `require_auth($config)` at the top (except
  the `login` action in `auth.php` which handles it case-by-case).
- `send_response()` exits — do not put code after it expecting it to run.
- Keep `setup.php` unchanged except for the `log_info()` function.

### JavaScript / JSX

- All API calls go through `src/api/api.js`. No `fetch()` or `axios`
  imports in components.
- Use `async/await` with `try/catch`. Set an error state string and
  display it in an `.alert-danger` div.
- No inline styles. All classes come from `App.css`.
- Named exports for components; default export for the file.

### CSS

- Use CSS custom properties (`var(--colour-*)`) for all colours.
- Class names use kebab-case. BEM-lite naming (e.g. `.modal-header`,
  `.modal-body`, `.modal-footer`).
- Add all new styles to `App.css`. Do not create component-level CSS files.

---

## Deployment Checklist

Before going live:

- [ ] `api/.config.json` has real credentials, a strong `jwt_secret`, and the correct `apiBase` HTTPS URL
- [ ] `setup_admin.php` has been deleted from the server
- [ ] Default admin password has been changed
- [ ] HTTPS is configured on the web server
- [ ] `server.log` is excluded from web-accessible paths (it is in `api/`,
      which should not serve `.log` files publicly — add to Apache config
      or `.htaccess` if needed)
- [ ] `api/.config.json` is not web-accessible (Apache will serve it as
      text by default; either deny access in `.htaccess` or move it
      outside the document root)
- [ ] `npm run build` produces no errors

### Protect `api/.config.json` from Web Access

Add to `api/.htaccess` (create this file if it does not exist):

```apache
<FilesMatch "\.json$">
  Require all denied
</FilesMatch>
```

---

## Database Migration Notes

If the schema needs to change in future versions:

1. Write a migration SQL file (e.g. `migrations/002_add_student_notes.sql`).
2. Apply it with `mysql -u root -p osp_tracker < migrations/002_...sql`.
3. Update the view definitions in `osp_tracker.sql` if views are affected.
4. Update the corresponding PHP endpoint and React component.

There is no migration framework — migrations are applied manually.
Keep a numbered sequence and document what each one does.

---

## Dependency Versions (at build time)

| Package          | Version  |
|------------------|----------|
| react            | 18.x     |
| react-dom        | 18.x     |
| react-router-dom | 6.x      |
| axios            | 1.x      |
| xlsx (SheetJS)   | 0.18.x   |
| vite             | 8.x      |

Check `package.json` for exact pinned versions.
