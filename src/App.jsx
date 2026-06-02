import { useState, useCallback, useEffect, useRef } from 'react';
import {
  createInitialState,
  createGameFromRoster,
  dealHand,
  playerAction,
  getRandomBotAction,
  getHumanPlayer,
  withHumanPerspective,
  PHASES,
  BIG_BLIND,
} from './game/pokerEngine.js';
import {
  getRoomFromUrl,
  joinRoom,
  leaveRoom,
  buildRoster,
  setRoomPlaying,
  getRoomGameState,
  saveRoomGameState,
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
  const lastSyncedChips = useRef(null);
  const urlRoomHandled = useRef(false);
  const gameStartingRef = useRef(false);
  const sharedSaveRef = useRef(false);

  const isSharedRoom = activeRoom?.code && activeRoom.code !== 'LOCAL';
  const isRoomHost = isSharedRoom && activeRoom?.hostId === user?.id;
  const shouldPersistChips = !!isSharedRoom;

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
    lastSyncedChips.current = user.chips;
  }, [user]);

  const startGameFromLobby = useCallback(
    async (startMode, lobbyRoom = null) => {
      if (!user || !activeRoom?.code || gameStartingRef.current === 'done') return;
      const fresh = lobbyRoom ? { ok: true, room: lobbyRoom } : await joinRoom(activeRoom.code, user);
      const room = fresh.ok ? fresh.room : activeRoom;
      let nextGame = room.gameState ?? await getRoomGameState(activeRoom.code);

      if (!nextGame && room.hostId === user.id) {
        const roster = buildRoster(room, startMode, user);
        nextGame = createGameFromRoster(roster, user);
        await saveRoomGameState(activeRoom.code, nextGame);
        await setRoomPlaying(activeRoom.code, startMode);
      }

      gameStartingRef.current = 'done';
      setActiveRoom({ ...room, startMode });
      setGameState(withHumanPerspective(nextGame ?? createGameFromRoster(buildRoster(room, startMode, user), user), user));
      setScreen('game');
      lastSyncedChips.current = user.chips;
    },
    [user, activeRoom],
  );

  const leaveLobby = useCallback(
    (info) => {
      if (activeRoom?.code && activeRoom.code !== 'LOCAL' && user) {
        void leaveRoom(activeRoom.code, user.id);
      }
      setActiveRoom(null);
      setLobbyNotice(info?.reason ?? info?.message ?? null);
      setScreen('home');
    },
    [activeRoom, user],
  );

  const leaveGame = useCallback(() => {
    if (shouldPersistChips && gameState && user) {
      const human = getHumanPlayer(gameState);
      if (human) updateChips(human.chips);
    }
    if (activeRoom?.code && activeRoom.code !== 'LOCAL' && user) {
      void leaveRoom(activeRoom.code, user.id);
    }
    setGameState(null);
    setActiveRoom(null);
    setScreen('home');
  }, [shouldPersistChips, gameState, user, activeRoom, updateChips]);

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
      void joinRoom(code, user).then((result) => {
        if (result.ok) setTimeout(() => enterLobby(result.room), 0);
      });
    }
  }, [user, enterLobby]);

  useEffect(() => {
    if (!shouldPersistChips || screen !== 'game' || !gameState || !user) return;
    const human = getHumanPlayer(gameState);
    if (human && human.chips !== lastSyncedChips.current) {
      lastSyncedChips.current = human.chips;
      updateChips(human.chips);
    }
  }, [shouldPersistChips, gameState, screen, user, updateChips]);

  useEffect(() => {
    if (screen !== 'game' || !user) return;
    const id = setTimeout(() => {
      setGameState((state) => {
        if (!state) return state;
        return {
          ...state,
          players: state.players.map((player) =>
            player.isHuman ? { ...player, name: user.nametag } : { ...player, isHuman: !player.isBot && player.userId === user.id },
          ),
        };
      });
    }, 0);
    return () => clearTimeout(id);
  }, [screen, user]);

  useEffect(() => {
    if (!isSharedRoom || screen !== 'game' || !user) return undefined;

    const id = setInterval(async () => {
      const remote = await getRoomGameState(activeRoom.code);
      if (!remote) return;
      if (sharedSaveRef.current) {
        sharedSaveRef.current = false;
        return;
      }
      setGameState(withHumanPerspective(remote, user));
    }, 900);

    return () => clearInterval(id);
  }, [isSharedRoom, screen, user, activeRoom?.code]);

  const persistGameState = useCallback(
    async (next) => {
      if (!isSharedRoom || !activeRoom?.code) return;
      sharedSaveRef.current = true;
      await saveRoomGameState(activeRoom.code, next);
    },
    [isSharedRoom, activeRoom],
  );

  const handleDeal = useCallback(() => {
    setGameState((s) => {
      if (!s) return s;
      if (isSharedRoom && !isRoomHost) return s;
      const next = dealHand(s);
      void persistGameState(next);
      return withHumanPerspective(next, user);
    });
  }, [isSharedRoom, isRoomHost, persistGameState, user]);

  const handleAction = useCallback(
    (action) => {
      if (action === 'allin') {
        const human = getHumanPlayer(gameState);
        if (!human || !window.confirm(`Vuoi davvero andare all-in con ${human.chips.toLocaleString()} chips?`)) {
          return;
        }
      }

      setGameState((s) => {
        if (!s) return s;
        const human = getHumanPlayer(s);
        const humanIndex = s.players.findIndex((p) => p.isHuman);
        if (humanIndex !== s.activePlayerIndex) return s;
        const toCall = human ? Math.max(0, s.currentBet - human.currentBet) : 0;
        const opts = { betAmount: selectedBet };

        if (action === 'check' && toCall === 0) {
          const next = playerAction(s, 'check', opts);
          void persistGameState(next);
          return withHumanPerspective(next, user);
        }
        if (action === 'call' && toCall === 0) {
          const next = playerAction(s, 'check', opts);
          void persistGameState(next);
          return withHumanPerspective(next, user);
        }

        const next = playerAction(s, action, opts);
        if (human && s.activePlayerIndex === humanIndex) {
          if (action === 'raise' || (action === 'call' && toCall > 0)) {
            wallet.placeBet(action === 'raise' ? toCall + selectedBet : toCall);
          }
        }
        void persistGameState(next);
        return withHumanPerspective(next, user);
      });
    },
    [selectedBet, wallet, persistGameState, user, gameState],
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
      (!active.isBot && isSharedRoom) ||
      (active.isBot && isSharedRoom && !isRoomHost) ||
      active.status !== 'active'
    ) {
      return undefined;
    }

    botTimerRef.current = setTimeout(() => {
      setGameState((s) => {
        const { action, betAmount } = getRandomBotAction(s);
        const next = playerAction(s, action, { betAmount });
        void persistGameState(next);
        return withHumanPerspective(next, user);
      });
    }, 900);

    return () => clearTimeout(botTimerRef.current);
  }, [gameState, screen, isSharedRoom, isRoomHost, persistGameState, user]);

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
          {'<- Menu'}
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
          canDeal={!isSharedRoom || isRoomHost}
          onCheck={() => handleAction('check')}
          onCall={() => handleAction('call')}
          onRaise={() => handleAction('raise')}
          onAllIn={() => handleAction('allin')}
          onFold={() => handleAction('fold')}
          userNametag={user.nametag}
          roomCode={activeRoom?.code}
          user={user}
        />
      </main>
    </div>
  );
}

export default App;
