import { useMemo, useState } from 'react';
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

export default function ActionFeed({ entries, handNumber, dealerName, handHistory = [] }) {
  const [selectedHand, setSelectedHand] = useState('');
  const currentHand = handHistory.find((hand) => hand.handNumber === handNumber);
  const selectedSummary = useMemo(() => {
    const target = selectedHand || String(handNumber);
    return handHistory.find((hand) => String(hand.handNumber) === target) ?? currentHand;
  }, [currentHand, handHistory, handNumber, selectedHand]);

  return (
    <div className="action-feed" aria-live="polite">
      <div className="action-feed__head">
        <label className="action-feed__hand-picker">
          <span>Mano</span>
          <select
            value={selectedHand || String(handNumber)}
            onChange={(event) => setSelectedHand(event.target.value)}
          >
            {handHistory.map((hand) => (
              <option key={hand.handNumber} value={hand.handNumber}>
                #{hand.handNumber}
              </option>
            ))}
            {handHistory.length === 0 && <option value={handNumber}>#{handNumber}</option>}
          </select>
        </label>
        <strong>{dealerName ? `Dealer: ${dealerName}` : 'In attesa'}</strong>
        {selectedSummary && (
          <div className="action-feed__hand-summary">
            <span>D {selectedSummary.dealerName}</span>
            <span>SB {selectedSummary.smallBlindName}</span>
            <span>BB {selectedSummary.bigBlindName}</span>
          </div>
        )}
      </div>

      {entries.length > 0 ? (
        <ul className="action-feed__history">
          {entries.map((entry) => (
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
