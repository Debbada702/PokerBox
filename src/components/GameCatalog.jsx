import AccountMenu from './AccountMenu.jsx';
import './GameCatalog.css';

const GAMES = [
  {
    id: 'poker',
    title: 'Texas Hold\'em',
    mark: 'P',
    description: 'Stanze private, pubbliche, invito e tavoli con bot opzionali.',
  },
  {
    id: 'blackjack',
    title: 'Blackjack',
    mark: '21',
    description: 'Fino a 4 giocatori contro il banco. Nessun bot.',
  },
];

export default function GameCatalog({ user, onSelectGame, onLogout, onNavigate }) {
  return (
    <div className="game-catalog">
      <header className="game-catalog__header">
        <AccountMenu onLogout={onLogout} onNavigate={onNavigate} triggerLabel="Menu" />
        <div className="game-catalog__brand">
          <span>PB</span>
          <div>
            <h1>PokerBox</h1>
            <p>Rubrica giochi</p>
          </div>
        </div>
        <div className="game-catalog__user">
          <strong>{user.nametag}</strong>
          <span>{user.chips?.toLocaleString()} chips</span>
        </div>
      </header>

      <main className="game-catalog__grid">
        {GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            className={`game-card game-card--${game.id}`}
            onClick={() => onSelectGame(game.id)}
          >
            <span className="game-card__mark">{game.mark}</span>
            <strong>{game.title}</strong>
            <p>{game.description}</p>
            <em>Apri</em>
          </button>
        ))}
      </main>
    </div>
  );
}
