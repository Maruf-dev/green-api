import { useEffect, useRef, useState } from 'react';
import { getUpdates } from '../api/telegramApi.js';

const ERROR_DELAY = 3000; // пауза после ошибки, мс
const LONG_POLL_TIMEOUT = 25; // сколько секунд Telegram держит соединение при long polling

/**
 * Цикл приёма входящих сообщений через Telegram Bot API (long polling):
 * getUpdates(offset) -> обработка каждого update -> следующий getUpdates с новым offset.
 *
 * Offset хранится в ref и сбрасывается только при смене токена (смена бота),
 * поэтому повторный монтаж хука не приводит к повторной выдаче старых сообщений.
 *
 * @param {object|null} creds  учётные данные бота ({ token, apiBase })
 * @param {(update: object) => void} handler  обработчик одного update
 * @param {boolean} enabled  включён ли приём
 * @returns {{status: 'idle'|'running'|'error', error: Error|null}}
 */
export function useUpdatesPolling(creds, handler, enabled = true) {
  const handlerRef = useRef(handler);
  const offsetRef = useRef({ token: null, value: 0 });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!creds || !enabled) {
      setStatus('idle');
      setError(null);
      return undefined;
    }

    if (offsetRef.current.token !== creds.token) {
      offsetRef.current = { token: creds.token, value: 0 };
    }

    let stopped = false;
    let timer = null;
    let activeController = null;
    setStatus('running');

    const loop = async () => {
      let delay = 0;
      const controller = new AbortController();
      activeController = controller;

      try {
        const data = await getUpdates(creds, {
          offset: offsetRef.current.value,
          timeout: LONG_POLL_TIMEOUT,
          signal: controller.signal,
        });

        if (stopped) return;

        if (!data || data.ok !== true) {
          throw new Error((data && data.description) || 'Не удалось получить обновления');
        }

        const updates = Array.isArray(data.result) ? data.result : [];
        for (const update of updates) {
          if (typeof update.update_id === 'number') {
            offsetRef.current.value = Math.max(offsetRef.current.value, update.update_id + 1);
          }
          handlerRef.current?.(update);
        }

        setError(null);
        setStatus('running');
      } catch (err) {
        if (stopped || (err && err.name === 'AbortError')) return;
        setError(err);
        setStatus('error');
        delay = ERROR_DELAY;
      } finally {
        activeController = null;
      }

      if (!stopped) {
        timer = setTimeout(loop, delay);
      }
    };

    loop();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (activeController) activeController.abort();
    };
  }, [creds, enabled]);

  return { status, error };
}
