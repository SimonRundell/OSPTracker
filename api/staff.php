<?php
/**
 * OSP Hours Tracker - Staff management endpoint.
 * Actions: get_all, get_one, create, update, reset_password, delete
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
     * @description Returns all staff members ordered by last_name, first_name.
     *              Inactive accounts are included so admins can see the full list.
     *
     * @param  void
     * @return array[] Array of staff objects, each containing:
     *   { id, username, email, first_name, last_name, role, is_active,
     *     must_change_password, last_login, created_at }
     */
    case 'get_all':
        $result = $mysqli->query(
            "SELECT id, username, email, first_name, last_name, role,
                    is_active, must_change_password, last_login, created_at
             FROM staff ORDER BY last_name, first_name"
        );
        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        send_response($rows);
        break;

    /**
     * @action      get_one
     * @access      Any authenticated staff member.
     * @description Returns a single staff member by primary key.
     *
     * @param  int $id  Primary key of the staff record.
     * @return array Staff object: { id, username, email, first_name, last_name,
     *                               role, is_active, must_change_password,
     *                               last_login, created_at }
     * @throws 404  If no staff member exists with the given id.
     */
    case 'get_one':
        $id   = (int)($data['id'] ?? 0);
        $stmt = $mysqli->prepare(
            "SELECT id, username, email, first_name, last_name, role,
                    is_active, must_change_password, last_login, created_at
             FROM staff WHERE id = ?"
        );
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$row) send_response('Staff member not found.', 404);
        send_response($row);
        break;

    /**
     * @action      create
     * @access      Admin only.
     * @description Creates a new staff account with a randomly generated 12-char
     *              temporary password (bcrypt cost 12). Sets must_change_password = 1.
     *              The plain temporary password is returned ONCE in the response —
     *              it is never stored and cannot be recovered.
     *
     * @param  string $username    Unique login username.
     * @param  string $email       Unique email address.
     * @param  string $first_name  Staff member's first name.
     * @param  string $last_name   Staff member's last name.
     * @param  string $role        'admin' or 'staff' (defaults to 'staff').
     * @return array { id: int, temp_password: string, message: string }
     * @throws 400  If any required field is missing.
     * @throws 403  If caller is not an admin.
     * @throws 409  If username or email already exists.
     */
    case 'create':
        require_admin($jwtPayload);
        $username   = trim(strip_tags($data['username']   ?? ''));
        $email      = trim(strip_tags($data['email']      ?? ''));
        $firstName  = trim(strip_tags($data['first_name'] ?? ''));
        $lastName   = trim(strip_tags($data['last_name']  ?? ''));
        $role       = in_array($data['role'] ?? '', ['admin','staff']) ? $data['role'] : 'staff';

        if (!$username || !$email || !$firstName || !$lastName) {
            send_response('All fields are required.', 400);
        }

        $tempPass = generate_temp_password(12);
        $hash     = password_hash($tempPass, PASSWORD_BCRYPT, ['cost' => 12]);

        $stmt = $mysqli->prepare(
            "INSERT INTO staff (username, email, password_hash, first_name, last_name, role, must_change_password)
             VALUES (?, ?, ?, ?, ?, ?, 1)"
        );
        $stmt->bind_param('ssssss', $username, $email, $hash, $firstName, $lastName, $role);
        if (!$stmt->execute()) {
            log_info("Staff create error: " . $stmt->error);
            send_response('Could not create staff member. Username or email may already exist.', 409);
        }
        $newId = $stmt->insert_id;
        $stmt->close();

        log_info("Staff created: id=$newId username=$username by staff_id={$jwtPayload['sub']}");
        send_response(['id' => $newId, 'temp_password' => $tempPass, 'message' => 'Staff member created.']);
        break;

    /**
     * @action      update
     * @access      Admin only.
     * @description Updates a staff member's editable fields. Username cannot be
     *              changed after creation. Password is managed via reset_password.
     *
     * @param  int    $id         Primary key of the staff record to update.
     * @param  string $email      New email address.
     * @param  string $first_name Updated first name.
     * @param  string $last_name  Updated last name.
     * @param  string $role       'admin' or 'staff'.
     * @param  int    $is_active  1 = active, 0 = deactivated.
     * @return array { message: string }
     * @throws 403  If caller is not an admin.
     */
    case 'update':
        require_admin($jwtPayload);
        $id        = (int)($data['id']         ?? 0);
        $email     = trim(strip_tags($data['email']      ?? ''));
        $firstName = trim(strip_tags($data['first_name'] ?? ''));
        $lastName  = trim(strip_tags($data['last_name']  ?? ''));
        $role      = in_array($data['role'] ?? '', ['admin','staff']) ? $data['role'] : 'staff';
        $isActive  = isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1;

        $stmt = $mysqli->prepare(
            "UPDATE staff SET email=?, first_name=?, last_name=?, role=?, is_active=? WHERE id=?"
        );
        $stmt->bind_param('ssssii', $email, $firstName, $lastName, $role, $isActive, $id);
        $stmt->execute();
        $stmt->close();
        send_response(['message' => 'Staff member updated.']);
        break;

    /**
     * @action      reset_password
     * @access      Admin only.
     * @description Generates a new random 12-char temporary password for the
     *              specified staff member, hashes it, and sets
     *              must_change_password = 1. The plain temporary password is
     *              returned once in the response for the admin to communicate
     *              securely to the staff member.
     *
     * @param  int $id  Primary key of the staff member whose password to reset.
     * @return array { temp_password: string, message: string }
     * @throws 403  If caller is not an admin.
     */
    case 'reset_password':
        require_admin($jwtPayload);
        $id      = (int)($data['id'] ?? 0);
        $tmpPass = generate_temp_password(12);
        $hash    = password_hash($tmpPass, PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt    = $mysqli->prepare(
            "UPDATE staff SET password_hash=?, must_change_password=1 WHERE id=?"
        );
        $stmt->bind_param('si', $hash, $id);
        $stmt->execute();
        $stmt->close();
        log_info("Password reset for staff_id=$id by admin {$jwtPayload['sub']}");
        send_response(['temp_password' => $tmpPass, 'message' => 'Password reset.']);
        break;

    /**
     * @action      delete
     * @access      Admin only.
     * @description Soft-deactivates a staff member (sets is_active = 0). The
     *              record and all associated data are preserved. This action is
     *              blocked if the target is the only remaining active admin,
     *              to prevent accidental lockout.
     *
     * @param  int $id  Primary key of the staff member to deactivate.
     * @return array { message: string }
     * @throws 403  If caller is not an admin.
     * @throws 409  If deactivating would remove the last active admin.
     */
    case 'delete':
        require_admin($jwtPayload);
        $id = (int)($data['id'] ?? 0);

        // Prevent deleting the only admin
        $chk = $mysqli->query("SELECT COUNT(*) AS cnt FROM staff WHERE role='admin' AND is_active=1");
        $cnt = (int)$chk->fetch_assoc()['cnt'];
        $self = $mysqli->prepare("SELECT role FROM staff WHERE id=?");
        $self->bind_param('i', $id);
        $self->execute();
        $target = $self->get_result()->fetch_assoc();
        $self->close();
        if ($target && $target['role'] === 'admin' && $cnt <= 1) {
            send_response('Cannot deactivate the only admin account.', 409);
        }

        $stmt = $mysqli->prepare("UPDATE staff SET is_active=0 WHERE id=?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        send_response(['message' => 'Staff member deactivated.']);
        break;

    default:
        send_response('Unknown action.', 400);
}
