import './ActionsBar.css';

const ACTIONS = [
  { id: 'deal', label: 'Deal', icon: 'D', variant: 'deal', showWhen: ['idle', 'showdown'] },
  { id: 'check', label: 'Check', icon: 'OK', variant: 'check' },
  { id: 'call', label: 'Call', icon: 'C', variant: 'call', dynamicLabel: true },
  { id: 'raise', label: 'Raise', icon: '+', variant: 'raise', dynamicLabel: true },
  { id: 'allin', label: 'All In', icon: 'AI', variant: 'allin' },
  { id: 'fold', label: 'Fold', icon: 'X', variant: 'fold' },
];

export default function ActionsBar({
  phase,
  onDeal,
  canDeal = true,
  onCheck,
  onCall,
  onRaise,
  onAllIn,
  onFold,
  disabled,
  pot,
  currentBet,
  toCall,
  selectedBet,
  humanChips,
  humanBlindRole,
}) {
  const inHand = phase !== 'idle' && phase !== 'showdown';
  const handlers = { deal: onDeal, check: onCheck, call: onCall, raise: onRaise, allin: onAllIn, fold: onFold };

  const getLabel = (id, base) => {
    if (id === 'call' && humanBlindRole === 'small') {
      return toCall > 0 ? `Small blind +${toCall}` : 'Small blind';
    }
    if (id === 'call' && humanBlindRole === 'big') {
      return toCall > 0 ? `Big blind +${toCall}` : 'Big blind';
    }
    if (id === 'call' && toCall > 0) return `Call ${toCall}`;
    if (id === 'call' && toCall === 0) return 'Check';
    if (id === 'raise') return currentBet > 0 ? `Raise +${selectedBet}` : `Bet ${selectedBet}`;
    return base;
  };

  return (
    <div className="actions-bar">
      <div className="actions-bar__hud">
        <div className="actions-bar__hud-item">
          <span className="actions-bar__hud-label">Pot</span>
          <span className="actions-bar__hud-value">{pot.toLocaleString()}</span>
        </div>
        <div className="actions-bar__hud-item">
          <span className="actions-bar__hud-label">Puntata</span>
          <span className="actions-bar__hud-value">{currentBet}</span>
        </div>
        <div className="actions-bar__hud-item">
          <span className="actions-bar__hud-label">Stack</span>
          <span className="actions-bar__hud-value actions-bar__hud-value--gold">
            {humanChips?.toLocaleString() ?? '-'}
          </span>
        </div>
      </div>
      <div className="actions-bar__buttons">
        {ACTIONS.map(({ id, label, icon, variant, showWhen }) => {
          const isDeal = id === 'deal';
          const dealOnly = isDeal && canDeal && showWhen?.includes(phase);
          const actionsDisabled = disabled || !inHand;
          const btnDisabled = isDeal ? !dealOnly : actionsDisabled;

          return (
            <button
              key={id}
              type="button"
              className={`actions-bar__btn actions-bar__btn--${variant}`}
              onClick={handlers[id]}
              disabled={btnDisabled}
            >
              <span className="actions-bar__icon" aria-hidden>{icon}</span>
              {getLabel(id, label)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
