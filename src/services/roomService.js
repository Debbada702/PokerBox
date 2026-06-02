/**
 * Stanze mock — in futuro: SQL + WebSocket.
 */

export const MAX_SEATS = 6;

export const START_MODES = {
  HUMANS_ONLY: 'humans_only',
  FILL_BOTS: 'fill_bots',
  ALL_BOTS: 'all_bots',
};

const ROOMS_KEY = 'pokerbox_rooms';
const BOT_NAMES = ['Alex', 'Mia', 'Leo', 'Sara', 'Max', 'Eva'];

function loadRooms() {
  try {
    return JSON.parse(localStorage.getItem(ROOMS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveRooms(rooms) {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function buildInviteLink(code) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?room=${code}`;
}

export function getRoom(code) {
  if (!code || code === 'LOCAL') return null;
  const rooms = loadRooms();
  return rooms[code.toUpperCase()] ?? null;
}

/** @returns {{ ok: boolean, room?: object, link?: string, error?: string }} */
export function createRoom(host) {
  const rooms = loadRooms();
  let code = generateCode();
  while (rooms[code]) code = generateCode();

  const room = {
    code,
    hostId: host.id,
    hostNametag: host.nametag,
    createdAt: new Date().toISOString(),
    status: 'waiting',
    maxSeats: MAX_SEATS,
    players: [
      {
        id: host.id,
        nametag: host.nametag,
        joinedAt: new Date().toISOString(),
      },
    ],
  };

  rooms[code] = room;
  saveRooms(rooms);
  return { ok: true, room, link: buildInviteLink(code) };
}

/** @returns {{ ok: boolean, room?: object, error?: string }} */
export function joinRoom(code, user) {
  const clean = code.trim().toUpperCase();
  if (!clean) return { ok: false, error: 'Inserisci un codice stanza' };

  const rooms = loadRooms();
  const room = rooms[clean];
  if (!room) return { ok: false, error: 'Stanza non trovata' };
  if (room.status === 'playing') {
    return { ok: false, error: 'Partita già in corso' };
  }
  if (room.players.length >= room.maxSeats) {
    return { ok: false, error: 'Stanza piena' };
  }

  if (!room.players.some((p) => p.id === user.id)) {
    room.players.push({
      id: user.id,
      nametag: user.nametag,
      joinedAt: new Date().toISOString(),
    });
    rooms[clean] = room;
    saveRooms(rooms);
  }

  return { ok: true, room: { ...room } };
}

export function leaveRoom(code, userId) {
  const rooms = loadRooms();
  const room = rooms[code?.toUpperCase()];
  if (!room) return null;

  room.players = room.players.filter((p) => p.id !== userId);

  if (room.players.length === 0) {
    delete rooms[room.code];
    saveRooms(rooms);
    return null;
  }

  if (room.hostId === userId) {
    room.hostId = room.players[0].id;
    room.hostNametag = room.players[0].nametag;
  }

  rooms[room.code] = room;
  saveRooms(rooms);
  return room;
}

/** @returns {{ ok: boolean, room?: object, error?: string }} */
export function kickPlayer(code, hostId, targetId) {
  const rooms = loadRooms();
  const room = rooms[code?.toUpperCase()];
  if (!room) return { ok: false, error: 'Stanza non trovata' };
  if (room.hostId !== hostId) return { ok: false, error: 'Solo l\'host può espellere' };
  if (targetId === hostId) return { ok: false, error: 'Non puoi espellere te stesso' };

  const exists = room.players.some((p) => p.id === targetId);
  if (!exists) return { ok: false, error: 'Giocatore non in stanza' };

  room.players = room.players.filter((p) => p.id !== targetId);
  rooms[room.code] = room;
  saveRooms(rooms);
  return { ok: true, room: { ...room } };
}

export function setRoomPlaying(code, startMode) {
  const rooms = loadRooms();
  const room = rooms[code?.toUpperCase()];
  if (!room) return null;
  room.status = 'playing';
  room.startMode = startMode;
  room.startedAt = new Date().toISOString();
  rooms[room.code] = room;
  saveRooms(rooms);
  return room;
}

export function getRoomFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room')?.toUpperCase() ?? null;
}

/**
 * Costruisce il roster per il motore di gioco.
 * @param {object} room
 * @param {string} startMode - START_MODES
 * @param {object} currentUser - utente locale { id, nametag, chips }
 */
export function buildRoster(room, startMode, currentUser) {
  const roster = [];

  if (startMode === START_MODES.ALL_BOTS) {
    roster.push({
      userId: currentUser.id,
      nametag: currentUser.nametag,
      isHuman: true,
      isBot: false,
    });
    for (let i = 0; i < MAX_SEATS - 1; i++) {
      roster.push({
        userId: null,
        nametag: BOT_NAMES[i],
        isHuman: false,
        isBot: true,
      });
    }
    return roster;
  }

  const humans = room.players.map((p) => ({
    userId: p.id,
    nametag: p.nametag,
    isHuman: p.id === currentUser.id,
    isBot: false,
  }));

  if (startMode === START_MODES.HUMANS_ONLY) {
    return humans;
  }

  if (startMode === START_MODES.FILL_BOTS) {
    roster.push(...humans);
    let botIdx = 0;
    while (roster.length < MAX_SEATS) {
      roster.push({
        userId: null,
        nametag: BOT_NAMES[botIdx % BOT_NAMES.length],
        isHuman: false,
        isBot: true,
      });
      botIdx++;
    }
    return roster;
  }

  return humans;
}

export function validateStart(room, startMode) {
  const count = room.players.length;

  if (startMode === START_MODES.ALL_BOTS) {
    return { ok: true };
  }
  if (startMode === START_MODES.HUMANS_ONLY) {
    if (count < 2) {
      return { ok: false, error: 'Servono almeno 2 giocatori (solo persone reali)' };
    }
    return { ok: true };
  }
  if (startMode === START_MODES.FILL_BOTS) {
    if (count < 1) {
      return { ok: false, error: 'Serve almeno 1 giocatore' };
    }
    return { ok: true };
  }
  return { ok: false, error: 'Modalità non valida' };
}
