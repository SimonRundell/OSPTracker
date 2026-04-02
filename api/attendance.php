<?php
/**
 * OSP Hours Tracker - Attendance endpoint.
 * Actions: get_for_session, save_session_attendance, get_student_summary
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
     * @action      get_for_session
     * @access      Any authenticated staff member.
     * @description Returns all enrolled students for a session's project, each
     *              with their existing attendance record for this session (0 if
     *              not yet entered). Also returns session metadata and the
     *              available_minutes for the session.
     *              Used to pre-populate the attendance entry form.
     *
     * @param  int $session_id  Primary key of the session.
     * @return array {
     *   session: { project_id, start_time, end_time },
     *   available_minutes: float,
     *   students: array[] {
     *     project_student_id, student_id, candidate_number, cis_ref,
     *     surname, first_name, time_extension_percent, rest_breaks,
     *     total_minutes_allowed, total_minutes_used, minutes_remaining,
     *     minutes_present, attendance_id
     *   }
     * }
     * @throws 404  Session not found.
     */
    case 'get_for_session':
        $sessionId = (int)($data['session_id'] ?? 0);

        // Get the project_id for this session
        $sessStmt = $mysqli->prepare("SELECT project_id, start_time, end_time FROM sessions WHERE id=?");
        $sessStmt->bind_param('i', $sessionId);
        $sessStmt->execute();
        $sess = $sessStmt->get_result()->fetch_assoc();
        $sessStmt->close();
        if (!$sess) send_response('Session not found.', 404);

        $projectId = $sess['project_id'];
        $availMins = (strtotime($sess['end_time']) - strtotime($sess['start_time'])) / 60;

        $stmt = $mysqli->prepare(
            "SELECT ps.id AS project_student_id,
                    s.id AS student_id,
                    s.candidate_number,
                    s.cis_ref,
                    s.surname,
                    s.first_name,
                    sps.time_extension_percent,
                    sps.rest_breaks,
                    sps.total_minutes_allowed,
                    sps.total_minutes_used,
                    sps.minutes_remaining,
                    COALESCE(sa.minutes_present, 0) AS minutes_present,
                    sa.id AS attendance_id
             FROM project_students ps
             JOIN students s ON s.id = ps.student_id
             JOIN student_project_summary sps ON sps.project_student_id = ps.id
             LEFT JOIN session_attendance sa ON sa.session_id=? AND sa.project_student_id=ps.id
             WHERE ps.project_id=? AND s.is_active=1
             ORDER BY s.surname, s.first_name"
        );
        $stmt->bind_param('ii', $sessionId, $projectId);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows   = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        $stmt->close();

        send_response(['session' => $sess, 'available_minutes' => $availMins, 'students' => $rows]);
        break;

    /**
     * @action      save_session_attendance
     * @access      Any authenticated staff member.
     * @description Upserts attendance records for all students in a session using
     *              INSERT … ON DUPLICATE KEY UPDATE in a single transaction.
     *              Negative minutes_present values are silently clamped to 0.
     *              The session_attendance table has a unique key on
     *              (session_id, project_student_id), so this is safe to call
     *              multiple times — subsequent calls overwrite earlier values.
     *
     * @param  int   $session_id  Primary key of the session.
     * @param  array $attendance  Array of { project_student_id: int,
     *                            minutes_present: int } objects.
     * @return array { message: string, saved: int }  saved = count of records upserted.
     * @throws 400  session_id missing or attendance is not an array.
     * @throws 404  Session not found.
     * @throws 500  Transaction failure (rolled back).
     */
    case 'save_session_attendance':
        $sessionId  = (int)($data['session_id']  ?? 0);
        $attendance = $data['attendance']         ?? [];

        if (!$sessionId || !is_array($attendance)) {
            send_response('session_id and attendance array are required.', 400);
        }

        // Get session duration
        $sessStmt = $mysqli->prepare("SELECT start_time, end_time, project_id FROM sessions WHERE id=?");
        $sessStmt->bind_param('i', $sessionId);
        $sessStmt->execute();
        $sess = $sessStmt->get_result()->fetch_assoc();
        $sessStmt->close();
        if (!$sess) send_response('Session not found.', 404);

        $availMins = (strtotime($sess['end_time']) - strtotime($sess['start_time'])) / 60;

        $mysqli->begin_transaction();
        try {
            $upsert = $mysqli->prepare(
                "INSERT INTO session_attendance (session_id, project_student_id, minutes_present)
                 VALUES (?,?,?)
                 ON DUPLICATE KEY UPDATE minutes_present=VALUES(minutes_present)"
            );
            $saved = 0;
            foreach ($attendance as $rec) {
                $psId    = (int)($rec['project_student_id'] ?? 0);
                $minutes = (int)($rec['minutes_present']    ?? 0);
                if ($minutes < 0) $minutes = 0;
                $upsert->bind_param('iii', $sessionId, $psId, $minutes);
                $upsert->execute();
                $saved++;
            }
            $upsert->close();
            $mysqli->commit();
        } catch (Exception $e) {
            $mysqli->rollback();
            log_info("Attendance save error session_id=$sessionId: " . $e->getMessage());
            send_response('Could not save attendance.', 500);
        }

        log_info("Attendance saved: session_id=$sessionId, $saved records by staff_id={$jwtPayload['sub']}");
        send_response(['message' => "Attendance saved ($saved records).", 'saved' => $saved]);
        break;

    /**
     * @action      get_student_summary
     * @access      Any authenticated staff member.
     * @description Returns a session-by-session attendance breakdown for a single
     *              enrolled student, plus their overall running totals from the
     *              student_project_summary view. Used for student detail views
     *              and drilling down from the project report.
     *
     * @param  int $project_student_id  Primary key of the project_students row.
     * @return array {
     *   sessions: array[] {
     *     id, session_id, session_number, session_date, start_time, end_time,
     *     available_minutes, minutes_present
     *   },
     *   totals: { total_minutes_allowed, total_minutes_used, minutes_remaining }
     * }
     */
    case 'get_student_summary':
        $psId = (int)($data['project_student_id'] ?? 0);

        $stmt = $mysqli->prepare(
            "SELECT sa.id, sa.session_id, se.session_number, se.session_date,
                    se.start_time, se.end_time,
                    TIME_TO_SEC(TIMEDIFF(se.end_time, se.start_time))/60 AS available_minutes,
                    sa.minutes_present
             FROM session_attendance sa
             JOIN sessions se ON se.id = sa.session_id
             WHERE sa.project_student_id=?
             ORDER BY se.session_number"
        );
        $stmt->bind_param('i', $psId);
        $stmt->execute();
        $result  = $stmt->get_result();
        $records = [];
        while ($row = $result->fetch_assoc()) $records[] = $row;
        $stmt->close();

        // Running totals from view
        $tot = $mysqli->prepare(
            "SELECT total_minutes_allowed, total_minutes_used, minutes_remaining
             FROM student_project_summary WHERE project_student_id=?"
        );
        $tot->bind_param('i', $psId);
        $tot->execute();
        $totals = $tot->get_result()->fetch_assoc();
        $tot->close();

        send_response(['sessions' => $records, 'totals' => $totals]);
        break;

    default:
        send_response('Unknown action.', 400);
}
