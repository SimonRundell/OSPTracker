<?php
/**
 * OSP Hours Tracker - Projects endpoint.
 * Actions: get_all, get_one, create, update, enrol_student, unenrol_student, update_enrolment
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
     * @action      get_all
     * @access      Any authenticated staff member.
     * @description Returns all projects (active and inactive), ordered by year
     *              descending then name. Includes the creator's full name via
     *              JOIN on staff.
     *
     * @param  void
     * @return array[] { id, name, description, year, centre_number, base_hours,
     *   start_date, end_date, created_by, is_active, created_at, creator_name,
     *   student_count, scheduled_minutes }
     *   student_count    - number of enrolled students (project_students rows).
     *   scheduled_minutes - sum of TIMESTAMPDIFF(MINUTE, start_time, end_time)
     *                       across all sessions; used by the dashboard to display
     *                       remaining unscheduled time (base_hours×60 − scheduled).
     */
    case 'get_all':
        $result = $mysqli->query(
            "SELECT p.id, p.name, p.description, p.year, p.centre_number,
                    p.base_hours, p.start_date, p.end_date, p.created_by,
                    p.is_active, p.created_at,
                    CONCAT(s.first_name,' ',s.last_name) AS creator_name,
                    (SELECT COUNT(*) FROM project_students ps WHERE ps.project_id = p.id) AS student_count,
                    (SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, se.start_time, se.end_time)), 0)
                     FROM sessions se WHERE se.project_id = p.id) AS scheduled_minutes
             FROM projects p
             LEFT JOIN staff s ON s.id = p.created_by
             ORDER BY p.year DESC, p.name"
        );
        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        send_response($rows);
        break;

    /**
     * @action      get_one
     * @access      Any authenticated staff member.
     * @description Returns a single project by primary key, including aggregate
     *              counts of enrolled students and completed sessions.
     *
     * @param  int $id  Primary key of the project.
     * @return array Project fields plus: { student_count: int, session_count: int,
     *               creator_name: string }
     * @throws 404  No project with that id.
     */
    case 'get_one':
        $id   = (int)($data['id'] ?? 0);
        $stmt = $mysqli->prepare(
            "SELECT p.*, CONCAT(s.first_name,' ',s.last_name) AS creator_name,
                    (SELECT COUNT(*) FROM project_students ps WHERE ps.project_id=p.id) AS student_count,
                    (SELECT COUNT(*) FROM sessions se WHERE se.project_id=p.id) AS session_count
             FROM projects p
             LEFT JOIN staff s ON s.id = p.created_by
             WHERE p.id=?"
        );
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$row) send_response('Project not found.', 404);
        send_response($row);
        break;

    /**
     * @action      create
     * @access      Admin only.
     * @description Creates a new OSP project. The created_by field is set
     *              automatically from the JWT sub claim — it cannot be spoofed.
     *              base_hours determines the standard time allowance before
     *              individual extension percentages are applied.
     *
     * @param  string      $name          Project name. Required.
     * @param  string|null $description   Optional description.
     * @param  int         $year          Academic year (4-digit).
     * @param  string      $centre_number Awarding body centre number.
     * @param  float       $base_hours    Standard hours allowance (e.g. 30.00).
     * @param  string|null $start_date    ISO date YYYY-MM-DD, or null.
     * @param  string|null $end_date      ISO date YYYY-MM-DD, or null.
     * @return array { id: int, message: string }
     * @throws 400  If name is absent.
     * @throws 403  If caller is not an admin.
     */
    case 'create':
        require_admin($jwtPayload);
        $name         = trim(strip_tags($data['name']          ?? ''));
        $description  = trim(strip_tags($data['description']   ?? '')) ?: null;
        $year         = (int)($data['year']                    ?? date('Y'));
        $centreNumber = trim(strip_tags($data['centre_number'] ?? $config['centre_number']));
        $baseHours    = (float)($data['base_hours']            ?? 30);
        $startDate    = $data['start_date'] ?: null;
        $endDate      = $data['end_date']   ?: null;
        $createdBy    = $jwtPayload['sub'];

        if (!$name) send_response('Project name is required.', 400);

        $stmt = $mysqli->prepare(
            "INSERT INTO projects (name, description, year, centre_number, base_hours, start_date, end_date, created_by)
             VALUES (?,?,?,?,?,?,?,?)"
        );
        $stmt->bind_param('ssissssi', $name, $description, $year, $centreNumber, $baseHours, $startDate, $endDate, $createdBy);
        if (!$stmt->execute()) {
            log_info("Project create error: " . $stmt->error);
            send_response('Could not create project.', 500);
        }
        $newId = $stmt->insert_id;
        $stmt->close();
        send_response(['id' => $newId, 'message' => 'Project created.']);
        break;

    /**
     * @action      update
     * @access      Admin only.
     * @description Updates all editable fields on a project, including toggling
     *              is_active. Deactivating a project removes it from the dashboard
     *              but does not delete any data.
     *
     * @param  int         $id            Primary key.
     * @param  string      $name          Updated name.
     * @param  string|null $description   Updated description.
     * @param  int         $year          Updated academic year.
     * @param  string      $centre_number Updated centre number.
     * @param  float       $base_hours    Updated base hours.
     * @param  string|null $start_date    Updated start date or null.
     * @param  string|null $end_date      Updated end date or null.
     * @param  int         $is_active     1 = active, 0 = inactive.
     * @return array { message: string }
     * @throws 403  If caller is not an admin.
     */
    case 'update':
        require_admin($jwtPayload);
        $id           = (int)($data['id']                      ?? 0);
        $name         = trim(strip_tags($data['name']          ?? ''));
        $description  = trim(strip_tags($data['description']   ?? '')) ?: null;
        $year         = (int)($data['year']                    ?? date('Y'));
        $centreNumber = trim(strip_tags($data['centre_number'] ?? ''));
        $baseHours    = (float)($data['base_hours']            ?? 30);
        $startDate    = $data['start_date'] ?: null;
        $endDate      = $data['end_date']   ?: null;
        $isActive     = isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1;

        $stmt = $mysqli->prepare(
            "UPDATE projects SET name=?,description=?,year=?,centre_number=?,base_hours=?,
             start_date=?,end_date=?,is_active=? WHERE id=?"
        );
        $stmt->bind_param('ssissssii', $name, $description, $year, $centreNumber, $baseHours, $startDate, $endDate, $isActive, $id);
        $stmt->execute();
        $stmt->close();
        send_response(['message' => 'Project updated.']);
        break;

    /**
     * @action      enrol_student
     * @access      Admin only.
     * @description Enrols a student onto a project by creating a project_students
     *              record with their individual access arrangements. A student may
     *              only be enrolled once per project (enforced by unique key).
     *
     * @param  int         $project_id             Primary key of the project.
     * @param  int         $student_id             Primary key of the student.
     * @param  int         $time_extension_percent Extra time: 0, 10, 20, or 25.
     * @param  int         $rest_breaks            1 if rest breaks are granted, 0 otherwise.
     * @param  string|null $notes                  Optional access arrangement notes.
     * @return array { id: int, message: string }  id = new project_students.id
     * @throws 400  If time_extension_percent is not one of 0, 10, 20, 25.
     * @throws 403  If caller is not an admin.
     * @throws 409  If student is already enrolled on this project.
     */
    case 'enrol_student':
        require_admin($jwtPayload);
        $projectId             = (int)($data['project_id']             ?? 0);
        $studentId             = (int)($data['student_id']             ?? 0);
        $timeExtensionPercent  = (int)($data['time_extension_percent'] ?? 0);
        $restBreaks            = (int)(bool)($data['rest_breaks']      ?? 0);
        $notes                 = trim(strip_tags($data['notes']        ?? '')) ?: null;

        if (!in_array($timeExtensionPercent, [0,10,20,25])) {
            send_response('time_extension_percent must be 0, 10, 20, or 25.', 400);
        }

        $stmt = $mysqli->prepare(
            "INSERT INTO project_students (project_id, student_id, time_extension_percent, rest_breaks, notes)
             VALUES (?,?,?,?,?)"
        );
        $stmt->bind_param('iiiis', $projectId, $studentId, $timeExtensionPercent, $restBreaks, $notes);
        if (!$stmt->execute()) {
            log_info("Enrol student error: " . $stmt->error);
            send_response('Could not enrol student. They may already be enrolled.', 409);
        }
        $newId = $stmt->insert_id;
        $stmt->close();
        send_response(['id' => $newId, 'message' => 'Student enrolled.']);
        break;

    /**
     * @action      unenrol_student
     * @access      Admin only.
     * @description Removes a student from a project. Because session_attendance
     *              records CASCADE delete, all attendance history for this student
     *              on this project will be permanently deleted.
     *              If the student has any minutes_present > 0, a 409 conflict is
     *              returned on the first call. The admin must re-send with
     *              confirm: true to proceed, acknowledging data loss.
     *
     * @param  int  $project_student_id  Primary key of the project_students row.
     * @param  bool $confirm             Must be true to force-delete when attendance
     *                                   records exist. Defaults to false.
     * @return array { message: string }
     * @throws 403  If caller is not an admin.
     * @throws 409  Attendance records exist and confirm !== true. Response includes
     *              { conflict: true, message: string }.
     */
    case 'unenrol_student':
        require_admin($jwtPayload);
        $psId    = (int)($data['project_student_id'] ?? 0);
        $confirm = (bool)($data['confirm']           ?? false);

        // Check for attendance records
        $chk = $mysqli->prepare(
            "SELECT COUNT(*) AS cnt FROM session_attendance WHERE project_student_id=? AND minutes_present > 0"
        );
        $chk->bind_param('i', $psId);
        $chk->execute();
        $cnt = (int)$chk->get_result()->fetch_assoc()['cnt'];
        $chk->close();

        if ($cnt > 0 && !$confirm) {
            send_response([
                'conflict' => true,
                'message'  => "This student has $cnt attendance records. Send confirm:true to unenrol anyway.",
            ], 409);
        }

        $stmt = $mysqli->prepare("DELETE FROM project_students WHERE id=?");
        $stmt->bind_param('i', $psId);
        $stmt->execute();
        $stmt->close();
        send_response(['message' => 'Student unenrolled.']);
        break;

    /**
     * @action      update_enrolment
     * @access      Admin only.
     * @description Updates the access arrangement flags for an enrolled student.
     *              Changing time_extension_percent retroactively alters the
     *              student's total_minutes_allowed (calculated, never stored).
     *
     * @param  int         $project_student_id     Primary key of project_students row.
     * @param  int         $time_extension_percent New extra time: 0, 10, 20, or 25.
     * @param  int         $rest_breaks            1 if rest breaks, 0 otherwise.
     * @param  string|null $notes                  Updated notes.
     * @return array { message: string }
     * @throws 400  If time_extension_percent is not one of 0, 10, 20, 25.
     * @throws 403  If caller is not an admin.
     */
    case 'update_enrolment':
        require_admin($jwtPayload);
        $psId                 = (int)($data['project_student_id']      ?? 0);
        $timeExtensionPercent = (int)($data['time_extension_percent']  ?? 0);
        $restBreaks           = (int)(bool)($data['rest_breaks']       ?? 0);
        $notes                = trim(strip_tags($data['notes']         ?? '')) ?: null;

        if (!in_array($timeExtensionPercent, [0,10,20,25])) {
            send_response('time_extension_percent must be 0, 10, 20, or 25.', 400);
        }

        $stmt = $mysqli->prepare(
            "UPDATE project_students SET time_extension_percent=?, rest_breaks=?, notes=? WHERE id=?"
        );
        $stmt->bind_param('iisi', $timeExtensionPercent, $restBreaks, $notes, $psId);
        $stmt->execute();
        $stmt->close();
        send_response(['message' => 'Enrolment updated.']);
        break;

    default:
        send_response('Unknown action.', 400);
}
