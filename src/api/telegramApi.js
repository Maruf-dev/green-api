/**
 * Тонкий клиент для Telegram Bot API через локальный прокси (server.mjs).
 *
 * Браузер не может обращаться к https://api.telegram.org напрямую из-за отсутствия
 * CORS-заголовков, поэтому все запросы идут на локальный прокси по адресу apiBase
 * (по умолчанию "/api" — в dev его проксирует Vite, в проде отдаёт server.mjs).
 */

export const DEFAULT_API_BASE = '/api';

/** Базовый адрес прокси без завершающих слешей. */
function apiBase(creds) {
  const base = creds && creds.apiBase ? String(creds.apiBase) : DEFAULT_API_BASE;
  return base.trim().replace(/\/+$/, '') || DEFAULT_API_BASE;
}

/** Превращает ответ Telegram { ok:false, error_code, description } в Error. */
function telegramError(data, fallback) {
  const error = new Error((data && data.description) || fallback);
  if (data && data.error_code) error.status = data.error_code;
  error.payload = data;
  return error;
}

/** POST-запрос на прокси. Возвращает разобранный JSON (или бросает понятную ошибку). */
async function post(creds, endpoint, body, options = {}) {
  let res;
  try {
    res = await fetch(`${apiBase(creds)}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: creds.token, ...body }),
      signal: options.signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new Error(
      'Нет связи с локальным прокси. Запустите `npm run dev:all` (разработка) или `npm start` (прод).',
    );
  }

  const raw = await res.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!res.ok) {
    const details =
      data && typeof data === 'object'
        ? data.description || data.error || JSON.stringify(data)
        : data || res.statusText;
    const error = new Error(`HTTP ${res.status}: ${details || 'ошибка запроса'}`);
    error.status = res.status;
    error.payload = data;
    throw error;
  }

  return data;
}

/**
 * getMe — проверка токена и получение данных бота.
 * https://core.telegram.org/bots/api#getme
 */
export async function getMe(creds, options) {
  const data = await post(creds, 'me', {}, options);
  if (!data || data.ok !== true) {
    throw telegramError(data, 'Не удалось получить данные бота');
  }
  return data.result;
}

/**
 * getUpdates — забирает входящие обновления (long polling).
 * Возвращает «конверт» Telegram как есть: { ok, result, description? }.
 * https://core.telegram.org/bots/api#getupdates
 */
export function getUpdates(creds, { offset, timeout = 25, signal } = {}) {
  return post(creds, 'updates', { offset, timeout }, { signal });
}

/**
 * sendMessage — отправляет текстовое сообщение.
 * https://core.telegram.org/bots/api#sendmessage
 */
export async function sendMessage(creds, chatId, text) {
  const data = await post(creds, 'send', { chatId: String(chatId), text: String(text) });
  if (!data || data.ok !== true) {
    throw telegramError(data, 'Не удалось отправить сообщение');
  }
  return data.result;
}

/**
 * getChat — сведения о чате по числовому id или @username.
 * https://core.telegram.org/bots/api#getchat
 */
export async function getChat(creds, chatRef) {
  const data = await post(creds, 'chat', { chatId: String(chatRef) });
  if (!data || data.ok !== true) {
    throw telegramError(data, 'Чат не найден');
  }
  return data.result;
}
