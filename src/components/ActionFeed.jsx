import './ActionFeed.css';

const TYPE_ICONS = {
  fold: 'X',
  check: 'OK',
  call: 'C',
  raise: '+',
  bet: '+',
  blind: 'B',
  win: 'W',
  phase: '>',
  info: 'i',
};

export default function ActionFeed({ entries, handNumber, dealerName }) {
  const visibleEntries = entries.slice(0, 4);

  return (
    <div className="action-feed" aria-live="polite">
      <div className="action-feed__head">
        <span>Mano #{handNumber}</span>
        <strong>{dealerName ? `Dealer: ${dealerName}` : 'In attesa'}</strong>
      </div>

      {visibleEntries.length > 0 ? (
        <ul className="action-feed__history">
          {visibleEntries.map((entry) => (
            <li key={entry.id} className={`action-feed__item action-feed__item--${entry.type}`}>
              <span className="action-feed__item-icon" aria-hidden>
                {TYPE_ICONS[entry.type] ?? 'i'}
              </span>
              <span>
                {entry.playerName && (
                  <strong>{entry.playerName}: </strong>
                )}
                {entry.text}
                {entry.amount != null && entry.amount > 0 && (
                  <em> ({entry.amount})</em>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="action-feed__empty">Le ultime 4 azioni appariranno qui.</p>
      )}
    </div>
  );
}
