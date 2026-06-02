import { useState } from 'react';
import { createRoom, joinRoom, buildInviteLink } from '../services/roomService.js';
import AccountMenu from './AccountMenu.jsx';
import './HomePage.css';

export default function HomePage({
  user,
  onEnterLobby,
  onQuickPlay,
  onLogout,
  onUpdateAccount,
  accountLoading,
  wallet,
  notice,
}) {
  const [joinCode, setJoinCode] = useState('');
  const [roomError, setRoomError] = useState(null);
  const [createdRoom, setCreatedRoom] = useState(null);
  const [convertAmount, setConvertAmount] = useState('');
  const [convertMsg, setConvertMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);

  const {
    connected,
    address,
    bottiBalance,
    connectWallet,
    disconnectWallet,
    convertToChips,
    chipsPerBotti,
  } = wallet;

  const handleCreateRoom = async () => {
    setRoomError(null);
    setRoomLoading(true);
    const result = await createRoom(user);
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

  const handleQuickPlay = () => {
    onQuickPlay();
  };

  const handleEnterCreated = () => {
    if (createdRoom?.room) onEnterLobby(createdRoom.room);
  };

  const handleCopyLink = async () => {
    const link = createdRoom?.link ?? buildInviteLink(createdRoom?.room?.code);
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConvert = async () => {
    setConvertMsg(null);
    const result = await convertToChips(convertAmount, (chips) => {
      wallet.onChipsAdded?.(chips);
    });
    if (result.ok) {
      setConvertMsg(`+${result.chips} chips (${result.bottiSpent} BottiCoin)`);
      setConvertAmount('');
    } else {
      setConvertMsg(result.error);
    }
  };

  return (
    <div className="home">
      <header className="home__header">
        <div className="home__brand">
          <span className="home__logo">♠</span>
          <h1>PokerBox</h1>
        </div>
        <div className="home__user-bar">
          <AccountMenu
            user={user}
            loading={accountLoading}
            onUpdateAccount={onUpdateAccount}
            onLogout={onLogout}
          />
        </div>
      </header>

      {notice && <p className="home__notice" role="status">{notice}</p>}

      <main className="home__grid">
        <section className="home__card home__card--play">
          <h2>Gioca</h2>
          <p className="home__card-desc">Crea una stanza o unisciti con codice / link invito</p>

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
                <button type="button" className="home__btn home__btn--gold" onClick={handleEnterCreated}>
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
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <button type="button" className="home__btn home__btn--secondary" onClick={handleJoinRoom} disabled={roomLoading}>
              {roomLoading ? 'Attendi...' : 'Unisciti'}
            </button>
          </div>

          {roomError && <p className="home__error">{roomError}</p>}

          <button type="button" className="home__btn home__btn--ghost" onClick={handleQuickPlay}>
            Partita rapida vs bot
          </button>
        </section>

        <section className="home__card home__card--wallet">
          <h2>BottiCoin Wallet</h2>
          <p className="home__card-desc">
            Collega il wallet e converti BottiCoin in chips da tavolo
            <br />
            <small>1 BottiCoin = {chipsPerBotti} chips</small>
          </p>

          {!connected ? (
            <button type="button" className="home__btn home__btn--botti" onClick={connectWallet}>
              Collega wallet BottiCoin
            </button>
          ) : (
            <div className="home__wallet-connected">
              <p className="home__wallet-addr" title={address}>
                {address?.slice(0, 8)}…{address?.slice(-6)}
              </p>
              <p className="home__botti-bal">
                <span>Saldo</span>
                <strong>{bottiBalance} BOTTI</strong>
              </p>
              <div className="home__convert">
                <input
                  type="number"
                  min="1"
                  max={bottiBalance}
                  placeholder="Quanti BottiCoin?"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                />
                <button type="button" className="home__btn home__btn--gold" onClick={handleConvert}>
                  Converti in chips
                </button>
              </div>
              {convertMsg && (
                <p className={convertMsg.startsWith('+') ? 'home__success' : 'home__error'}>
                  {convertMsg}
                </p>
              )}
              <button type="button" className="home__btn home__btn--ghost home__btn--small" onClick={disconnectWallet}>
                Scollega wallet
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="home__footer">
        Account SQL (futuro): Id · Nametag · Email · Password · Chips · BottiCoin
      </footer>
    </div>
  );
}
