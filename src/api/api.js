/**
 * OSP Hours Tracker - API module.
 * All axios calls go through this module. No fetch() calls in components.
 * @module api
 */
import axios from 'axios';
import config from '../config.js';

/**
 * Posts an action to a PHP endpoint.
 * @param {string} endpoint - Endpoint name (e.g. 'auth', 'sessions')
 * @param {object} payload  - The data to POST (must include action key)
 * @param {string|null} [token] - JWT token (omit for login)
 * @returns {Promise<object>} Response data
 * @throws {Error} On non-2xx response
 */
async function apiPost(endpoint, payload, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  // Debug onby - log the API request details (endpoint, payload, token presence)
  // console.log("API Request", { endpoint, payload, token });
  const response = await axios.post(
    `${config.apiBase}/${endpoint}.php`,
    payload,
    { headers }
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Authenticate with username + password. Returns { token, staff }. */
export const login          = (username, password)          => apiPost('auth', { action: 'login', username, password });

/** Change the current user's password. Requires valid token. */
export const changePassword = (token, current, next)        => apiPost('auth', { action: 'change_password', current_password: current, new_password: next }, token);

// ---------------------------------------------------------------------------
// Staff  (write actions require admin role)
// ---------------------------------------------------------------------------

/** Return all staff members ordered by last_name, first_name. */
export const getAllStaff        = (token)       => apiPost('staff', { action: 'get_all' }, token);

/** Return a single staff member by id. */
export const getOneStaff        = (token, id)   => apiPost('staff', { action: 'get_one', id }, token);

/**
 * Create a new staff account. Returns { id, temp_password }.
 * @param {object} data - { username, email, first_name, last_name, role }
 */
export const createStaff        = (token, data) => apiPost('staff', { action: 'create', ...data }, token);

/**
 * Update an existing staff member.
 * @param {object} data - { id, email, first_name, last_name, role, is_active }
 */
export const updateStaff        = (token, data) => apiPost('staff', { action: 'update', ...data }, token);

/** Reset a staff member's password. Returns { temp_password }. */
export const resetStaffPassword = (token, id)   => apiPost('staff', { action: 'reset_password', id }, token);

/** Soft-deactivate a staff member (is_active = 0). */
export const deleteStaff        = (token, id)   => apiPost('staff', { action: 'delete', id }, token);

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

/** Return all active students ordered by surname, first_name. */
export const getAllStudents         = (token)            => apiPost('students', { action: 'get_all' }, token);

/** Return a single student by id. */
export const getOneStudent          = (token, id)        => apiPost('students', { action: 'get_one', id }, token);

/**
 * Return students enrolled on a project, including running time totals.
 * @param {number} project_id
 */
export const getStudentsForProject  = (token, project_id) => apiPost('students', { action: 'get_for_project', project_id }, token);

/**
 * Create a new student record.
 * @param {object} data - { candidate_number, cis_ref?, surname, first_name }
 */
export const createStudent          = (token, data)      => apiPost('students', { action: 'create', ...data }, token);

/**
 * Update a student's details.
 * @param {object} data - { id, candidate_number, cis_ref?, surname, first_name }
 */
export const updateStudent          = (token, data)      => apiPost('students', { action: 'update', ...data }, token);

/** Soft-deactivate a student (admin only). */
export const deactivateStudent      = (token, id)        => apiPost('students', { action: 'deactivate', id }, token);

// ---------------------------------------------------------------------------
// Projects  (write actions require admin role)
// ---------------------------------------------------------------------------

/** Return all projects (active and inactive) with creator name. */
export const getAllProjects   = (token)       => apiPost('projects', { action: 'get_all' }, token);

/** Return a single project with student_count and session_count. */
export const getOneProject    = (token, id)   => apiPost('projects', { action: 'get_one', id }, token);

/**
 * Create a new OSP project.
 * @param {object} data - { name, description?, year, centre_number, base_hours, start_date?, end_date? }
 */
export const createProject    = (token, data) => apiPost('projects', { action: 'create', ...data }, token);

/**
 * Update an existing project.
 * @param {object} data - { id, name, description?, year, centre_number, base_hours, start_date?, end_date?, is_active }
 */
export const updateProject    = (token, data) => apiPost('projects', { action: 'update', ...data }, token);

/**
 * Enrol a student onto a project with access arrangements.
 * @param {object} data - { project_id, student_id, time_extension_percent, rest_breaks, notes? }
 */
export const enrolStudent     = (token, data) => apiPost('projects', { action: 'enrol_student', ...data }, token);

/**
 * Remove a student from a project. Pass confirm:true to force when attendance exists.
 * @param {object} data - { project_student_id, confirm? }
 */
export const unenrolStudent   = (token, data) => apiPost('projects', { action: 'unenrol_student', ...data }, token);

/**
 * Update a student's access arrangements for a project.
 * @param {object} data - { project_student_id, time_extension_percent, rest_breaks, notes? }
 */
export const updateEnrolment  = (token, data) => apiPost('projects', { action: 'update_enrolment', ...data }, token);

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Return all sessions for a project from the session_summary view. */
export const getSessionsForProject  = (token, project_id) => apiPost('sessions', { action: 'get_for_project', project_id }, token);

/** Return a single session with its attendance records. */
export const getOneSession          = (token, id)         => apiPost('sessions', { action: 'get_one', id }, token);

/**
 * Create a new session. For individual sessions also pass student_project_id.
 * @param {object} data - { project_id, session_date, start_time, end_time, supervisor_id, session_type, notes?, student_project_id? }
 */
export const createSession          = (token, data)       => apiPost('sessions', { action: 'create', ...data }, token);

/**
 * Update a session's mutable fields (admin only).
 * @param {object} data - { id, session_date, start_time, end_time, supervisor_id, notes? }
 */
export const updateSession          = (token, data)       => apiPost('sessions', { action: 'update', ...data }, token);

/**
 * Delete a session (admin only). Pass confirm=true to force when attendance data exists.
 * @param {number}  id
 * @param {boolean} [confirm=false]
 */
export const deleteSession          = (token, id, confirm = false) => apiPost('sessions', { action: 'delete', id, confirm }, token);

/** Return the next available session number for a project. */
export const getNextSessionNumber   = (token, project_id) => apiPost('sessions', { action: 'get_next_session_number', project_id }, token);

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

/**
 * Return all enrolled students for a session with their current minutes_present.
 * @param {number} session_id
 */
export const getAttendanceForSession = (token, session_id)              => apiPost('attendance', { action: 'get_for_session', session_id }, token);

/**
 * Upsert attendance records for a session (all students in one call).
 * @param {number} session_id
 * @param {{ project_student_id: number, minutes_present: number }[]} attendance
 */
export const saveSessionAttendance   = (token, session_id, attendance)  => apiPost('attendance', { action: 'save_session_attendance', session_id, attendance }, token);

/**
 * Return session-by-session breakdown and running totals for one enrolled student.
 * @param {number} project_student_id
 */
export const getStudentSummary       = (token, project_student_id)      => apiPost('attendance', { action: 'get_student_summary', project_student_id }, token);

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/**
 * Return the full project report dataset (project, sessions, students with attendance).
 * @param {number} project_id
 */
export const getProjectOverview      = (token, project_id) => apiPost('reports', { action: 'project_overview', project_id }, token);

/** Return summary statistics for all active projects (admin only). */
export const getAllProjectsSummary   = (token)             => apiPost('reports', { action: 'all_projects_summary' }, token);
