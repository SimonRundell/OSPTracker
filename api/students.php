<?php
/**
 * OSP Hours Tracker - Students endpoint.
 * Actions: get_all, get_one, get_for_project, create, update, deactivate
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
     * @description Returns all active students ordered by surname, first_name.
     *              Inactive/deactivated students are excluded from this list.
     *
     * @param  void
     * @return array[] { id, candidate_number, cis_ref, surname, first_name, is_active }
     */
    case 'get_all':
        $result = $mysqli->query(
            "SELECT id, candidate_number, cis_ref, surname, first_name, is_active
             FROM students WHERE is_active=1 ORDER BY surname, first_name"
        );
        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        send_response($rows);
        break;

    /**
     * @action      get_one
     * @access      Any authenticated staff member.
     * @description Returns a single student record by primary key.
     *
     * @param  int $id  Primary key of the student.
     * @return array { id, candidate_number, cis_ref, surname, first_name, is_active }
     * @throws 404  No student with that id.
     */
    case 'get_one':
        $id   = (int)($data['id'] ?? 0);
        $stmt = $mysqli->prepare(
            "SELECT id, candidate_number, cis_ref, surname, first_name, is_active
             FROM students WHERE id=?"
        );
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$row) send_response('Student not found.', 404);
        send_response($row);
        break;

    /**
     * @action      get_for_project
     * @access      Any authenticated staff member.
     * @description Returns all students enrolled on a given project, joined with
     *              their running time totals from the student_project_summary view.
     *              Used to populate attendance forms and the project detail page.
     *
     * @param  int $project_id  Primary key of the project.
     * @return array[] Each element: { project_student_id, student_id,
     *   candidate_number, cis_ref, surname, first_name,
     *   time_extension_percent, rest_breaks, notes,
     *   total_minutes_allowed, total_minutes_used, minutes_remaining }
     */
    case 'get_for_project':
        $projectId = (int)($data['project_id'] ?? 0);
        $stmt = $mysqli->prepare(
            "SELECT sps.project_student_id, sps.student_id, sps.candidate_number,
                    sps.cis_ref, sps.surname, sps.first_name,
                    sps.time_extension_percent, sps.rest_breaks, sps.notes,
                    sps.total_minutes_allowed, sps.total_minutes_used, sps.minutes_remaining
             FROM student_project_summary sps
             WHERE sps.project_id = ?
             ORDER BY sps.surname, sps.first_name"
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
     * @action      create
     * @access      Any authenticated staff member.
     * @description Creates a new student record. candidate_number must be unique
     *              across the system as it is the exam-board identifier.
     *
     * @param  string      $candidate_number  Exam board reference, e.g. LL-000020681.
     *                                        Required. Max 30 characters.
     * @param  string|null $cis_ref           Internal MIS/CIS reference. Optional.
     * @param  string      $surname           Student surname.
     * @param  string      $first_name        Student first name.
     * @return array { id: int, message: string }
     * @throws 400  If candidate_number, surname or first_name are absent, or
     *              candidate_number exceeds 30 characters.
     * @throws 409  If candidate_number already exists.
     */
    case 'create':
        $candidateNumber = trim(strip_tags($data['candidate_number'] ?? ''));
        $cisRef          = trim(strip_tags($data['cis_ref']          ?? '')) ?: null;
        $surname         = trim(strip_tags($data['surname']          ?? ''));
        $firstName       = trim(strip_tags($data['first_name']       ?? ''));

        if (!$candidateNumber || !$surname || !$firstName) {
            send_response('Candidate number, surname and first name are required.', 400);
        }
        if (strlen($candidateNumber) > 30) {
            send_response('Candidate number must be 30 characters or fewer.', 400);
        }

        $stmt = $mysqli->prepare(
            "INSERT INTO students (candidate_number, cis_ref, surname, first_name)
             VALUES (?, ?, ?, ?)"
        );
        $stmt->bind_param('ssss', $candidateNumber, $cisRef, $surname, $firstName);
        if (!$stmt->execute()) {
            log_info("Student create error: " . $stmt->error);
            send_response('Could not create student. Candidate number may already exist.', 409);
        }
        $newId = $stmt->insert_id;
        $stmt->close();
        send_response(['id' => $newId, 'message' => 'Student created.']);
        break;

    /**
     * @action      update
     * @access      Any authenticated staff member.
     * @description Updates a student's identifiers and name fields.
     *
     * @param  int         $id               Primary key.
     * @param  string      $candidate_number Updated exam board reference.
     * @param  string|null $cis_ref          Updated CIS reference (or empty to clear).
     * @param  string      $surname          Updated surname.
     * @param  string      $first_name       Updated first name.
     * @return array { message: string }
     * @throws 400  Validation failure.
     */
    case 'update':
        $id              = (int)($data['id']               ?? 0);
        $candidateNumber = trim(strip_tags($data['candidate_number'] ?? ''));
        $cisRef          = trim(strip_tags($data['cis_ref']          ?? '')) ?: null;
        $surname         = trim(strip_tags($data['surname']          ?? ''));
        $firstName       = trim(strip_tags($data['first_name']       ?? ''));

        if (!$candidateNumber || !$surname || !$firstName) {
            send_response('Candidate number, surname and first name are required.', 400);
        }

        $stmt = $mysqli->prepare(
            "UPDATE students SET candidate_number=?, cis_ref=?, surname=?, first_name=? WHERE id=?"
        );
        $stmt->bind_param('ssssi', $candidateNumber, $cisRef, $surname, $firstName, $id);
        $stmt->execute();
        $stmt->close();
        send_response(['message' => 'Student updated.']);
        break;

    /**
     * @action      deactivate
     * @access      Admin only.
     * @description Soft-deactivates a student (sets is_active = 0). The student
     *              record and all historical attendance data are preserved.
     *              Deactivated students no longer appear in enrolment or
     *              attendance lists.
     *
     * @param  int $id  Primary key of the student to deactivate.
     * @return array { message: string }
     * @throws 403  If caller is not an admin.
     */
    case 'deactivate':
        require_admin($jwtPayload);
        $id   = (int)($data['id'] ?? 0);
        $stmt = $mysqli->prepare("UPDATE students SET is_active=0 WHERE id=?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        send_response(['message' => 'Student deactivated.']);
        break;

    default:
        send_response('Unknown action.', 400);
}
