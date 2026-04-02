<?php
/**
 * OSP Hours Tracker - Sessions endpoint.
 * Actions: get_for_project, get_one, create, update, delete, get_next_session_number
 *
 * @package OSPTracker
 * @author  OSP Tracker Development Team
 * @version 1.0.0
 * @see     setup.php       Bootstrap, DB connection, helper functions.
 * @see     jwt_helpers.php JWT authentication and authorisation helpers.
 */

require_once 'setup.php';
require_once 'jwt_helpers.php';

$jwtPayload = require_auth($config);
$action     = $data['action'] ?? '';

switch ($action) {

    /**
     * @action      get_for_project
     * @access      Any authenticated staff member.
     * @description Returns all sessions for a project from the session_summary
     *              view, ordered by session_number ascending. Used to render the
     *              session list page and populate report data.
     *
     * @param  int $project_id  Primary key of the project.
     * @return array[] From session_summary view: { session_id, project_id,
     *   project_name, session_number, session_date, start_time, end_time,
     *   available_minutes, session_type, supervisor_id, supervisor_name, notes }
     */
    case 'get_for_project':
        $projectId = (int)($data['project_id'] ?? 0);
        $stmt = $mysqli->prepare(
            "SELECT * FROM session_summary WHERE project_id=? ORDER BY session_number"
        );
        $stmt->bind_param('i', $projectId);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows   = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        $stmt->close();
        send_response($rows);
        break;

    /**
     * @action      get_one
     * @access      Any authenticated staff member.
     * @description Returns a single session plus all of its attendance records
     *              (joined with student name and candidate number).
     *
     * @param  int $id  Primary key of the session.
     * @return array Session fields from session_summary plus:
     *   attendance: array[] { id, project_student_id, minutes_present,
     *                         candidate_number, surname, first_name }
     * @throws 404  No session with that id.
     */
    case 'get_one':
        $id   = (int)($data['id'] ?? 0);
        $stmt = $mysqli->prepare("SELECT * FROM session_summary WHERE session_id=?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $session = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$session) send_response('Session not found.', 404);

        // Attendance records
        $att = $mysqli->prepare(
            "SELECT sa.id, sa.project_student_id, sa.minutes_present,
                    s.candidate_number, s.surname, s.first_name
             FROM session_attendance sa
             JOIN project_students ps ON ps.id = sa.project_student_id
             JOIN students s ON s.id = ps.student_id
             WHERE sa.session_id=?"
        );
        $att->bind_param('i', $id);
        $att->execute();
        $attResult = $att->get_result();
        $attendance = [];
        while ($row = $attResult->fetch_assoc()) $attendance[] = $row;
        $att->close();

        $session['attendance'] = $attendance;
        send_response($session);
        break;

    /**
     * @action      get_next_session_number
     * @access      Any authenticated staff member.
     * @description Returns the next available sequential session number for a
     *              project (MAX(session_number) + 1, or 1 if no sessions exist).
     *              Used to preview the number before creating a session.
     *
     * @param  int $project_id  Primary key of the project.
     * @return array { next_session_number: int }
     */
    case 'get_next_session_number':
        $projectId = (int)($data['project_id'] ?? 0);
        $stmt = $mysqli->prepare(
            "SELECT COALESCE(MAX(session_number),0)+1 AS next_num FROM sessions WHERE project_id=?"
        );
        $stmt->bind_param('i', $projectId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        send_response(['next_session_number' => (int)$row['next_num']]);
        break;

    /**
     * @action      create
     * @access      Any authenticated staff member (admin or staff role).
     * @description Creates a new session for a project. Session number is assigned
     *              atomically inside a transaction using a FOR UPDATE lock to
     *              prevent duplicate numbers under concurrent requests.
     *              For session_type = 'individual', a student_project_id must be
     *              supplied and a zero-minute attendance record is pre-created so
     *              the student appears on the attendance entry form.
     *
     * @param  int         $project_id         Primary key of the project.
     * @param  string      $session_date       ISO date YYYY-MM-DD.
     * @param  string      $start_time         HH:MM (24h).
     * @param  string      $end_time           HH:MM (24h). Must be after start_time.
     * @param  int         $supervisor_id      Primary key of supervising staff member.
     * @param  string      $session_type       'class' or 'individual'.
     * @param  string|null $notes              Optional notes.
     * @param  int         $student_project_id Required when session_type='individual'.
     *                                         Primary key of the project_students row.
     * @return array { id: int, session_number: int, message: string }
     * @throws 400  Required fields missing or start_time >= end_time.
     */
    case 'create':
        $projectId        = (int)($data['project_id']        ?? 0);
        $sessionDate      = trim($data['session_date']        ?? '');
        $startTime        = trim($data['start_time']          ?? '');
        $endTime          = trim($data['end_time']            ?? '');
        $supervisorId     = (int)($data['supervisor_id']      ?? 0);
        $sessionType      = in_array($data['session_type'] ?? '', ['class','individual']) ? $data['session_type'] : 'class';
        $notes            = trim(strip_tags($data['notes']    ?? '')) ?: null;
        $studentProjectId = (int)($data['student_project_id'] ?? 0);

        if (!$projectId || !$sessionDate || !$startTime || !$endTime || !$supervisorId) {
            send_response('project_id, session_date, start_time, end_time and supervisor_id are required.', 400);
        }
        if ($startTime >= $endTime) {
            send_response('Start time must be before end time.', 400);
        }

        // Get next session number (transaction safe)
        $mysqli->begin_transaction();
        try {
            $numStmt = $mysqli->prepare(
                "SELECT COALESCE(MAX(session_number),0)+1 AS next_num FROM sessions WHERE project_id=? FOR UPDATE"
            );
            $numStmt->bind_param('i', $projectId);
            $numStmt->execute();
            $sessionNumber = (int)$numStmt->get_result()->fetch_assoc()['next_num'];
            $numStmt->close();

            $ins = $mysqli->prepare(
                "INSERT INTO sessions (project_id, session_number, session_date, start_time, end_time, supervisor_id, session_type, notes)
                 VALUES (?,?,?,?,?,?,?,?)"
            );
            $ins->bind_param('iisssiss', $projectId, $sessionNumber, $sessionDate, $startTime, $endTime, $supervisorId, $sessionType, $notes);
            $ins->execute();
            $sessionId = $ins->insert_id;
            $ins->close();

            if ($sessionType === 'individual' && $studentProjectId) {
                $attIns = $mysqli->prepare(
                    "INSERT INTO session_attendance (session_id, project_student_id, minutes_present) VALUES (?,?,0)"
                );
                $attIns->bind_param('ii', $sessionId, $studentProjectId);
                $attIns->execute();
                $attIns->close();
            }

            $mysqli->commit();
        } catch (Exception $e) {
            $mysqli->rollback();
            log_info("Session create error: " . $e->getMessage());
            send_response('Could not create session.', 500);
        }

        log_info("Session created: id=$sessionId project_id=$projectId by staff_id={$jwtPayload['sub']}");
        send_response(['id' => $sessionId, 'session_number' => $sessionNumber, 'message' => 'Session created.']);
        break;

    /**
     * @action      update
     * @access      Admin only.
     * @description Updates the mutable fields of an existing session. session_type
     *              cannot be changed after creation. Session number is immutable.
     *
     * @param  int         $id            Primary key of the session.
     * @param  string      $session_date  Updated ISO date.
     * @param  string      $start_time    Updated start time HH:MM.
     * @param  string      $end_time      Updated end time HH:MM.
     * @param  int         $supervisor_id Updated supervisor.
     * @param  string|null $notes         Updated notes.
     * @return array { message: string }
     * @throws 400  start_time >= end_time.
     * @throws 403  If caller is not an admin.
     */
    case 'update':
        require_admin($jwtPayload);
        $id           = (int)($data['id']           ?? 0);
        $sessionDate  = trim($data['session_date']  ?? '');
        $startTime    = trim($data['start_time']    ?? '');
        $endTime      = trim($data['end_time']      ?? '');
        $supervisorId = (int)($data['supervisor_id']?? 0);
        $notes        = trim(strip_tags($data['notes'] ?? '')) ?: null;

        if ($startTime >= $endTime) send_response('Start time must be before end time.', 400);

        $stmt = $mysqli->prepare(
            "UPDATE sessions SET session_date=?, start_time=?, end_time=?, supervisor_id=?, notes=? WHERE id=?"
        );
        $stmt->bind_param('sssisi', $sessionDate, $startTime, $endTime, $supervisorId, $notes, $id);
        $stmt->execute();
        $stmt->close();
        send_response(['message' => 'Session updated.']);
        break;

    /**
     * @action      delete
     * @access      Admin only.
     * @description Deletes a session and all its attendance records (CASCADE).
     *              If any attendance records have minutes_present > 0, a 409
     *              conflict is returned on the first call. Re-send with
     *              confirm: true to force deletion, acknowledging that attendance
     *              data will be permanently lost.
     *
     * @param  int  $id       Primary key of the session to delete.
     * @param  bool $confirm  Must be true to force-delete when attendance data
     *                        exists. Defaults to false.
     * @return array { message: string }
     * @throws 403  If caller is not an admin.
     * @throws 409  Attendance with minutes_present > 0 exists and confirm !== true.
     *              Response includes { conflict: true, message: string }.
     */
    case 'delete':
        require_admin($jwtPayload);
        $id      = (int)($data['id']      ?? 0);
        $confirm = (bool)($data['confirm']?? false);

        $chk = $mysqli->prepare(
            "SELECT COUNT(*) AS cnt FROM session_attendance WHERE session_id=? AND minutes_present>0"
        );
        $chk->bind_param('i', $id);
        $chk->execute();
        $cnt = (int)$chk->get_result()->fetch_assoc()['cnt'];
        $chk->close();

        if ($cnt > 0 && !$confirm) {
            send_response([
                'conflict' => true,
                'message'  => "Session has $cnt attendance records. Send confirm:true to delete anyway.",
            ], 409);
        }

        $del = $mysqli->prepare("DELETE FROM sessions WHERE id=?");
        $del->bind_param('i', $id);
        $del->execute();
        $del->close();

        log_info("Session deleted: id=$id by staff_id={$jwtPayload['sub']}");
        send_response(['message' => 'Session deleted.']);
        break;

    default:
        send_response('Unknown action.', 400);
}
