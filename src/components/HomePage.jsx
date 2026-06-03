import { useState } from 'react';
import { createRoom, joinRoom, buildInviteLink } from '../services/roomService.js';
import AccountMenu from './AccountMenu.jsx';
import './HomePage.css';

export default function HomePage({
  user,
  gameType = 'poker',
  onEnterLobby,
  onQuickPlay,
  onLogout,
  notice,
  onNavigate,
}) {
  const [joinCode, setJoinCode] = useState('');
  const [roomError, setRoomError] = useState(null);
  const [createdRoom, setCreatedRoom] = useState(null);
  const [isPublicRoom, setIsPublicRoom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const isBlackjack = gameType === 'blackjack';
  const gameTitle = isBlackjack ? 'Blackjack' : 'PokerBox';

  const handleCreateRoom = async () => {
    setRoomError(null);
    setRoomLoading(true);
    const result = await createRoom(user, isPublicRoom, gameType);
    setRoomLoading(false);
    if (result.ok) {
      setCreatedRoom(result);
    } else {
      setRoomError(result.error);
    }
  };

  const handleJoinRoom = async () => {
    setRoomError(null);
    setRoomLoading(true);
    const result = await joinRoom(joinCode, user);
    setRoomLoading(false);
    if (result.ok) {
      onEnterLobby(result.room);
    } else {
      setRoomError(result.error);
    }
  };

  const handleCopyLink = async () => {
    const link = createdRoom?.link ?? buildInviteLink(createdRoom?.room?.code);
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="home">
      <header className="home__header">
          <AccountMenu
            onLogout={onLogout}
          onNavigate={onNavigate}
          triggerLabel="Menu"
        />
        <div className="home__brand">
          <span className="home__logo">♠</span>
          <h1>{gameTitle}</h1>
        </div>
        <div className="home__user-bar">
          <button type="button" className="home__profile-shortcut" onClick={() => onNavigate('profile')}>
            <span>{user.nametag}</span>
            <strong>{user.chips?.toLocaleString()} chips</strong>
          </button>
        </div>
      </header>

      {notice && <p className="home__notice" role="status">{notice}</p>}

      <main className="home__grid home__grid--single">
        <section className="home__card home__card--play">
          <h2>Gioca</h2>
          <p className="home__card-desc">
            {isBlackjack
              ? 'Crea una stanza blackjack o unisciti con codice / link invito. Max 4 giocatori contro il banco.'
              : 'Crea una stanza o unisciti con codice / link invito'}
          </p>
          <div className="home__visibility">
            <button
              type="button"
              className={!isPublicRoom ? 'home__visibility-btn home__visibility-btn--active' : 'home__visibility-btn'}
              onClick={() => setIsPublicRoom(false)}
            >
              Privata
            </button>
            <button
              type="button"
              className={isPublicRoom ? 'home__visibility-btn home__visibility-btn--active' : 'home__visibility-btn'}
              onClick={() => setIsPublicRoom(true)}
            >
              Pubblica
            </button>
          </div>

          <button type="button" className="home__btn home__btn--primary" onClick={handleCreateRoom} disabled={roomLoading}>
            {roomLoading ? 'Creazione...' : 'Crea stanza'}
          </button>

          {createdRoom && (
            <div className="home__room-created">
              <p>
                Codice: <strong className="home__code">{createdRoom.room.code}</strong>
              </p>
              <div className="home__room-actions">
                <button type="button" className="home__btn home__btn--small" onClick={handleCopyLink}>
                  {copied ? 'Copiato!' : 'Copia link invito'}
                </button>
                <button type="button" className="home__btn home__btn--gold" onClick={() => onEnterLobby(createdRoom.room)}>
                  Entra al tavolo
                </button>
              </div>
            </div>
          )}

          <div className="home__divider">oppure</div>

          <div className="home__join">
            <input
              type="text"
              placeholder="Codice stanza (es. ABC123)"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              maxLength={6}
            />
            <button type="button" className="home__btn home__btn--secondary" onClick={handleJoinRoom} disabled={roomLoading}>
              {roomLoading ? 'Attendi...' : 'Unisciti'}
            </button>
          </div>

          {roomError && <p className="home__error">{roomError}</p>}

          <button type="button" className="home__btn home__btn--gold" onClick={() => onNavigate('publicRooms')}>
            Stanze pubbliche {isBlackjack ? 'Blackjack' : 'Poker'}
          </button>

          {!isBlackjack && (
            <button type="button" className="home__btn home__btn--ghost" onClick={onQuickPlay}>
              Partita rapida vs bot
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
