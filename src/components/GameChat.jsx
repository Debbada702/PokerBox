import { useEffect, useState } from 'react';
import { listRoomMessages, sendRoomMessage } from '../services/roomService.js';
import './GameChat.css';

export default function GameChat({ roomCode, user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!roomCode || roomCode === 'LOCAL') return undefined;
    let alive = true;

    const refresh = async () => {
      const result = await listRoomMessages(roomCode);
      if (alive && result.ok) setMessages(result.messages);
    };

    refresh();
    const id = setInterval(refresh, 1200);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [roomCode]);

  if (!roomCode || roomCode === 'LOCAL') return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    setText('');
    const result = await sendRoomMessage(roomCode, user, clean);
    if (result.ok) setMessages(result.messages);
  };

  return (
    <section className="game-chat">
      <div className="game-chat__messages" aria-live="polite">
        {messages.length === 0 ? (
          <p className="game-chat__empty">Chat stanza</p>
        ) : messages.map((message) => (
          <p key={message.id} className="game-chat__message">
            <strong>{message.nametag}</strong>
            <span>{message.text}</span>
          </p>
        ))}
      </div>
      <form className="game-chat__form" onSubmit={handleSubmit}>
        <input
          type="text"
          maxLength={180}
          placeholder="Scrivi in chat..."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit">Invia</button>
      </form>
    </section>
  );
}
