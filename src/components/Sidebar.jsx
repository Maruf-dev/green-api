import { useMemo, useState } from 'react';
import Avatar from './Avatar.jsx';

const STATUS_LABELS = {
  idle: 'Получение выключено',
  running: 'Получение сообщений активно',
  error: 'Ошибка получения сообщений',
};

/** Левая панель: список чатов, поиск и создание нового чата. */
export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onLogout,
  connectionStatus,
  brandTitle = 'MAX Chat',
  brandLetter = 'M',
  brandSubtitle = '',
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (chat) =>
        chat.name.toLowerCase().includes(q) || String(chat.chatId).includes(q),
    );
  }, [chats, query]);

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">{brandLetter}</div>
          <div>
            <div className="brand-title">{brandTitle}</div>
            <div className="brand-subtitle">{brandSubtitle}</div>
          </div>
        </div>
        <button
          type="button"
          className="icon-button"
          title="Новый чат"
          aria-label="Новый чат"
          onClick={onNewChat}
        >
          +
        </button>
      </header>

      <div className="search-box">
        <input
          type="text"
          placeholder="Поиск"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="chat-list">
        {filtered.length === 0 && (
          <div className="chat-list-empty">
            {chats.length === 0 ? 'Чатов пока нет. Создайте новый чат.' : 'Ничего не найдено'}
          </div>
        )}

        {filtered.map((chat) => {
          const last = chat.messages[chat.messages.length - 1];
          const preview = last
            ? `${last.direction === 'out' ? 'Вы: ' : ''}${last.text}`
            : 'Нет сообщений';
          return (
            <button
              type="button"
              key={chat.chatId}
              className={`chat-item${chat.chatId === activeChatId ? ' active' : ''}`}
              onClick={() => onSelectChat(chat.chatId)}
            >
              <Avatar name={chat.name} />
              <div className="chat-item-body">
                <div className="chat-item-top">
                  <span className="chat-item-name">{chat.name}</span>
                </div>
                <div className="chat-item-preview">{preview}</div>
              </div>
              {chat.unread > 0 && <span className="badge">{chat.unread}</span>}
            </button>
          );
        })}
      </div>

      <footer className="sidebar-footer">
        <span className={`status-dot status-${connectionStatus}`} aria-hidden="true" />
        <span className="status-text">{STATUS_LABELS[connectionStatus] || ''}</span>
        <button type="button" className="link-button" onClick={onLogout}>
          Выйти
        </button>
      </footer>
    </aside>
  );
}
