<?php
/**
 * OSP Hours Tracker - JWT helpers (hand-rolled HS256, no Composer).
 *
 * @package OSPTracker
 */

/**
 * Encode a JWT using HS256.
 *
 * @param array  $payload  Claims to encode.
 * @param string $secret   HMAC secret.
 * @return string Signed JWT string.
 */
function jwt_encode(array $payload, string $secret): string
{
    $header    = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload   = base64url_encode(json_encode($payload));
    $signature = base64url_encode(hash_hmac('sha256', "$header.$payload", $secret, true));
    return "$header.$payload.$signature";
}

/**
 * Decode and verify a JWT. Returns null if invalid or expired.
 *
 * @param string $token   JWT string.
 * @param string $secret  HMAC secret.
 * @return array|null Decoded payload, or null on failure.
 */
function jwt_decode(string $token, string $secret): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    $expected = base64url_encode(hash_hmac('sha256', "$header.$payload", $secret, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);
    if (isset($data['exp']) && $data['exp'] < time()) return null;
    return $data;
}

/**
 * URL-safe Base64 encode without padding.
 *
 * @param string $data Raw bytes.
 * @return string Base64url encoded string.
 */
function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Require a valid Bearer JWT in the Authorization header.
 * Calls send_response(401) and exits if auth fails.
 *
 * @param array $config  App config (needs jwt_secret key).
 * @return array Decoded JWT payload.
 */
function require_auth(array $config): array
{
    $headers = getallheaders();
    $auth    = $headers['Authorization'] ?? '';
    if (!str_starts_with($auth, 'Bearer ')) {
        send_response('Unauthorised', 401);
    }
    $token   = substr($auth, 7);
    $payload = jwt_decode($token, $config['jwt_secret']);
    if (!$payload) send_response('Token invalid or expired', 401);
    return $payload;
}

/**
 * Require admin role. Exits with 403 if role is not admin.
 *
 * @param array $jwtPayload  Decoded JWT payload.
 * @return void
 */
function require_admin(array $jwtPayload): void
{
    if (($jwtPayload['role'] ?? '') !== 'admin') {
        send_response('Forbidden: admin access required', 403);
    }
}

/**
 * Generate a random alphanumeric password of given length.
 *
 * @param int $length  Desired password length.
 * @return string Random password.
 */
function generate_temp_password(int $length = 12): string
{
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    $pass  = '';
    for ($i = 0; $i < $length; $i++) {
        $pass .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $pass;
}
