import { useState } from 'react';
import { DEFAULT_API_URL } from '../api/greenApi.js';
import { DEFAULT_API_BASE } from '../api/telegramApi.js';
import { getProvider } from '../providers/index.js';

const PROVIDER_TABS = [
  { id: 'green', label: 'MAX (GREEN-API)' },
  { id: 'telegram', label: 'Telegram' },
];


export default function LoginScreen({ onLogin, initialError = '' }) {
  const [providerId, setProviderId] = useState('green');
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [autoSetup, setAutoSetup] = useState(true);
  const [token, setToken] = useState('');
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  const isTelegram = providerId === 'telegram';
  const provider = getProvider(providerId);

  const switchProvider = (id) => {
    setProviderId(id);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    let creds;
    if (isTelegram) {
      const value = token.trim();
      if (!value) {
        setError('Укажите токен бота');
        return;
      }
      if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(value)) {
        setError('Токен выглядит некорректно. Пример: 123456789:AA… (получите у @BotFather)');
        return;
      }
      creds = {
        provider: 'telegram',
        token: value,
        apiBase: (apiBase.trim() || DEFAULT_API_BASE).replace(/\/+$/, '') || DEFAULT_API_BASE,
      };
    } else {
      if (!idInstance.trim() || !apiTokenInstance.trim()) {
        setError('Заполните idInstance и apiTokenInstance');
        return;
      }
      if (!/^\d+$/.test(idInstance.trim())) {
        setError('idInstance должен состоять только из цифр');
        return;
      }
      creds = {
        provider: 'green',
        idInstance: idInstance.trim(),
        apiTokenInstance: apiTokenInstance.trim(),
        apiUrl: (apiUrl.trim() || DEFAULT_API_URL).replace(/\/+$/, ''),
        autoSetup,
      };
    }

    setLoading(true);
    try {
      const info = await provider.connect(creds);
      onLogin({ ...creds, info: info && info.info ? info.info : undefined });
    } catch (err) {
      setError(
        err.status === 401 || err.status === 404
          ? isTelegram
            ? 'Неверный токен бота'
            : 'Неверные idInstance или apiTokenInstance'
          : err.message || 'Не удалось подключиться',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo" aria-hidden="true">{provider.brandLetter}</div>
        <h1 className="login-title">{provider.appTitle}</h1>

        <div className="provider-switch" role="tablist">
          {PROVIDER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={providerId === tab.id}
              className={`provider-tab${providerId === tab.id ? ' active' : ''}`}
              onClick={() => switchProvider(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <p className="login-subtitle">
          Войдите, используя{' '}
          {isTelegram ? (
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer noopener">
              токен бота из @BotFather
            </a>
          ) : (
            <a href="https://console.green-api.com" target="_blank" rel="noreferrer noopener">
              учётные данные инстанса GREEN-API
            </a>
          )}
        </p>

        {isTelegram ? (
          <label className="field">
            <span className="field-label">Токен бота</span>
            <input
              type="password"
              autoComplete="off"
              placeholder="123456789:AAExampleTokenFromBotFather"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="field">
              <span className="field-label">idInstance</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Например, 110100001"
                value={idInstance}
                onChange={(e) => setIdInstance(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">apiTokenInstance</span>
              <input
                type="password"
                autoComplete="off"
                placeholder="Ключ доступа инстанса"
                value={apiTokenInstance}
                onChange={(e) => setApiTokenInstance(e.target.value)}
              />
            </label>
          </>
        )}

        <button type="button" className="link-button" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? 'Скрыть дополнительные настройки' : 'Дополнительные настройки'}
        </button>

        {showAdvanced && (
          <div className="advanced">
            {isTelegram ? (
              <>
                <label className="field">
                  <span className="field-label">apiBase (адрес прокси)</span>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder={DEFAULT_API_BASE}
                    value={apiBase}
                    onChange={(e) => setApiBase(e.target.value)}
                  />
                </label>
                <p className="hint">
                  По умолчанию запросы идут на локальный прокси (<code>/api</code>), который
                  запускается командой <code>npm run dev:all</code> или <code>npm start</code>.
                  Прямое обращение к api.telegram.org из браузера заблокировано (CORS).
                </p>
              </>
            ) : (
              <>
                <label className="field">
                  <span className="field-label">apiUrl (хост API)</span>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder={DEFAULT_API_URL}
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                  />
                </label>
                <p className="hint">
                  Значение по умолчанию подходит для большинства инстансов. Если в личном
                  кабинете указан другой хост (например, <code>https://3100.api.green-api.com</code>),
                  укажите его здесь.
                </p>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={autoSetup}
                    onChange={(e) => setAutoSetup(e.target.checked)}
                  />
                  <span>Автоматически включить получение входящих сообщений (HTTP API)</span>
                </label>
              </>
            )}
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Проверяем…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
