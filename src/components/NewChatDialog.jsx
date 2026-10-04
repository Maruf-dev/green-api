import { useState } from 'react';

/**
 * Модальное окно создания нового чата.
 * provider описывает подсказки и нормализацию получателя (номер телефона для
 * MAX/GREEN-API или id/@username для Telegram).
 * onResolve(chatRef) должен вернуть Promise<{ chatId, name }>.
 */
export default function NewChatDialog({ provider, onClose, onResolve }) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const ref = provider.normalizeRef(value);
    if (!ref) {
      setError('Укажите получателя');
      return;
    }

    setLoading(true);
    try {
      await onResolve(ref);
    } catch (err) {
      setError(err.message || 'Не удалось создать чат');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <form
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="modal-title">Новый чат</h2>
        <p className="modal-text">{provider.refHint}</p>

        <label className="field">
          <span className="field-label">{provider.refLabel}</span>
          <input
            type="text"
            autoFocus
            autoComplete="off"
            placeholder={provider.refPlaceholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={loading}>
            Отмена
          </button>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Ищем…' : 'Создать чат'}
          </button>
        </div>
      </form>
    </div>
  );
}
