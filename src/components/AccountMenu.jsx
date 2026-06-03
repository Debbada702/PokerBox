import { useState } from 'react';
import './AccountMenu.css';

export default function AccountMenu({
  user,
  onLogout,
  onLeaveTable,
  compact = false,
  triggerLabel = null,
  onNavigate,
}) {
  const [open, setOpen] = useState(false);

  const toggleOpen = () => {
    setOpen((value) => !value);
  };

  const go = (target) => {
    setOpen(false);
    onNavigate?.(target);
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
        {!triggerLabel && <span className="account-menu__avatar">{user?.nametag?.charAt(0) ?? '?'}</span>}
        <span className="account-menu__summary">
          <span className="account-menu__name">{triggerText}</span>
          {!compact && !triggerLabel && <span className="account-menu__chips">{user?.chips?.toLocaleString()} chips</span>}
        </span>
        <span className="account-menu__chevron" aria-hidden>⌄</span>
      </button>

      {open && (
        <div className="account-menu__panel" role="dialog" aria-label="Menu">
          <div className="account-menu__nav">
            <button type="button" onClick={() => go('profile')}>Profilo e impostazioni</button>
            <button type="button" onClick={() => go('wallet')}>Wallet BottiCoin</button>
            <button type="button" onClick={() => go('terms')}>Termini e condizioni</button>
            <button type="button" onClick={() => go('security')}>Sicurezza account</button>
            <button type="button" onClick={() => go('support')}>Supporto</button>
            {onLeaveTable && (
              <button type="button" className="account-menu__danger" onClick={onLeaveTable}>
                Abbandona tavolo
              </button>
            )}
            <button type="button" className="account-menu__logout" onClick={onLogout}>
              Esci
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
