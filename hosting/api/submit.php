<?php

declare(strict_types=1);

const MAX_REQUEST_BYTES = 65536;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 900;

header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

$allowedOrigins = [
    'https://spetstehosnastka.by',
    'https://www.spetstehosnastka.by',
    'https://razilkik-ops.github.io',
];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? rtrim((string) $_SERVER['HTTP_ORIGIN'], '/') : '';

if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
    respond(403, ['ok' => false, 'message' => 'Запрос отклонён. Обновите страницу и попробуйте снова.']);
}

if ($origin !== '') {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept');
    header('Vary: Origin');
}

$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($method !== 'POST') {
    header('Allow: POST, OPTIONS');
    respond(405, ['ok' => false, 'message' => 'Для отправки заявки используйте форму на сайте.']);
}

$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
if ($contentLength > MAX_REQUEST_BYTES) {
    respond(413, ['ok' => false, 'message' => 'Заявка слишком большая. Сократите описание и попробуйте снова.']);
}

$contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
if (strpos($contentType, 'application/json') !== false) {
    $rawBody = file_get_contents('php://input', false, null, 0, MAX_REQUEST_BYTES + 1);
    if ($rawBody === false || strlen($rawBody) > MAX_REQUEST_BYTES) {
        respond(413, ['ok' => false, 'message' => 'Заявка слишком большая.']);
    }
    $payload = json_decode($rawBody, true);
    if (!is_array($payload) || json_last_error() !== JSON_ERROR_NONE) {
        respond(400, ['ok' => false, 'message' => 'Не удалось прочитать заявку. Обновите страницу и попробуйте снова.']);
    }
} else {
    $payload = $_POST;
}

if (cleanSingleLine($payload['website'] ?? '', 200) !== '') {
    respond(200, ['ok' => true, 'message' => 'Спасибо! Заявка отправлена.']);
}

$name = cleanSingleLine($payload['name'] ?? '', 80);
$phone = cleanSingleLine($payload['phone'] ?? '', 32);
$email = cleanSingleLine($payload['email'] ?? '', 120);
$service = cleanSingleLine($payload['service'] ?? '', 120);
$message = cleanMultiline($payload['message'] ?? '', 2000);
$source = validatedSource($payload['source'] ?? '');
$consent = in_array($payload['consent'] ?? null, [true, 1, '1', 'on', 'yes'], true);

$errors = [];
if (textLength($name) < 2) {
    $errors['name'] = 'Укажите имя.';
}
$phoneDigits = preg_replace('/\D+/u', '', $phone) ?? '';
if (preg_match('/[^0-9+()\-\.\s]/u', $phone) || strlen($phoneDigits) < 7 || strlen($phoneDigits) > 18) {
    $errors['phone'] = 'Проверьте номер телефона.';
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Проверьте адрес электронной почты.';
}
if (textLength($message) < 10) {
    $errors['message'] = 'Опишите задачу хотя бы в 10 символах.';
}
if (!$consent) {
    $errors['consent'] = 'Необходимо согласие на обработку данных.';
}
if ($errors !== []) {
    respond(422, ['ok' => false, 'message' => 'Проверьте заполнение обязательных полей.', 'errors' => $errors]);
}

$remoteAddress = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
if (!consumeRateLimit($remoteAddress)) {
    header('Retry-After: ' . RATE_LIMIT_WINDOW);
    respond(429, ['ok' => false, 'message' => 'Слишком много заявок. Попробуйте через 15 минут или позвоните нам.']);
}

$config = loadTelegramConfig();
if ($config === null) {
    error_log('Spetstehosnastka form: Telegram configuration is missing or invalid.');
    respond(503, ['ok' => false, 'message' => 'Отправка временно недоступна. Пожалуйста, позвоните нам.']);
}

$telegramMessage = implode("\n", [
    '<b>Новая заявка с сайта</b>',
    '',
    '<b>Имя:</b> ' . escapeTelegram($name),
    '<b>Телефон:</b> ' . escapeTelegram($phone),
    '<b>E-mail:</b> ' . ($email !== '' ? escapeTelegram($email) : 'не указан'),
    '<b>Услуга:</b> ' . ($service !== '' ? escapeTelegram($service) : 'не выбрана'),
    '<b>Задача:</b> ' . escapeTelegram($message),
    '<b>Страница:</b> ' . ($source !== '' ? escapeTelegram($source) : 'не указана'),
]);

if (!sendTelegramMessage($config['bot_token'], $config['chat_id'], $telegramMessage)) {
    error_log('Spetstehosnastka form: Telegram API request failed.');
    respond(502, ['ok' => false, 'message' => 'Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.']);
}

respond(201, ['ok' => true, 'message' => 'Спасибо! Заявка отправлена. Мы свяжемся с вами в рабочее время.']);

function respond(int $status, array $body): void
{
    http_response_code($status);
    $accept = strtolower((string) ($_SERVER['HTTP_ACCEPT'] ?? ''));
    if (strpos($accept, 'text/html') !== false && strpos($accept, 'application/json') === false) {
        header('Content-Type: text/html; charset=UTF-8');
        $title = !empty($body['ok']) ? 'Заявка отправлена' : 'Не удалось отправить заявку';
        $message = htmlspecialchars((string) ($body['message'] ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        echo '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' . $title . '</title></head><body><main><h1>' . $title . '</h1><p>' . $message . '</p><p><a href="https://spetstehosnastka.by/">Вернуться на сайт</a> · <a href="tel:+375447844193">Позвонить</a></p></main></body></html>';
        exit;
    }
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cleanSingleLine($value, int $maxLength): string
{
    $text = trim(strip_tags(is_scalar($value) ? (string) $value : ''));
    $text = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $text) ?? '';
    $text = preg_replace('/\s+/u', ' ', $text) ?? '';
    return truncateText($text, $maxLength);
}

function cleanMultiline($value, int $maxLength): string
{
    $text = trim(strip_tags(is_scalar($value) ? (string) $value : ''));
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? '';
    $text = preg_replace('/[ \t]+/u', ' ', $text) ?? '';
    $text = preg_replace('/\n{3,}/u', "\n\n", $text) ?? '';
    return truncateText($text, $maxLength);
}

function textLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function truncateText(string $value, int $maxLength): string
{
    if (textLength($value) <= $maxLength) {
        return $value;
    }
    return function_exists('mb_substr') ? mb_substr($value, 0, $maxLength, 'UTF-8') : substr($value, 0, $maxLength);
}

function validatedSource($value): string
{
    $source = cleanSingleLine($value, 500);
    if ($source === '' || !filter_var($source, FILTER_VALIDATE_URL)) {
        return '';
    }
    $host = strtolower((string) parse_url($source, PHP_URL_HOST));
    return in_array($host, ['spetstehosnastka.by', 'www.spetstehosnastka.by', 'razilkik-ops.github.io'], true) ? $source : '';
}

function consumeRateLimit(string $remoteAddress): bool
{
    $directory = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'spetstehosnastka-form-rate';
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        return false;
    }
    $file = $directory . DIRECTORY_SEPARATOR . hash('sha256', $remoteAddress) . '.json';
    $handle = @fopen($file, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        return false;
    }
    $raw = stream_get_contents($handle);
    $timestamps = json_decode($raw !== false ? $raw : '[]', true);
    $timestamps = is_array($timestamps) ? $timestamps : [];
    $now = time();
    $timestamps = array_values(array_filter($timestamps, static function ($timestamp) use ($now): bool {
        return is_int($timestamp) && $timestamp > $now - RATE_LIMIT_WINDOW;
    }));
    if (count($timestamps) >= RATE_LIMIT_MAX) {
        flock($handle, LOCK_UN);
        fclose($handle);
        return false;
    }
    $timestamps[] = $now;
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($timestamps));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return true;
}

function loadTelegramConfig(): ?array
{
    $botToken = trim((string) getenv('TELEGRAM_BOT_TOKEN'));
    $chatId = trim((string) getenv('TELEGRAM_CHAT_ID'));
    $privateConfigPath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'telegram.env';
    if (($botToken === '' || $chatId === '') && is_readable($privateConfigPath)) {
        $privateConfig = parseEnvironmentFile($privateConfigPath);
        $botToken = trim((string) ($privateConfig['TELEGRAM_BOT_TOKEN'] ?? $botToken));
        $chatId = trim((string) ($privateConfig['TELEGRAM_CHAT_ID'] ?? $chatId));
    }
    if (!preg_match('/^\d+:[A-Za-z0-9_-]{30,}$/D', $botToken) || !preg_match('/^-?\d+$/D', $chatId)) {
        return null;
    }
    return ['bot_token' => $botToken, 'chat_id' => $chatId];
}

function parseEnvironmentFile(string $path): array
{
    $result = [];
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return $result;
    }
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0 || strpos($line, '=') === false) {
            continue;
        }
        [$key, $value] = array_map('trim', explode('=', $line, 2));
        if (!in_array($key, ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'], true)) {
            continue;
        }
        if (strlen($value) >= 2 && (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'"))) {
            $value = substr($value, 1, -1);
        }
        $result[$key] = $value;
    }
    return $result;
}

function escapeTelegram(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function sendTelegramMessage(string $botToken, string $chatId, string $message): bool
{
    if (!function_exists('curl_init')) {
        return false;
    }
    $handle = curl_init('https://api.telegram.org/bot' . $botToken . '/sendMessage');
    if ($handle === false) {
        return false;
    }
    $requestBody = json_encode([
        'chat_id' => $chatId,
        'text' => $message,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $requestBody,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $response = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);
    if (!is_string($response) || $status !== 200) {
        return false;
    }
    $decoded = json_decode($response, true);
    return is_array($decoded) && ($decoded['ok'] ?? false) === true;
}
