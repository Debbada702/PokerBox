import { useState, useCallback, useEffect, useRef } from 'react';
import {
  createInitialState,
  createGameFromRoster,
  dealHand,
  playerAction,
  getRandomBotAction,
  getHumanPlayer,
  PHASES,
  BIG_BLIND,
} from './game/pokerEngine.js';
import {
  getRoomFromUrl,
  joinRoom,
  leaveRoom,
  buildRoster,
  setRoomPlaying,
} from './services/roomService.js';
import PokerTable from './components/PokerTable.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import HomePage from './components/HomePage.jsx';
import RoomLobby from './components/RoomLobby.jsx';
import AccountMenu from './components/AccountMenu.jsx';
import { useAuth } from './hooks/useAuth.js';
import { useWallet } from './hooks/useWallet.js';
import './App.css';

function App() {
  const {
    user,
    isAuthenticated,
    loading: authLoading,
    error: authError,
    setError,
    register,
    login,
    loginWithGoogle,
    logout: authLogout,
    updateAccount,
    updateChips,
  } = useAuth();

  const [screen, setScreen] = useState('home');
  const [gameState, setGameState] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [selectedBet, setSelectedBet] = useState(BIG_BLIND);
  const [lobbyNotice, setLobbyNotice] = useState(null);

  const wallet = useWallet();
  const botTimerRef = useRef(null);
  const lastSyncedHand = useRef(0);
  const urlRoomHandled = useRef(false);
  const gameStartingRef = useRef(false);

  const handleChipsFromBotti = useCallback(
    (chipsAdded) => {
      if (!user) return;
      updateChips(user.chips + chipsAdded);
    },
    [user, updateChips],
  );

  const walletForHome = { ...wallet, onChipsAdded: handleChipsFromBotti };

  const enterLobby = useCallback((room) => {
    gameStartingRef.current = false;
    setActiveRoom(room);
    setLobbyNotice(null);
    setScreen('lobby');
  }, []);

  const startQuickGame = useCallback(() => {
    if (!user) return;
    setActiveRoom({ code: 'LOCAL', quick: true });
    setGameState(createInitialState(6, user));
    setScreen('game');
    lastSyncedHand.current = 0;
  }, [user]);

  const startGameFromLobby = useCallback(
    (startMode) => {
      if (!user || !activeRoom?.code || gameStartingRef.current === 'done') return;
      const fresh = joinRoom(activeRoom.code, user);
      const room = fresh.ok ? fresh.room : activeRoom;
      const roster = buildRoster(room, startMode, user);
      setRoomPlaying(activeRoom.code, startMode);
      gameStartingRef.current = 'done';
      setActiveRoom({ ...room, startMode });
      setGameState(createGameFromRoster(roster, user));
      setScreen('game');
      lastSyncedHand.current = 0;
    },
    [user, activeRoom],
  );

  const leaveLobby = useCallback(
    (info) => {
      if (activeRoom?.code && activeRoom.code !== 'LOCAL' && user) {
        leaveRoom(activeRoom.code, user.id);
      }
      setActiveRoom(null);
      setLobbyNotice(info?.reason ?? info?.message ?? null);
      setScreen('home');
    },
    [activeRoom, user],
  );

  const leaveGame = useCallback(() => {
    if (gameState && user) {
      const human = getHumanPlayer(gameState);
      if (human) updateChips(human.chips);
    }
    if (activeRoom?.code && activeRoom.code !== 'LOCAL' && user) {
      leaveRoom(activeRoom.code, user.id);
    }
    setGameState(null);
    setActiveRoom(null);
    setScreen('home');
  }, [gameState, user, activeRoom, updateChips]);

  const handleLogout = useCallback(() => {
    if (screen === 'game') leaveGame();
    else if (screen === 'lobby') leaveLobby();
    authLogout();
    setScreen('home');
  }, [screen, leaveGame, leaveLobby, authLogout]);

  useEffect(() => {
    if (!user || urlRoomHandled.current) return;
    const code = getRoomFromUrl();
    if (code) {
      urlRoomHandled.current = true;
      const result = joinRoom(code, user);
      if (result.ok) setTimeout(() => enterLobby(result.room), 0);
    }
  }, [user, enterLobby]);

  useEffect(() => {
    if (screen !== 'game' || !gameState || !user) return;
    if (gameState.phase !== PHASES.SHOWDOWN) return;
    if (gameState.handNumber === lastSyncedHand.current) return;

    const human = getHumanPlayer(gameState);
    if (human && human.chips !== user.chips) {
      lastSyncedHand.current = gameState.handNumber;
      updateChips(human.chips);
    }
  }, [gameState, screen, user, updateChips]);

  useEffect(() => {
    if (screen !== 'game' || !user) return;
    const id = setTimeout(() => {
      setGameState((state) => {
        if (!state) return state;
        return {
          ...state,
          players: state.players.map((player) =>
            player.isHuman ? { ...player, name: user.nametag } : player,
          ),
        };
      });
    }, 0);
    return () => clearTimeout(id);
  }, [screen, user]);

  const handleDeal = useCallback(() => {
    setGameState((s) => dealHand(s));
  }, []);

  const handleAction = useCallback(
    (action) => {
      setGameState((s) => {
        const human = getHumanPlayer(s);
        const humanIndex = s.players.findIndex((p) => p.isHuman);
        const toCall = human ? Math.max(0, s.currentBet - human.currentBet) : 0;
        const opts = { betAmount: selectedBet };

        if (action === 'check' && toCall === 0) return playerAction(s, 'check', opts);
        if (action === 'call' && toCall === 0) return playerAction(s, 'check', opts);

        const next = playerAction(s, action, opts);
        if (human && s.activePlayerIndex === humanIndex) {
          if (action === 'raise' || (action === 'call' && toCall > 0)) {
            wallet.placeBet(action === 'raise' ? toCall + selectedBet : toCall);
          }
        }
        return next;
      });
    },
    [selectedBet, wallet],
  );

  useEffect(() => {
    if (screen !== 'game' || !gameState) return undefined;

    const { phase, players, activePlayerIndex } = gameState;
    const active = players[activePlayerIndex];

    if (
      phase === PHASES.IDLE ||
      phase === PHASES.SHOWDOWN ||
      !active ||
      active.isHuman ||
      active.status !== 'active'
    ) {
      return undefined;
    }

    botTimerRef.current = setTimeout(() => {
      setGameState((s) => {
        const { action, betAmount } = getRandomBotAction(s);
        return playerAction(s, action, { betAmount });
      });
    }, 900);

    return () => clearTimeout(botTimerRef.current);
  }, [gameState, screen]);

  if (!isAuthenticated) {
    return (
      <AuthScreen
        onLogin={login}
        onGoogleLogin={loginWithGoogle}
        onRegister={register}
        loading={authLoading}
        error={authError}
        setError={setError}
      />
    );
  }

  if (screen === 'home') {
    return (
      <HomePage
        user={user}
        onEnterLobby={enterLobby}
        onQuickPlay={startQuickGame}
        onLogout={handleLogout}
        onUpdateAccount={updateAccount}
        accountLoading={authLoading}
        wallet={walletForHome}
        notice={lobbyNotice}
      />
    );
  }

  if (screen === 'lobby' && activeRoom?.code) {
    return (
      <RoomLobby
        roomCode={activeRoom.code}
        user={user}
        onLeave={leaveLobby}
        onStartGame={startGameFromLobby}
        gameStartingRef={gameStartingRef}
      />
    );
  }

  if (!gameState) {
    return <div className="app app--loading">Caricamento tavolo...</div>;
  }

  return (
    <div className="app app--game">
      <header className="app__topbar">
        <button type="button" className="app__back" onClick={leaveGame}>
          ← Menu
        </button>
        <div className="app__user">
          {activeRoom?.code && activeRoom.code !== 'LOCAL' && (
            <span className="app__room-code">Stanza {activeRoom.code}</span>
          )}
          <AccountMenu
            user={user}
            loading={authLoading}
            onUpdateAccount={updateAccount}
            onLogout={handleLogout}
            compact
          />
        </div>
      </header>

      <main className="app__main">
        <PokerTable
          gameState={gameState}
          selectedBet={selectedBet}
          onSelectBet={setSelectedBet}
          onDeal={handleDeal}
          onCheck={() => handleAction('check')}
          onCall={() => handleAction('call')}
          onRaise={() => handleAction('raise')}
          onFold={() => handleAction('fold')}
          userNametag={user.nametag}
        />
      </main>
    </div>
  );
}

export default App;
