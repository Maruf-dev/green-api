import { useCallback, useState } from 'react';
import LoginScreen from './components/LoginScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatHeader from './components/ChatHeader.jsx';
import MessageList from './components/MessageList.jsx';
import MessageInput from './components/MessageInput.jsx';
import NewChatDialog from './components/NewChatDialog.jsx';
import { getProvider, greenProvider, providerSubtitle, telegramProvider } from './providers/index.js';
import { useNotificationPolling } from './hooks/useNotificationPolling.js';
import { useUpdatesPolling } from './hooks/useUpdatesPolling.js';

const STORAGE_KEY = 'max-chat-credentials';

/** Загружает учётные данные. Старый формат (без provider) считается MAX/GREEN-API. */
function loadCreds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed) return null;
    if (parsed.provider === 'telegram' || parsed.token) {
      return { ...parsed, provider: 'telegram' };
    }
    if (parsed.idInstance && parsed.apiTokenInstance) {
      return { ...parsed, provider: 'green' };
    }
  } catch {
    /* игнорируем повреждённое хранилище */
  }
  return null;
}

export default function App() {
  const [creds, setCreds] = useState(loadCreds);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [banner, setBanner] = useState(null);

  const activeChat = chats.find((chat) => chat.chatId === activeChatId) || null;
  const provider = getProvider(creds && creds.provider);

  /* ----------------------------- авторизация ----------------------------- */

  const handleLogin = useCallback(async (nextCreds) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCreds));
    } catch {
      /* хранилище может быть недоступно */
    }
    setCreds(nextCreds);

    const active = getProvider(nextCreds.provider);
    if (active.supportsAutoSetup && nextCreds.autoSetup) {
      try {
        await active.initialSetup(nextCreds);
        setBanner({ type: 'info', text: 'Получение входящих сообщений включено (HTTP API).' });
      } catch (err) {
        setBanner({ type: 'error', text: `Не удалось включить получение сообщений: ${err.message}` });
      }
    } else {
      setBanner({ type: 'info', text: `Подключено: ${providerSubtitle(nextCreds)}` });
    }
  }, []);

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setCreds(null);
    setChats([]);
    setActiveChatId(null);
    setBanner(null);
  }, []);

  /* -------------------------------- чаты --------------------------------- */

  const handleSelectChat = useCallback((chatId) => {
    setActiveChatId(chatId);
    setChats((prev) =>
      prev.map((chat) => (chat.chatId === chatId ? { ...chat, unread: 0 } : chat)),
    );
  }, []);

  const resolveNewChat = useCallback(
    async (ref) => {
      const active = getProvider(creds.provider);
      const chat = await active.resolveChat(creds, ref);
      setChats((prev) =>
        prev.some((item) => item.chatId === chat.chatId)
          ? prev
          : [
              ...prev,
              {
                chatId: chat.chatId,
                name: chat.name,
                username: chat.username || '',
                messages: [],
                unread: 0,
              },
            ],
      );
      setActiveChatId(chat.chatId);
      setDialogOpen(false);
    },
    [creds],
  );

  /* ------------------------------ сообщения ------------------------------ */

  const addIncoming = useCallback((chatId, message) => {
    setChats((prev) => {
      const list = prev.some((chat) => chat.chatId === chatId)
        ? prev
        : [...prev, { chatId, name: '', username: '', messages: [], unread: 0 }];
      return list.map((chat) => {
        if (chat.chatId !== chatId) return chat;
        if (chat.messages.some((m) => m.id === message.id)) return chat;
        return { ...chat, messages: [...chat.messages, message] };
      });
    });
  }, []);

  /** Общий приём входящего события от любого провайдера. */
  const ingest = useCallback(
    (parsed) => {
      if (!parsed) return;
      addIncoming(parsed.chatId, parsed.message);
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.chatId !== parsed.chatId) return chat;
          const genericName =
            !chat.name || /^[+0-9 ()-]+$/.test(chat.name) || /^Чат \d+$/.test(chat.name);
          return {
            ...chat,
            name: genericName && parsed.displayName ? parsed.displayName : chat.name,
            unread: parsed.chatId === activeChatId ? 0 : (chat.unread || 0) + 1,
          };
        }),
      );
    },
    [activeChatId, addIncoming],
  );

  const handleSend = useCallback(
    async (text) => {
      if (!creds || !activeChatId) return;
      const chatId = activeChatId;
      const localId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setChats((prev) =>
        prev.map((chat) =>
          chat.chatId === chatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  { id: localId, direction: 'out', text, ts: Date.now() },
                ],
              }
            : chat,
        ),
      );

      try {
        const sent = await provider.send(creds, chatId, text);
        const idMessage = sent && sent.id ? sent.id : localId;
        const ts = sent && sent.ts ? sent.ts : Date.now();
        setChats((prev) =>
          prev.map((chat) =>
            chat.chatId === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((m) =>
                    m.id === localId ? { ...m, id: idMessage, ts } : m,
                  ),
                }
              : chat,
          ),
        );
      } catch (err) {
        setChats((prev) =>
          prev.map((chat) =>
            chat.chatId === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((m) =>
                    m.id === localId ? { ...m, failed: true } : m,
                  ),
                }
              : chat,
          ),
        );
        setBanner({ type: 'error', text: `Сообщение не отправлено: ${err.message}` });
      }
    },
    [creds, activeChatId, provider],
  );

  /* --------------------------- входящие сообщения --------------------------- */

  const greenHandler = useCallback(
    (notification) => {
      ingest(greenProvider.parseEvent(notification));
    },
    [ingest],
  );

  const telegramHandler = useCallback(
    (update) => {
      ingest(telegramProvider.parseEvent(update));
    },
    [ingest],
  );

  // Оба хука вызываются всегда (правила хуков), активный выбирается флагом enabled.
  const greenPoll = useNotificationPolling(
    creds,
    greenHandler,
    Boolean(creds) && creds.provider === 'green',
  );
  const telegramPoll = useUpdatesPolling(
    creds,
    telegramHandler,
    Boolean(creds) && creds.provider === 'telegram',
  );
  const connectionStatus =
    creds && creds.provider === 'telegram' ? telegramPoll.status : greenPoll.status;

  /* -------------------------------- рендер -------------------------------- */

  if (!creds) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={() => setDialogOpen(true)}
        onLogout={handleLogout}
        connectionStatus={connectionStatus}
        brandTitle={provider.appTitle}
        brandLetter={provider.brandLetter}
        brandSubtitle={providerSubtitle(creds)}
      />

      <main className="chat-area">
        {banner && (
          <div className={`alert alert-${banner.type} banner`}>
            <span>{banner.text}</span>
            <button type="button" className="alert-close" onClick={() => setBanner(null)}>
              ✕
            </button>
          </div>
        )}

        {activeChat ? (
          <>
            <ChatHeader chat={activeChat} />
            <MessageList messages={activeChat.messages} />
            <MessageInput onSend={handleSend} />
          </>
        ) : (
          <div className="chat-placeholder">
            <div className="chat-placeholder-emoji" aria-hidden="true">💬</div>
            <h2>{provider.appTitle}</h2>
            <p>Выберите чат слева или создайте новый.</p>
            <button type="button" className="primary-button" onClick={() => setDialogOpen(true)}>
              Новый чат
            </button>
          </div>
        )}
      </main>

      {dialogOpen && (
        <NewChatDialog
          provider={provider}
          onClose={() => setDialogOpen(false)}
          onResolve={resolveNewChat}
        />
      )}
    </div>
  );
}
