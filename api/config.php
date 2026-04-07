<?php
/**
 * OSP Hours Tracker - Frontend config endpoint
 * Returns a safe subset of settings for the React app.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$configFile = __DIR__ . '/.config.json';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Configuration file not found.']);
    exit();
}

$config = json_decode(file_get_contents($configFile), true);
$apiBase = $config['apiBase'] ?? null;

if (!$apiBase) {
    http_response_code(500);
    echo json_encode(['error' => 'apiBase is missing from configuration.']);
    exit();
}

echo json_encode(['apiBase' => $apiBase]);
