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

  const go = (target) => {
    setOpen(false);
    onNavigate?.(target);
  };

  const leave = () => {
    setOpen(false);
    onLeaveTable?.();
  };

  return (
    <div className={`account-menu ${compact ? 'account-menu--compact' : ''}`}>
      <button
        type="button"
        className="account-menu__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="account-menu__hamburger" aria-hidden><span /><span /><span /></span>
        <span className="account-menu__name">{triggerLabel ?? 'Menu'}</span>
      </button>

      {open && (
        <div className="account-menu__panel" role="dialog" aria-label="Menu">
          <div className="account-menu__nav">
            {inGame ? (
              <button type="button" className="account-menu__danger" onClick={leave}>
                <span>X</span>Abbandona tavolo
              </button>
            ) : (
              <>
                <button type="button" onClick={() => go('games')}><span>G</span>Giochi</button>
                <button type="button" onClick={() => go('profile')}><span>P</span>Profilo e impostazioni</button>
                <button type="button" onClick={() => go('wallet')}><span>W</span>Wallet BottiCoin</button>
                <button type="button" onClick={() => go('terms')}><span>T</span>Termini e condizioni</button>
                <button type="button" onClick={() => go('security')}><span>S</span>Sicurezza account</button>
                <button type="button" onClick={() => go('support')}><span>?</span>Supporto</button>
                <button type="button" className="account-menu__logout" onClick={onLogout}>
                  <span>E</span>Esci
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
