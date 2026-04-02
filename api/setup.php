<?php
/**
 * OSP Hours Tracker - Bootstrap / Setup
 *
 * Include at the top of every endpoint file.
 * Sets CORS headers, reads .config.json, opens the DB connection,
 * and provides shared helper functions.
 *
 * @package OSPTracker
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Load configuration
$configFile = __DIR__ . '/.config.json';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Configuration file not found.']);
    exit();
}
$config = json_decode(file_get_contents($configFile), true);

// Database connection
$mysqli = new mysqli(
    $config['servername'],
    $config['username'],
    $config['password'],
    $config['dbname']
);

if ($mysqli->connect_error) {
    log_info('DB connection failed: ' . $mysqli->connect_error);
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed.']);
    exit();
}
$mysqli->set_charset('utf8mb4');

// Read request body
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?? [];

/**
 * Send a JSON response and exit.
 *
 * @param mixed $payload  Data to encode, or a plain string message.
 * @param int   $status   HTTP status code (default 200).
 * @return void
 */
function send_response($payload, int $status = 200): void
{
    http_response_code($status);
    if (is_string($payload)) {
        echo json_encode(['message' => $payload]);
    } else {
        echo json_encode($payload);
    }
    exit();
}

/**
 * Write a line to server.log in the current working directory.
 *
 * @param string $log  Message to log.
 * @return void
 */
function log_info(string $log): void
{
    $currentDirectory = getcwd();
    $file = $currentDirectory . '/server.log';
    $currentDateTime = date('Y-m-d H:i:s');
    file_put_contents($file, $currentDateTime . ' : ' . $log . PHP_EOL, FILE_APPEND);
}

log_info('Request: ' . ($_SERVER['REQUEST_METHOD'] ?? '') . ' ' . ($_SERVER['REQUEST_URI'] ?? ''));
