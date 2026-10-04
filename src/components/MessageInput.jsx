import { useState } from 'react';

/** Поле ввода и отправка текстового сообщения. */
export default function MessageInput({ onSend, disabled, placeholder }) {
  const [text, setText] = useState('');

  const send = () => {
    const value = text.trim();
    if (!value || disabled) return;
    setText('');
    onSend(value);
  };

  const handleKeyDown = (event) => {
    // Enter — отправить, Shift+Enter — новая строка.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="composer">
      <textarea
        className="composer-input"
        rows={1}
        placeholder={placeholder || 'Введите сообщение…'}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="send-button"
        onClick={send}
        disabled={disabled || !text.trim()}
        aria-label="Отправить"
      >
        ➤
      </button>
    </div>
  );
}