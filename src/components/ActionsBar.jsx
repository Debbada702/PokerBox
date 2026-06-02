import './ActionsBar.css';

const ACTIONS = [
  { id: 'deal', label: 'Deal', icon: '🃏', variant: 'deal', showWhen: ['idle', 'showdown'] },
  { id: 'check', label: 'Check', icon: '✓', variant: 'check' },
  { id: 'call', label: 'Call', icon: '◎', variant: 'call', dynamicLabel: true },
  { id: 'raise', label: 'Raise', icon: '↑', variant: 'raise', dynamicLabel: true },
  { id: 'fold', label: 'Fold', icon: '✕', variant: 'fold' },
];

export default function ActionsBar({
  phase,
  onDeal,
  onCheck,
  onCall,
  onRaise,
  onFold,
  disabled,
  pot,
  currentBet,
  toCall,
  selectedBet,
  humanChips,
}) {
  const inHand = phase !== 'idle' && phase !== 'showdown';
  const handlers = { deal: onDeal, check: onCheck, call: onCall, raise: onRaise, fold: onFold };

  const getLabel = (id, base) => {
    if (id === 'call' && toCall > 0) return `Call ${toCall}`;
    if (id === 'call' && toCall === 0) return 'Check';
    if (id === 'raise') return `Raise +${selectedBet}`;
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
          <span className="actions-bar__hud-label">Puntata attuale</span>
          <span className="actions-bar__hud-value">{currentBet}</span>
        </div>
        <div className="actions-bar__hud-item">
          <span className="actions-bar__hud-label">Le tue chips</span>
          <span className="actions-bar__hud-value actions-bar__hud-value--gold">
            {humanChips?.toLocaleString() ?? '—'}
          </span>
        </div>
      </div>
      <div className="actions-bar__buttons">
        {ACTIONS.map(({ id, label, icon, variant, showWhen }) => {
          const isDeal = id === 'deal';
          const dealOnly = isDeal && showWhen?.includes(phase);
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
