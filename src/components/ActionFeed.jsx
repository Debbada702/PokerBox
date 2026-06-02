import './ActionFeed.css';

const TYPE_ICONS = {
  fold: '✕',
  check: '✓',
  call: '◎',
  raise: '↑',
  bet: '↑',
  blind: '◆',
  win: '★',
  phase: '•',
  info: 'ℹ',
};

export default function ActionFeed({ entries, latest }) {
  return (
    <div className="action-feed" aria-live="polite">
      {latest && (
        <div className={`action-feed__banner action-feed__banner--${latest.type}`}>
          <span className="action-feed__banner-icon" aria-hidden>
            {TYPE_ICONS[latest.type] ?? '•'}
          </span>
          <div className="action-feed__banner-text">
            {latest.playerName && (
              <strong className="action-feed__banner-player">{latest.playerName}</strong>
            )}
            <span>{latest.text}</span>
          </div>
          {latest.amount != null && latest.amount > 0 && (
            <span className="action-feed__banner-amount">+{latest.amount}</span>
          )}
        </div>
      )}

      {entries.length > 1 && (
        <ul className="action-feed__history">
          {entries.slice(1, 6).map((entry) => (
            <li key={entry.id} className={`action-feed__item action-feed__item--${entry.type}`}>
              <span className="action-feed__item-icon" aria-hidden>
                {TYPE_ICONS[entry.type] ?? '•'}
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
      )}
    </div>
  );
}
