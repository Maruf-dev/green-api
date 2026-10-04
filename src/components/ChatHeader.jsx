import Avatar from './Avatar.jsx';

/** Шапка открытого чата. */
export default function ChatHeader({ chat }) {
  return (
    <header className="chat-header">
      <Avatar name={chat.name} size={40} />
      <div className="chat-header-body">
        <div className="chat-header-name">{chat.name}</div>
        <div className="chat-header-id">
          {chat.username ? `@${chat.username} · ` : ''}chatId: {chat.chatId}
        </div>
      </div>
    </header>
  );
}
