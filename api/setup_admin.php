<?php
/**
 * OSP Hours Tracker - One-time admin user creation script.
 * Run ONCE after deployment, then DELETE this file.
 *
 * @package OSPTracker
 */

require_once 'setup.php';

$username = 'admin';
$email    = 'admin@college.ac.uk';
$password = 'Admin@OSP1';
$hash     = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

$stmt = $mysqli->prepare(
    "INSERT INTO staff (username, email, password_hash, first_name, last_name, role, must_change_password, is_active)
     VALUES (?, ?, ?, 'System', 'Admin', 'admin', 1, 1)"
);
$stmt->bind_param('sss', $username, $email, $hash);

if ($stmt->execute()) {
    send_response(['message' => 'Admin user created. DELETE this file now.'], 200);
} else {
    send_response(['error' => 'Could not create admin user: ' . $stmt->error], 500);
}
$stmt->close();
