import { useMemo, useState } from 'react';
import './AccountMenu.css';

function makeVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function AccountMenu({
  user,
  loading,
  onUpdateAccount,
  onLogout,
  onLeaveTable,
  wallet,
  compact = false,
  triggerLabel = null,
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('menu');
  const [nametag, setNametag] = useState(user?.nametag ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [pendingCode, setPendingCode] = useState('');
  const [message, setMessage] = useState(null);
  const [convertAmount, setConvertAmount] = useState('');
  const [walletMessage, setWalletMessage] = useState(null);

  const profileChanged = useMemo(() => (
    nametag.trim() !== (user?.nametag ?? '') ||
    email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase() ||
    password.trim().length > 0
  ), [email, nametag, password, user]);

  const resetPanel = () => {
    setView('menu');
    setNametag(user?.nametag ?? '');
    setEmail(user?.email ?? '');
    setPassword('');
    setCodeInput('');
    setPendingCode('');
    setMessage(null);
    setWalletMessage(null);
  };

  const toggleOpen = () => {
    setOpen((value) => {
      const next = !value;
      if (next) resetPanel();
      return next;
    });
  };

  const handleSendCode = () => {
    if (!profileChanged) {
      setMessage({ type: 'error', text: 'Modifica almeno un campo prima di richiedere il codice.' });
      return;
    }
    const code = makeVerificationCode();
    setPendingCode(code);
    setCodeInput('');
    setMessage({
      type: 'success',
      text: `Codice di verifica inviato a ${user?.email}.`,
    });
    console.info('[PokerBox] codice verifica account:', code);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (!profileChanged) {
      setMessage({ type: 'error', text: 'Nessuna modifica da salvare.' });
      return;
    }
    if (!pendingCode || codeInput.trim() !== pendingCode) {
      setMessage({ type: 'error', text: 'Inserisci il codice di verifica ricevuto via email.' });
      return;
    }
    const result = await onUpdateAccount?.({ nametag, email, password });
    if (result?.ok) {
      setPassword('');
      setCodeInput('');
      setPendingCode('');
      setMessage({ type: 'success', text: 'Account aggiornato' });
    } else {
      setMessage({ type: 'error', text: result?.error ?? 'Aggiornamento fallito' });
    }
  };

  const handleConvert = async () => {
    setWalletMessage(null);
    const result = await wallet?.convertToChips?.(convertAmount, (chips) => {
      wallet?.onChipsAdded?.(chips);
    });
    if (result?.ok) {
      setWalletMessage({ type: 'success', text: `+${result.chips} chips (${result.bottiSpent} BottiCoin)` });
      setConvertAmount('');
    } else {
      setWalletMessage({ type: 'error', text: result?.error ?? 'Conversione fallita' });
    }
  };

  const triggerText = triggerLabel ?? user?.nametag;

  return (
    <div className={`account-menu ${compact ? 'account-menu--compact' : ''}`}>
      <button
        type="button"
        className="account-menu__trigger"
        onClick={toggleOpen}
        aria-expanded={open}
      >
        <span className="account-menu__avatar">{user?.nametag?.charAt(0) ?? '?'}</span>
        <span className="account-menu__summary">
          <span className="account-menu__name">{triggerText}</span>
          {!compact && !triggerLabel && <span className="account-menu__chips">{user?.chips?.toLocaleString()} chips</span>}
        </span>
        <span className="account-menu__chevron" aria-hidden>⌄</span>
      </button>

      {open && (
        <div className="account-menu__panel" role="dialog" aria-label="Menu">
          {view !== 'menu' && (
            <button type="button" className="account-menu__back" onClick={() => setView('menu')}>
              ← Menu
            </button>
          )}

          {view === 'menu' && (
            <div className="account-menu__nav">
              <button type="button" onClick={() => setView('profile')}>Profilo</button>
              <button type="button" onClick={() => setView('wallet')}>Wallet BottiCoin</button>
              {onLeaveTable && (
                <button type="button" className="account-menu__danger" onClick={onLeaveTable}>
                  Abbandona tavolo
                </button>
              )}
              <button type="button" className="account-menu__logout" onClick={onLogout}>
                Esci
              </button>
            </div>
          )}

          {view === 'profile' && (
            <form className="account-menu__form" onSubmit={handleSubmit}>
              <label className="account-menu__field">
                <span>Nametag</span>
                <input
                  type="text"
                  value={nametag}
                  onChange={(event) => {
                    setNametag(event.target.value);
                    setPendingCode('');
                  }}
                  minLength={3}
                  maxLength={20}
                  required
                />
              </label>

              <label className="account-menu__field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setPendingCode('');
                  }}
                  required
                />
              </label>

              <label className="account-menu__field">
                <span>Nuova password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setPendingCode('');
                  }}
                  placeholder="Lascia vuoto per non cambiare"
                  minLength={6}
                  autoComplete="new-password"
                />
              </label>

              <div className="account-menu__verify">
                <button type="button" onClick={handleSendCode} disabled={!profileChanged}>
                  Invia codice
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Codice email"
                  value={codeInput}
                  onChange={(event) => setCodeInput(event.target.value)}
                />
              </div>

              {message && (
                <p className={`account-menu__message account-menu__message--${message.type}`}>
                  {message.text}
                </p>
              )}

              <button type="submit" className="account-menu__save" disabled={loading || !profileChanged}>
                {loading ? 'Salvo...' : 'Salva profilo'}
              </button>
            </form>
          )}

          {view === 'wallet' && (
            <div className="account-menu__wallet">
              {!wallet?.connected ? (
                <button type="button" className="account-menu__save" onClick={wallet?.connectWallet}>
                  Collega wallet BottiCoin
                </button>
              ) : (
                <>
                  <p className="account-menu__wallet-addr" title={wallet.address}>
                    {wallet.address?.slice(0, 8)}...{wallet.address?.slice(-6)}
                  </p>
                  <p className="account-menu__wallet-balance">
                    <span>Saldo</span>
                    <strong>{wallet.bottiBalance} BOTTI</strong>
                  </p>
                  <small>1 BottiCoin = {wallet.chipsPerBotti} chips</small>
                  <input
                    type="number"
                    min="1"
                    max={wallet.bottiBalance}
                    placeholder="Quanti BottiCoin?"
                    value={convertAmount}
                    onChange={(event) => setConvertAmount(event.target.value)}
                  />
                  <button type="button" className="account-menu__save" onClick={handleConvert}>
                    Converti in chips
                  </button>
                  {walletMessage && (
                    <p className={`account-menu__message account-menu__message--${walletMessage.type}`}>
                      {walletMessage.text}
                    </p>
                  )}
                  <button type="button" className="account-menu__ghost" onClick={wallet.disconnectWallet}>
                    Scollega wallet
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
