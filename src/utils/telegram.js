/** Утилиты для работы с объектами Telegram (Chat / User). */

/** Человекочитаемое имя чата или пользователя. */
export function chatDisplayName(chat) {
  if (!chat) return '';
  const fullName = [chat.first_name, chat.last_name].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (chat.title) return chat.title;
  if (chat.username) return `@${chat.username}`;
  if (chat.id != null) return `Чат ${chat.id}`;
  return 'Без имени';
}

/**
 * Нормализует введённую ссылку на чат.
 * Понимает: числовой id, @username, bare username, ссылки t.me/... .
 * getChat принимает только числовой id или @username.
 */
export function normalizeChatRef(input) {
  const value = String(input || '').trim();
  if (!value) return '';

  const link = value.match(/(?:https?:\/\/)?t\.me\/(?:s\/)?([A-Za-z0-9_]{4,})/i);
  if (link) return `@${link[1]}`;

  if (/^-?\d+$/.test(value)) return value;
  if (value.startsWith('@')) return value;
  if (/^[A-Za-z0-9_]{4,}$/.test(value)) return `@${value}`;
  return value;
}
