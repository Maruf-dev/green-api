/**
 * Тонкий клиент для API мессенджера MAX от GREEN-API (версия v3).
 *
 * Формат адреса запроса (см. https://green-api.com/v3/docs/request-format/):
 *   {apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}
 *
 * Все методы вызываются напрямую из браузера: GREEN-API отдаёт заголовок
 * Access-Control-Allow-Origin: *, поэтому отдельный backend не нужен.
 */

export const DEFAULT_API_URL = 'https://api.green-api.com';

/** Готовит базовый адрес инстанса. */
function instanceBase(creds) {
  const host = (creds.apiUrl || DEFAULT_API_URL).trim().replace(/\/+$/, '');
  return `${host}/waInstance${creds.idInstance}`;
}

/** Разбирает ответ: возвращает JSON или бросает понятную ошибку. */
async function parseResponse(res) {
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
        ? data.message || data.error || data.reason || JSON.stringify(data)
        : data || res.statusText;
    const error = new Error(`HTTP ${res.status}: ${details || 'ошибка запроса'}`);
    error.status = res.status;
    error.payload = data;
    throw error;
  }

  return data;
}

/** POST JSON запрос на метод инстанса. */
async function post(creds, method, body) {
  const res = await fetch(`${instanceBase(creds)}/${method}/${creds.apiTokenInstance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return parseResponse(res);
}

/** GET запрос на метод инстанса. */
async function get(creds, method) {
  const res = await fetch(`${instanceBase(creds)}/${method}/${creds.apiTokenInstance}`);
  return parseResponse(res);
}

/**
 * Получить состояние инстанса.
 * https://green-api.com/v3/docs/api/account/GetStateInstance/
 * @returns {Promise<{stateInstance: string}>}
 */
export function getStateInstance(creds) {
  return get(creds, 'getStateInstance');
}

/**
 * Настроить получение входящих уведомлений по технологии HTTP API.
 * Пустой webhookUrl + incomingWebhook = yes.
 * https://green-api.com/v3/docs/api/receiving/technology-http-api/
 */
export function setSettings(creds, settings) {
  return post(creds, 'setSettings', settings);
}

/**
 * Проверить наличие MAX у номера телефона и получить chatId.
 * https://green-api.com/v3/docs/api/service/CheckAccount/
 * @param {string|number} phoneNumber номер в формате 7XXXXXXXXXX или 375XXXXXXXXX
 * @returns {Promise<{exist: boolean, chatId: string, fromCache: boolean}>}
 */
export function checkAccount(creds, phoneNumber) {
  return post(creds, 'checkAccount', { phoneNumber: Number(phoneNumber) });
}

/**
 * Отправить текстовое сообщение.
 * https://green-api.com/v3/docs/api/sending/SendMessage/
 * @returns {Promise<{idMessage: string}>}
 */
export function sendMessage(creds, chatId, message) {
  return post(creds, 'sendMessage', { chatId: String(chatId), message: String(message) });
}

/**
 * Получить входящее уведомление (одно, FIFO).
 * Возвращает объект уведомления или null, если очередь пуста.
 * https://green-api.com/v3/docs/api/receiving/technology-http-api/ReceiveNotification/
 * @returns {Promise<{receiptId: number, body: object} | null>}
 */
export async function receiveNotification(creds) {
  const data = await get(creds, 'receiveNotification');
  if (!data || typeof data !== 'object' || data.receiptId == null) {
    return null;
  }
  return data;
}

/**
 * Подтвердить получение уведомления (удалить из очереди).
 * https://green-api.com/v3/docs/api/receiving/technology-http-api/DeleteNotification/
 */
export async function deleteNotification(creds, receiptId) {
  const res = await fetch(
    `${instanceBase(creds)}/deleteNotification/${creds.apiTokenInstance}/${receiptId}`,
    { method: 'DELETE' },
  );
  return parseResponse(res);
}
