import { useState } from 'react';
import './AccountMenu.css';

export default function AccountMenu({ user, loading, onUpdateAccount, onLogout, compact = false }) {
  const [open, setOpen] = useState(false);
  const [nametag, setNametag] = useState(user?.nametag ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(null);

  const toggleOpen = () => {
    setOpen((value) => {
      const next = !value;
      if (next) {
        setNametag(user?.nametag ?? '');
        setEmail(user?.email ?? '');
        setPassword('');
        setMessage(null);
      }
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);
    const result = await onUpdateAccount?.({ nametag, email, password });
    if (result?.ok) {
      setPassword('');
      setMessage({ type: 'success', text: 'Account aggiornato' });
    } else {
      setMessage({ type: 'error', text: result?.error ?? 'Aggiornamento fallito' });
    }
  };

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
          <span className="account-menu__name">{user?.nametag}</span>
          {!compact && <span className="account-menu__chips">{user?.chips?.toLocaleString()} chips</span>}
        </span>
        <span className="account-menu__chevron" aria-hidden>⌄</span>
      </button>

      {open && (
        <div className="account-menu__panel" role="dialog" aria-label="Account">
          <form className="account-menu__form" onSubmit={handleSubmit}>
            <label className="account-menu__field">
              <span>Nametag</span>
              <input
                type="text"
                value={nametag}
                onChange={(event) => setNametag(event.target.value)}
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
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className="account-menu__field">
              <span>Nuova password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Lascia vuoto per non cambiare"
                minLength={6}
                autoComplete="new-password"
              />
            </label>

            {message && (
              <p className={`account-menu__message account-menu__message--${message.type}`}>
                {message.text}
              </p>
            )}

            <div className="account-menu__actions">
              <button type="submit" className="account-menu__save" disabled={loading}>
                {loading ? 'Salvo...' : 'Salva'}
              </button>
              <button type="button" className="account-menu__logout" onClick={onLogout}>
                Esci
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
