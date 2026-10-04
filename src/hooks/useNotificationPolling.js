import { useEffect, useRef, useState } from 'react';
import { deleteNotification, receiveNotification } from '../api/greenApi.js';

const EMPTY_DELAY = 1500; // пауза, когда очередь пуста
const ERROR_DELAY = 3000; // пауза после ошибки

/**
 * Цикл получения входящих уведомлений по технологии HTTP API:
 * ReceiveNotification -> обработка -> DeleteNotification -> повтор.
 *
 * @param {object|null} creds  параметры доступа к инстансу
 * @param {(notification: object) => void} handler  обработчик уведомления
 * @param {boolean} enabled  включено ли получение
 * @returns {{status: 'idle'|'running'|'error', error: Error|null}}
 */
export function useNotificationPolling(creds, handler, enabled = true) {
  const handlerRef = useRef(handler);
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

    let stopped = false;
    let timer = null;
    setStatus('running');

    const loop = async () => {
      let delay = EMPTY_DELAY;
      try {
        const notification = await receiveNotification(creds);

        // Эффект мог быть размонтирован, пока шёл запрос.
        if (stopped) return;

        if (notification && notification.receiptId != null) {
          delay = 0; // сразу забираем следующее уведомление
          try {
            handlerRef.current?.(notification);
          } finally {
            // Подтверждаем обработку, чтобы уведомление ушло из очереди.
            await deleteNotification(creds, notification.receiptId).catch(() => {});
          }
        }

        if (stopped) return;
        setError(null);
        setStatus('running');
      } catch (err) {
        if (stopped) return;
        setError(err);
        setStatus('error');
        delay = ERROR_DELAY;
      }

      if (!stopped) {
        timer = setTimeout(loop, delay);
      }
    };

    loop();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [creds, enabled]);

  return { status, error };
}
