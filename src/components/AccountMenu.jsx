import { useState } from 'react';
import './AccountMenu.css';

export default function AccountMenu({
  onLogout,
  onLeaveTable,
  compact = false,
  triggerLabel = null,
  onNavigate,
  inGame = false,
}) {
  const [open, setOpen] = useState(false);

  const toggleOpen = () => {
    setOpen((value) => !value);
  };

  const go = (target) => {
    setOpen(false);
    onNavigate?.(target);
  };

  return (
    <div className={`account-menu ${compact ? 'account-menu--compact' : ''}`}>
      <button
        type="button"
        className="account-menu__trigger"
        onClick={toggleOpen}
        aria-expanded={open}
      >
        <span className="account-menu__hamburger" aria-hidden><span /><span /><span /></span>
        <span className="account-menu__name">{triggerLabel ?? 'Menu'}</span>
      </button>

      {open && (
        <div className="account-menu__panel" role="dialog" aria-label="Menu">
          <div className="account-menu__nav">
            {!inGame && <button type="button" onClick={() => go('profile')}><span>⚙</span>Profilo e impostazioni</button>}
            <button type="button" onClick={() => go('wallet')}><span>◇</span>Wallet BottiCoin</button>
            <button type="button" onClick={() => go('publicRooms')}><span>▦</span>Stanze pubbliche</button>
            <button type="button" onClick={() => go('terms')}><span>§</span>Termini e condizioni</button>
            {!inGame && <button type="button" onClick={() => go('security')}><span>●</span>Sicurezza account</button>}
            <button type="button" onClick={() => go('support')}><span>?</span>Supporto</button>
            {onLeaveTable && (
              <button type="button" className="account-menu__danger" onClick={onLeaveTable}>
                <span>×</span>Abbandona tavolo
              </button>
            )}
            <button type="button" className="account-menu__logout" onClick={onLogout}>
              <span>↪</span>Esci
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
