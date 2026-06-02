import { useState, useEffect, useCallback } from 'react';
import {
  getRoom,
  kickPlayer,
  buildInviteLink,
  MAX_SEATS,
  START_MODES,
  validateStart,
} from '../services/roomService.js';
import './RoomLobby.css';

export default function RoomLobby({
  roomCode,
  user,
  onLeave,
  onStartGame,
  gameStartingRef,
}) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const isHost = room?.hostId === user.id;
  const inviteLink = buildInviteLink(roomCode);

  const refresh = useCallback(async () => {
    const latest = await getRoom(roomCode);
    if (!latest) {
      onLeave({ kicked: true, reason: 'La stanza non esiste più' });
      return;
    }
    if (!latest.players.some((p) => p.id === user.id)) {
      onLeave({ kicked: true, reason: 'Sei stato espulso dalla stanza' });
      return;
    }
    if (latest.status === 'playing' && latest.startMode) {
      if (!gameStartingRef?.current) {
        gameStartingRef.current = true;
        await onStartGame(latest.startMode, latest);
      }
      return;
    }
    setRoom({ ...latest });
  }, [roomCode, user.id, onLeave, onStartGame, gameStartingRef]);

  useEffect(() => {
    const firstRefresh = setTimeout(refresh, 0);
    const id = setInterval(refresh, 1500);
    return () => {
      clearTimeout(firstRefresh);
      clearInterval(id);
    };
  }, [refresh]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKick = async (targetId) => {
    setError(null);
    const result = await kickPlayer(roomCode, user.id, targetId);
    if (result.ok) {
      setRoom(result.room);
    } else {
      setError(result.error);
    }
  };

  const handleStart = async (mode) => {
    setError(null);
    const check = validateStart(room, mode);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    if (gameStartingRef) gameStartingRef.current = true;
    await onStartGame(mode, room);
  };

  if (!room) {
    return <div className="lobby lobby--loading">Caricamento lobby...</div>;
  }

  const emptySeats = MAX_SEATS - room.players.length;
  const seats = Array.from({ length: MAX_SEATS }, (_, i) => room.players[i] ?? null);

  return (
    <div className="lobby">
      <header className="lobby__header">
        <button type="button" className="lobby__back" onClick={() => onLeave()}>
          ← Esci dalla stanza
        </button>
        <div className="lobby__title-block">
          <h1 className="lobby__title">Lobby</h1>
          <span className="lobby__code">{room.code}</span>
        </div>
        <div className="lobby__you">
          <span>{user.nametag}</span>
          {isHost && <span className="lobby__host-badge">HOST</span>}
        </div>
      </header>

      <section className="lobby__invite">
        <p>Condividi il link o il codice per far entrare altri giocatori</p>
        <div className="lobby__invite-row">
          <code className="lobby__link">{inviteLink}</code>
          <button type="button" className="lobby__copy" onClick={handleCopy}>
            {copied ? 'Copiato!' : 'Copia link'}
          </button>
        </div>
      </section>

      <section className="lobby__seats">
        <h2>
          Posti al tavolo ({room.players.length}/{MAX_SEATS})
        </h2>
        <ul className="lobby__seat-grid">
          {seats.map((player, i) => (
            <li
              key={player ? `p-${player.id}` : `empty-${i}`}
              className={`lobby__seat ${player ? 'lobby__seat--filled' : 'lobby__seat--empty'}`}
            >
              {player ? (
                <>
                  <span className="lobby__seat-avatar">{player.nametag.charAt(0)}</span>
                  <div className="lobby__seat-info">
                    <span className="lobby__seat-name">{player.nametag}</span>
                    {player.id === room.hostId && (
                      <span className="lobby__seat-role">Host</span>
                    )}
                    {player.id === user.id && (
                      <span className="lobby__seat-role lobby__seat-role--you">Tu</span>
                    )}
                  </div>
                  {isHost && player.id !== user.id && (
                    <button
                      type="button"
                      className="lobby__kick"
                      onClick={() => handleKick(player.id)}
                      title="Espelli"
                    >
                      Espelli
                    </button>
                  )}
                </>
              ) : (
                <span className="lobby__seat-empty-label">Posto libero</span>
              )}
            </li>
          ))}
        </ul>
        {emptySeats > 0 && (
          <p className="lobby__waiting">
            In attesa di {emptySeats} giocator{emptySeats === 1 ? 'e' : 'i'}…
          </p>
        )}
      </section>

      {error && <p className="lobby__error" role="alert">{error}</p>}

      {isHost ? (
        <section className="lobby__host-controls">
          <h2>Controlli host — avvia partita</h2>
          <div className="lobby__start-grid">
            <button
              type="button"
              className="lobby__start-btn lobby__start-btn--humans"
              onClick={() => handleStart(START_MODES.HUMANS_ONLY)}
            >
              <strong>Solo giocatori presenti</strong>
              <span>Nessun bot — minimo 2 persone</span>
            </button>
            <button
              type="button"
              className="lobby__start-btn lobby__start-btn--fill"
              onClick={() => handleStart(START_MODES.FILL_BOTS)}
            >
              <strong>Riempi con bot</strong>
              <span>
                {room.players.length} uman{room.players.length === 1 ? 'o' : 'i'} + bot nei posti vuoti
              </span>
            </button>
            <button
              type="button"
              className="lobby__start-btn lobby__start-btn--bots"
              onClick={() => handleStart(START_MODES.ALL_BOTS)}
            >
              <strong>Solo tu vs bot</strong>
              <span>5 bot al tavolo — ignora altri in lobby</span>
            </button>
          </div>
        </section>
      ) : (
        <section className="lobby__guest-wait">
          <div className="lobby__pulse" />
          <p>In attesa che <strong>{room.hostNametag}</strong> avvii la partita…</p>
        </section>
      )}
    </div>
  );
}
