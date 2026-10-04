import { useEffect, useRef } from 'react';

function formatTime(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Лента сообщений открытого чата с авто-прокруткой вниз. */
export default function MessageList({ messages }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="message-list empty">
        <div className="chat-placeholder">
          <div className="chat-placeholder-emoji" aria-hidden="true">💬</div>
          <p>Напишите первое сообщение.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <div key={message.id} className={`bubble-row ${message.direction}`}>
          <div className={`bubble ${message.direction}${message.failed ? ' failed' : ''}`}>
            <span className="bubble-text">{message.text}</span>
            <span className="bubble-meta">
              {formatTime(message.ts)}
              {message.direction === 'out' && (
                <span className="bubble-check" aria-hidden="true">
                  {message.failed ? '!' : '✓'}
                </span>
              )}
            </span>
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
