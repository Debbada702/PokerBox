import './WinBurst.css';

function classifyWin(amount, reference) {
  const ratio = amount / Math.max(1, reference);
  if (ratio >= 2.5) return 'mega';
  if (ratio >= 1.25) return 'big';
  if (ratio >= 0.45) return 'medium';
  return 'small';
}

export default function WinBurst({ latest, human }) {
  if (!latest || latest.type !== 'win' || !latest.amount) return null;

  const winnerIds = latest.winnerIds ?? [];
  const humanWon = winnerIds.length > 0
    ? winnerIds.includes(human?.id)
    : latest.playerName === human?.name;
  if (!humanWon) {
    return (
      <div key={latest.id} className="win-burst win-burst--loss" aria-live="polite">
        <span className="win-burst__label">Hai perso</span>
        <strong className="win-burst__amount">-{(human?.committed ?? 0).toLocaleString()}</strong>
      </div>
    );
  }

  const tier = classifyWin(latest.amount, human?.committed || human?.chips || 1);
  const label = {
    small: 'Small win',
    medium: 'Medium win',
    big: 'Big win',
    mega: 'Mega win',
  }[tier];

  return (
    <div key={latest.id} className={`win-burst win-burst--${tier}`} aria-live="polite">
      <span className="win-burst__label">{label}</span>
      <strong className="win-burst__amount">+{latest.amount.toLocaleString()}</strong>
    </div>
  );
}
