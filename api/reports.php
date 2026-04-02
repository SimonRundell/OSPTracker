<?php
/**
 * OSP Hours Tracker - Reports endpoint.
 * Actions: project_overview, all_projects_summary
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
     * @action      project_overview
     * @access      Any authenticated staff member.
     * @description Returns the complete data set needed to render the project
     *              report, the print view, and to generate CSV/Excel exports.
     *              A single call fetches all sessions, all enrolled students with
     *              their running totals, and per-student per-session attendance.
     *              Minimises round trips for the report page load.
     *
     * @param  int $project_id  Primary key of the project to report on.
     * @return array {
     *   project: array             Full project record with creator_name.
     *   sessions: array[]          From session_summary view.
     *   students: array[]          From student_project_summary view, each with:
     *     attendance: array[]  { session_id, session_number, minutes_present }
     *   total_available_minutes: float  SUM of available_minutes across all sessions.
     *   generated_at: string        Server timestamp YYYY-MM-DD HH:MM:SS.
     * }
     * @throws 404  Project not found.
     */
    case 'project_overview':
        $projectId = (int)($data['project_id'] ?? 0);

        // Project details
        $pStmt = $mysqli->prepare(
            "SELECT p.*, CONCAT(s.first_name,' ',s.last_name) AS creator_name
             FROM projects p LEFT JOIN staff s ON s.id=p.created_by WHERE p.id=?"
        );
        $pStmt->bind_param('i', $projectId);
        $pStmt->execute();
        $project = $pStmt->get_result()->fetch_assoc();
        $pStmt->close();
        if (!$project) send_response('Project not found.', 404);

        // Sessions
        $sStmt = $mysqli->prepare(
            "SELECT * FROM session_summary WHERE project_id=? ORDER BY session_number"
        );
        $sStmt->bind_param('i', $projectId);
        $sStmt->execute();
        $sResult  = $sStmt->get_result();
        $sessions = [];
        $totalAvailableMinutes = 0;
        while ($row = $sResult->fetch_assoc()) {
            $sessions[] = $row;
            $totalAvailableMinutes += (float)$row['available_minutes'];
        }
        $sStmt->close();

        // Students with session-by-session breakdown
        $stStmt = $mysqli->prepare(
            "SELECT sps.*
             FROM student_project_summary sps
             WHERE sps.project_id=?
             ORDER BY sps.surname, sps.first_name"
        );
        $stStmt->bind_param('i', $projectId);
        $stStmt->execute();
        $stResult  = $stStmt->get_result();
        $students  = [];
        while ($row = $stResult->fetch_assoc()) $students[] = $row;
        $stStmt->close();

        // Per-student session attendance
        foreach ($students as &$student) {
            $attStmt = $mysqli->prepare(
                "SELECT sa.session_id, se.session_number, sa.minutes_present
                 FROM session_attendance sa
                 JOIN sessions se ON se.id=sa.session_id
                 WHERE sa.project_student_id=?
                 ORDER BY se.session_number"
            );
            $attStmt->bind_param('i', $student['project_student_id']);
            $attStmt->execute();
            $attResult  = $attStmt->get_result();
            $attendance = [];
            while ($ar = $attResult->fetch_assoc()) $attendance[] = $ar;
            $attStmt->close();
            $student['attendance'] = $attendance;
        }
        unset($student);

        send_response([
            'project'                => $project,
            'sessions'               => $sessions,
            'students'               => $students,
            'total_available_minutes'=> $totalAvailableMinutes,
            'generated_at'           => date('Y-m-d H:i:s'),
        ]);
        break;

    /**
     * @action      all_projects_summary
     * @access      Admin only.
     * @description Returns summary statistics for all active projects. Intended
     *              for an admin dashboard overview. Aggregates student counts and
     *              total minutes used across each project.
     *
     * @param  void
     * @return array[] Each element: { id, name, year, base_hours, is_active,
     *                  student_count, total_minutes_used, total_minutes_allowed }
     * @throws 403  If caller is not an admin.
     */
    case 'all_projects_summary':
        require_admin($jwtPayload);
        $result = $mysqli->query(
            "SELECT p.id, p.name, p.year, p.base_hours, p.is_active,
                    COUNT(DISTINCT ps.id) AS student_count,
                    COALESCE(SUM(sa.minutes_present),0) AS total_minutes_used,
                    ROUND(p.base_hours * 60 * COUNT(DISTINCT ps.id)) AS total_minutes_allowed
             FROM projects p
             LEFT JOIN project_students ps ON ps.project_id=p.id
             LEFT JOIN session_attendance sa ON sa.project_student_id=ps.id
             WHERE p.is_active=1
             GROUP BY p.id
             ORDER BY p.year DESC, p.name"
        );
        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        send_response($rows);
        break;

    default:
        send_response('Unknown action.', 400);
}
