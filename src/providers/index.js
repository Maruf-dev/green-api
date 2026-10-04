/**
 * Слой провайдеров: описывает различия между GREEN-API (MAX) и Telegram Bot API,
 * чтобы остальной код приложения работал с единым интерфейсом.
 *
 * Общий интерфейс провайдера:
 *   id, appTitle, brandLetter          — оформление
 *   refLabel/refPlaceholder/refHint    — подсказки в диалоге нового чата
 *   normalizeRef(input)                — нормализация введённого получателя
 *   connect(creds)                     — проверка учётных данных (вход)
 *   initialSetup(creds)                — (GREEN-API) включение HTTP API
 *   resolveChat(creds, ref)            — получить { chatId, name, username }
 *   send(creds, chatId, text)          — отправить { id, ts }
 *   parseEvent(event)                  — превратить уведомление в { chatId, message, displayName }
 */
import {
  checkAccount,
  getStateInstance,
  sendMessage as greenSendMessage,
  setSettings,
} from '../api/greenApi.js';
import { getChat, getMe, sendMessage as telegramSendMessage } from '../api/telegramApi.js';
import { formatPhone, normalizePhone } from '../utils/phone.js';
import { chatDisplayName, normalizeChatRef } from '../utils/telegram.js';

/** Провайдер MAX через GREEN-API (полностью соответствует ТЗ). */
export const greenProvider = {
  id: 'green',
  appTitle: 'MAX Chat',
  brandLetter: 'M',
  authNote: 'учётные данные инстанса GREEN-API',
  refLabel: 'Номер телефона',
  refPlaceholder: '+7 999 123-45-67',
  refHint:
    'Укажите номер телефона получателя в мессенджере MAX. Поддерживаются номера РФ (+7) и РБ (+375).',
  supportsAutoSetup: true,

  normalizeRef: normalizePhone,

  async connect(creds) {
    await getStateInstance(creds);
    return { label: `инстанс ${creds.idInstance}` };
  },

  async initialSetup(creds) {
    await setSettings(creds, {
      webhookUrl: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'no',
      stateWebhook: 'no',
    });
  },

  async resolveChat(creds, ref) {
    const result = await checkAccount(creds, ref);
    if (!result || !result.exist || !result.chatId) {
      throw new Error('У этого номера нет аккаунта MAX');
    }
    return { chatId: String(result.chatId), name: formatPhone(ref), username: '' };
  },

  async send(creds, chatId, text) {
    const res = await greenSendMessage(creds, chatId, text);
    return { id: res && res.idMessage ? String(res.idMessage) : null, ts: Date.now() };
  },

  parseEvent(notification) {
    const body = notification && notification.body;
    if (!body || body.typeWebhook !== 'incomingMessageReceived') return null;

    const messageData = body.messageData || {};
    if (messageData.typeMessage !== 'textMessage') return null; // только текст
    const text = messageData.textMessageData && messageData.textMessageData.textMessage;
    if (!text) return null;

    const sender = body.senderData || {};
    const chatId = String(sender.chatId || sender.sender || '');
    if (!chatId) return null;

    const id = body.idMessage ? String(body.idMessage) : `in-${notification.receiptId}`;
    const ts = body.timestamp ? body.timestamp * 1000 : Date.now();
    const displayName =
      sender.chatName ||
      sender.senderName ||
      (sender.senderPhoneNumber ? `+${sender.senderPhoneNumber}` : '');

    return { chatId, message: { id, direction: 'in', text, ts }, displayName };
  },
};

/** Провайдер Telegram через Bot API (токен от @BotFather, запросы идут через прокси). */
export const telegramProvider = {
  id: 'telegram',
  appTitle: 'Telegram Chat',
  brandLetter: '✈️',
  authNote: 'токен бота из @BotFather',
  refLabel: 'ID чата или @username',
  refPlaceholder: '123456789 или @username',
  refHint:
    'Укажите числовой id чата или @username. Бот может писать только тем, кто уже написал ему первым, либо в публичные каналы и группы, где он состоит.',
  supportsAutoSetup: false,

  normalizeRef: normalizeChatRef,

  async connect(creds) {
    const me = await getMe(creds);
    return {
      label: me.username ? `@${me.username}` : me.first_name,
      info: me,
    };
  },

  async resolveChat(creds, ref) {
    const chat = await getChat(creds, ref);
    return {
      chatId: String(chat.id),
      name: chatDisplayName(chat),
      username: chat.username || '',
    };
  },

  async send(creds, chatId, text) {
    const m = await telegramSendMessage(creds, chatId, text);
    return {
      id: m && m.message_id != null ? `out-${m.message_id}` : null,
      ts: m && m.date ? m.date * 1000 : Date.now(),
    };
  },

  parseEvent(update) {
    const message = update && (update.message || update.edited_message);
    if (!message || typeof message.text !== 'string') return null; // только текст

    const chat = message.chat || {};
    if (chat.id == null) return null;

    const id = `in-${message.message_id}`;
    const ts = message.date ? message.date * 1000 : Date.now();
    return {
      chatId: String(chat.id),
      message: { id, direction: 'in', text: message.text, ts },
      displayName: chatDisplayName(chat),
    };
  },
};

export const PROVIDERS = {
  green: greenProvider,
  telegram: telegramProvider,
};

/** Возвращает провайдер по id (по умолчанию — GREEN-API/MAX). */
export function getProvider(id) {
  return PROVIDERS[id] || greenProvider;
}

/** Подпись под названием приложения (например, «инстанс 110100001» или «@mybot»). */
export function providerSubtitle(creds) {
  if (!creds) return '';
  if (creds.provider === 'telegram') {
    if (creds.info && creds.info.username) return `@${creds.info.username}`;
    return 'бот';
  }
  return `инстанс ${creds.idInstance}`;
}
