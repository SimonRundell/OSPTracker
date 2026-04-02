<?php
/**
 * OSP Hours Tracker - Authentication endpoint.
 *
 * Handles login and password change for all staff members.
 * The 'login' action is public; all other actions require a valid Bearer JWT
 * in the Authorization header.
 *
 * All requests must POST a JSON body: { "action": "<name>", ...params }
 *
 * @package  OSPTracker
 * @author   Simon Rundell, Exeter College / CodeMonkey Design Ltd.
 * @version  1.0
 * @see      jwt_helpers.php  JWT encoding/decoding utilities.
 */

require_once 'setup.php';
require_once 'jwt_helpers.php';

$action = $data['action'] ?? '';

switch ($action) {

    // -------------------------------------------------------------------------
    /**
     * @action      login
     * @access      Public — no token required.
     * @description Authenticates a staff member. Verifies the bcrypt password
     *              hash, updates last_login, and issues a signed 8-hour JWT.
     *              If must_change_password === 1 on the returned staff object,
     *              the client MUST redirect to /change-password before allowing
     *              access to any other route.
     *
     * @param  string $username  Plain-text username (must match an is_active row).
     * @param  string $password  Plain-text password.
     * @return array {
     *   string $token  Signed HS256 JWT. Payload: { sub (staff_id), role,
     *                  must_change_password, exp }.
     *   array  $staff  { id, username, first_name, last_name, role,
     *                    must_change_password }
     * }
     * @throws 400  If username or password are absent.
     * @throws 401  If credentials are invalid or the account is inactive.
     */
    case 'login':
        $username = trim(strip_tags($data['username'] ?? ''));
        $password = $data['password'] ?? '';

        if (!$username || !$password) {
            log_info("Login failed (missing credentials) from " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
            send_response('Username and password are required.', 400);
        }

        $stmt = $mysqli->prepare(
            "SELECT id, username, email, first_name, last_name, role,
                    password_hash, must_change_password, is_active
             FROM staff WHERE username = ? LIMIT 1"
        );
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $result = $stmt->get_result();
        $staff  = $result->fetch_assoc();
        $stmt->close();

        if (!$staff || !$staff['is_active'] || !password_verify($password, $staff['password_hash'])) {
            log_info("Login failed for username '$username' from " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
            send_response('Invalid username or password.', 401);
        }

        // Update last_login
        $upd = $mysqli->prepare("UPDATE staff SET last_login = NOW() WHERE id = ?");
        $upd->bind_param('i', $staff['id']);
        $upd->execute();
        $upd->close();

        $exp   = time() + (8 * 3600);
        $token = jwt_encode([
            'sub'                 => $staff['id'],
            'role'                => $staff['role'],
            'must_change_password'=> (int)$staff['must_change_password'],
            'exp'                 => $exp,
        ], $config['jwt_secret']);

        log_info("Login SUCCESS for username '$username' from " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
        send_response([
            'token' => $token,
            'staff' => [
                'id'                  => $staff['id'],
                'username'            => $staff['username'],
                'first_name'          => $staff['first_name'],
                'last_name'           => $staff['last_name'],
                'role'                => $staff['role'],
                'must_change_password'=> (int)$staff['must_change_password'],
            ],
        ]);
        break;

    // -------------------------------------------------------------------------
    /**
     * @action      change_password
     * @access      Any authenticated staff member (any role).
     * @description Verifies the existing password, then replaces it with a new
     *              bcrypt hash (cost 12) and clears must_change_password.
     *              The client should log out immediately after success so that
     *              the next login issues a fresh JWT without the flag set.
     *
     * Password rules enforced server-side independently of client validation:
     *   - Minimum 8 characters
     *   - At least one uppercase ASCII letter  [A-Z]
     *   - At least one ASCII digit             [0-9]
     *
     * @param  string $current_password  The staff member's existing password.
     * @param  string $new_password      The desired replacement password.
     * @return array { message: string }
     * @throws 400  If either field is absent or new password fails the rules.
     * @throws 401  If current_password does not match the stored hash.
     */
    case 'change_password':
        $jwtPayload      = require_auth($config);
        $staffId         = $jwtPayload['sub'];
        $currentPassword = $data['current_password'] ?? '';
        $newPassword     = $data['new_password'] ?? '';

        if (!$currentPassword || !$newPassword) {
            send_response('Both current and new password are required.', 400);
        }
        if (strlen($newPassword) < 8 || !preg_match('/[A-Z]/', $newPassword) || !preg_match('/[0-9]/', $newPassword)) {
            send_response('New password must be at least 8 characters with one uppercase letter and one digit.', 400);
        }

        $stmt = $mysqli->prepare("SELECT password_hash FROM staff WHERE id = ?");
        $stmt->bind_param('i', $staffId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row || !password_verify($currentPassword, $row['password_hash'])) {
            send_response('Current password is incorrect.', 401);
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
        $upd     = $mysqli->prepare(
            "UPDATE staff SET password_hash = ?, must_change_password = 0 WHERE id = ?"
        );
        $upd->bind_param('si', $newHash, $staffId);
        $upd->execute();
        $upd->close();

        log_info("Password changed for staff_id=$staffId");
        send_response(['message' => 'Password changed successfully.']);
        break;

    // -------------------------------------------------------------------------
    default:
        send_response('Unknown action.', 400);
}
