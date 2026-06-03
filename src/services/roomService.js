import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';

export const MAX_SEATS = 6;

export const START_MODES = {
  HUMANS_ONLY: 'humans_only',
  FILL_BOTS: 'fill_bots',
  ALL_BOTS: 'all_bots',
};

const ROOMS_KEY = 'pokerbox_rooms';
const ROOMS_TABLE = 'rooms';
const ROOM_PLAYERS_TABLE = 'room_players';
const ROOM_MESSAGES_TABLE = 'room_messages';
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
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function buildInviteLink(code) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?room=${code}`;
}

export async function getRoom(code) {
  if (!code || code === 'LOCAL') return null;
  if (isSupabaseConfigured) return getRoomSupabase(code);
  const rooms = loadRooms();
  return rooms[code.toUpperCase()] ?? null;
}

export async function createRoom(host, isPublic = false) {
  if (isSupabaseConfigured) return createRoomSupabase(host, isPublic);

  const rooms = loadRooms();
  let code = generateCode();
  while (rooms[code]) code = generateCode();

  const room = {
    code,
    hostId: host.id,
    hostNametag: host.nametag,
    createdAt: new Date().toISOString(),
    status: 'waiting',
    isPublic,
    maxSeats: MAX_SEATS,
    players: [
      {
        id: host.id,
        nametag: host.nametag,
        chips: host.chips,
        joinedAt: new Date().toISOString(),
      },
    ],
  };

  rooms[code] = room;
  saveRooms(rooms);
  return { ok: true, room, link: buildInviteLink(code) };
}

export async function joinRoom(code, user) {
  if (isSupabaseConfigured) return joinRoomSupabase(code, user);

  const clean = code.trim().toUpperCase();
  if (!clean) return { ok: false, error: 'Inserisci un codice stanza' };

  const rooms = loadRooms();
  const room = rooms[clean];
  if (!room) return { ok: false, error: 'Stanza non trovata' };
  if (room.status === 'playing') return { ok: false, error: 'Partita gia in corso' };
  if (room.players.length >= room.maxSeats) return { ok: false, error: 'Stanza piena' };

  if (!room.players.some((p) => p.id === user.id)) {
    room.players.push({
        id: user.id,
        nametag: user.nametag,
        chips: user.chips,
      joinedAt: new Date().toISOString(),
    });
    rooms[clean] = room;
    saveRooms(rooms);
  }

  return { ok: true, room: { ...room } };
}

export async function leaveRoom(code, userId) {
  if (isSupabaseConfigured) return leaveRoomSupabase(code, userId);

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

export async function kickPlayer(code, hostId, targetId) {
  if (isSupabaseConfigured) return kickPlayerSupabase(code, hostId, targetId);

  const rooms = loadRooms();
  const room = rooms[code?.toUpperCase()];
  if (!room) return { ok: false, error: 'Stanza non trovata' };
  if (room.hostId !== hostId) return { ok: false, error: 'Solo l host puo espellere' };
  if (targetId === hostId) return { ok: false, error: 'Non puoi espellere te stesso' };

  const exists = room.players.some((p) => p.id === targetId);
  if (!exists) return { ok: false, error: 'Giocatore non in stanza' };

  room.players = room.players.filter((p) => p.id !== targetId);
  rooms[room.code] = room;
  saveRooms(rooms);
  return { ok: true, room: { ...room } };
}

export async function setRoomPlaying(code, startMode) {
  if (isSupabaseConfigured) return setRoomPlayingSupabase(code, startMode);

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

export async function saveRoomGameState(code, gameState) {
  if (!code || code === 'LOCAL') return { ok: true };
  if (isSupabaseConfigured) return saveRoomGameStateSupabase(code, gameState);

  const rooms = loadRooms();
  const room = rooms[code?.toUpperCase()];
  if (!room) return { ok: false, error: 'Stanza non trovata' };
  room.gameState = gameState;
  room.gameUpdatedAt = new Date().toISOString();
  rooms[room.code] = room;
  saveRooms(rooms);
  return { ok: true, room };
}

export async function getRoomGameState(code) {
  if (!code || code === 'LOCAL') return null;
  if (isSupabaseConfigured) return getRoomGameStateSupabase(code);

  const rooms = loadRooms();
  return rooms[code?.toUpperCase()]?.gameState ?? null;
}

export async function listRoomMessages(code) {
  if (!code || code === 'LOCAL') return { ok: true, messages: [] };
  if (isSupabaseConfigured) return listRoomMessagesSupabase(code);

  const rooms = loadRooms();
  return { ok: true, messages: rooms[code?.toUpperCase()]?.messages ?? [] };
}

export async function sendRoomMessage(code, user, text) {
  if (!code || code === 'LOCAL') return { ok: false, error: 'Chat disponibile solo nelle stanze' };
  const cleanText = text.trim().slice(0, 300);
  if (!cleanText) return { ok: false, error: 'Messaggio vuoto' };
  if (isSupabaseConfigured) return sendRoomMessageSupabase(code, user, cleanText);

  const rooms = loadRooms();
  const room = rooms[code?.toUpperCase()];
  if (!room) return { ok: false, error: 'Stanza non trovata' };
  const message = {
    id: `${Date.now()}-${user.id}`,
    userId: user.id,
    nametag: user.nametag,
    text: cleanText,
    createdAt: new Date().toISOString(),
  };
  room.messages = [...(room.messages ?? []), message].slice(-40);
  rooms[room.code] = room;
  saveRooms(rooms);
  return { ok: true, messages: room.messages };
}

export async function listPublicRooms() {
  if (isSupabaseConfigured) return listPublicRoomsSupabase();
  const rooms = Object.values(loadRooms())
    .filter((room) => room.isPublic && room.status === 'waiting')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { ok: true, rooms };
}

export function getRoomFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room')?.toUpperCase() ?? null;
}

export function buildRoster(room, startMode, currentUser) {
  const roster = [];

  if (startMode === START_MODES.ALL_BOTS) {
    roster.push({
      userId: currentUser.id,
      nametag: currentUser.nametag,
      chips: currentUser.chips,
      isHuman: true,
      isBot: false,
    });
    for (let i = 0; i < MAX_SEATS - 1; i += 1) {
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
    chips: p.id === currentUser.id ? currentUser.chips : (p.chips ?? 0),
    isHuman: p.id === currentUser.id,
    isBot: false,
  }));

  if (startMode === START_MODES.HUMANS_ONLY) return humans;

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
      botIdx += 1;
    }
    return roster;
  }

  return humans;
}

export function validateStart(room, startMode) {
  const count = room.players.length;

  if (startMode === START_MODES.ALL_BOTS) return { ok: true };
  if (startMode === START_MODES.HUMANS_ONLY) {
    if (count < 2) return { ok: false, error: 'Servono almeno 2 giocatori (solo persone reali)' };
    return { ok: true };
  }
  if (startMode === START_MODES.FILL_BOTS) {
    if (count < 1) return { ok: false, error: 'Serve almeno 1 giocatore' };
    return { ok: true };
  }
  return { ok: false, error: 'Modalita non valida' };
}

function roomFromSupabase(row) {
  if (!row) return null;
  const players = (row.room_players ?? [])
    .slice()
    .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())
    .map((p) => ({
      id: p.user_id,
      nametag: p.nametag,
      chips: p.chips ?? 0,
      joinedAt: p.joined_at,
    }));

  return {
    code: row.code,
    hostId: row.host_id,
    hostNametag: row.host_nametag,
    createdAt: row.created_at,
    status: row.status,
    maxSeats: row.max_seats ?? MAX_SEATS,
    startMode: row.start_mode,
    startedAt: row.started_at,
    gameState: row.game_state,
    gameUpdatedAt: row.game_updated_at,
    isPublic: !!row.is_public,
    players,
  };
}

async function getRoomSupabase(code) {
  const clean = code?.toUpperCase();
  if (!clean) return null;

  let selectFields = `
    code,
    host_id,
    host_nametag,
    created_at,
    status,
    max_seats,
    start_mode,
    started_at,
    game_state,
    game_updated_at,
    is_public,
    room_players(user_id, nametag, chips, joined_at)
  `;

  let { data, error } = await supabase
    .from(ROOMS_TABLE)
    .select(selectFields)
    .eq('code', clean)
    .maybeSingle();

  if (error?.message?.includes('chips')) {
    selectFields = selectFields.replace('room_players(user_id, nametag, chips, joined_at)', 'room_players(user_id, nametag, joined_at)');
    ({ data, error } = await supabase
      .from(ROOMS_TABLE)
      .select(selectFields)
      .eq('code', clean)
      .maybeSingle());
  }

  if (error?.message?.includes('is_public')) {
    selectFields = selectFields
      .replace('is_public,', '')
      .replace('is_public', '');
    ({ data, error } = await supabase
      .from(ROOMS_TABLE)
      .select(selectFields)
      .eq('code', clean)
      .maybeSingle());
  }

  if (error) return null;
  return roomFromSupabase(data);
}

async function createRoomSupabase(host, isPublic = false) {
  let code = generateCode();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    let { error } = await supabase.from(ROOMS_TABLE).insert({
      code,
      host_id: host.id,
      host_nametag: host.nametag,
      status: 'waiting',
      max_seats: MAX_SEATS,
      is_public: isPublic,
    });
    if (error?.message?.includes('is_public')) {
      ({ error } = await supabase.from(ROOMS_TABLE).insert({
        code,
        host_id: host.id,
        host_nametag: host.nametag,
        status: 'waiting',
        max_seats: MAX_SEATS,
      }));
    }

    if (!error) {
      const { error: playerError } = await insertRoomPlayerSupabase(code, host);
      if (playerError) return { ok: false, error: playerError.message };

      return { ok: true, room: await getRoomSupabase(code), link: buildInviteLink(code) };
    }

    if (error.code !== '23505') return { ok: false, error: error.message };
    code = generateCode();
  }

  return { ok: false, error: 'Impossibile creare una stanza unica' };
}

async function listPublicRoomsSupabase() {
  let { data, error } = await supabase
    .from(ROOMS_TABLE)
    .select(`
      code,
      host_id,
      host_nametag,
      created_at,
      status,
      max_seats,
      start_mode,
      started_at,
      game_state,
      game_updated_at,
      is_public,
      room_players(user_id, nametag, chips, joined_at)
    `)
    .eq('status', 'waiting')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error?.message?.includes('chips')) {
    ({ data, error } = await supabase
      .from(ROOMS_TABLE)
      .select(`
        code,
        host_id,
        host_nametag,
        created_at,
        status,
        max_seats,
        start_mode,
        started_at,
        game_state,
        game_updated_at,
        is_public,
        room_players(user_id, nametag, joined_at)
      `)
      .eq('status', 'waiting')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(30));
  }

  if (error) {
    return {
      ok: false,
      error: 'Per usare le stanze pubbliche aggiungi la colonna is_public alla tabella rooms.',
      rooms: [],
    };
  }
  return { ok: true, rooms: (data ?? []).map(roomFromSupabase) };
}

async function joinRoomSupabase(code, user) {
  const clean = code.trim().toUpperCase();
  if (!clean) return { ok: false, error: 'Inserisci un codice stanza' };

  const room = await getRoomSupabase(clean);
  if (!room) return { ok: false, error: 'Stanza non trovata' };
  if (room.status === 'playing') return { ok: false, error: 'Partita gia in corso' };
  if (room.players.length >= room.maxSeats && !room.players.some((p) => p.id === user.id)) {
    return { ok: false, error: 'Stanza piena' };
  }

  if (!room.players.some((p) => p.id === user.id)) {
    const { error } = await insertRoomPlayerSupabase(clean, user);
    if (error && error.code !== '23505') return { ok: false, error: error.message };
  }

  return { ok: true, room: await getRoomSupabase(clean) };
}

async function insertRoomPlayerSupabase(roomCode, user) {
  let { error } = await supabase.from(ROOM_PLAYERS_TABLE).insert({
    room_code: roomCode,
    user_id: user.id,
    nametag: user.nametag,
    chips: user.chips ?? 0,
  });

  if (error?.message?.includes('chips')) {
    ({ error } = await supabase.from(ROOM_PLAYERS_TABLE).insert({
      room_code: roomCode,
      user_id: user.id,
      nametag: user.nametag,
    }));
  }

  return { error };
}

async function leaveRoomSupabase(code, userId) {
  const clean = code?.toUpperCase();
  if (!clean) return null;

  await supabase.from(ROOM_PLAYERS_TABLE).delete().eq('room_code', clean).eq('user_id', userId);

  const room = await getRoomSupabase(clean);
  if (!room) return null;

  if (room.players.length === 0) {
    await supabase.from(ROOMS_TABLE).delete().eq('code', clean);
    return null;
  }

  if (room.hostId === userId) {
    const nextHost = room.players[0];
    await supabase
      .from(ROOMS_TABLE)
      .update({ host_id: nextHost.id, host_nametag: nextHost.nametag })
      .eq('code', clean);
    return getRoomSupabase(clean);
  }

  return room;
}

async function kickPlayerSupabase(code, hostId, targetId) {
  const clean = code?.toUpperCase();
  const room = await getRoomSupabase(clean);
  if (!room) return { ok: false, error: 'Stanza non trovata' };
  if (room.hostId !== hostId) return { ok: false, error: 'Solo l host puo espellere' };
  if (targetId === hostId) return { ok: false, error: 'Non puoi espellere te stesso' };

  const { error } = await supabase
    .from(ROOM_PLAYERS_TABLE)
    .delete()
    .eq('room_code', clean)
    .eq('user_id', targetId);
  if (error) return { ok: false, error: error.message };

  return { ok: true, room: await getRoomSupabase(clean) };
}

async function setRoomPlayingSupabase(code, startMode) {
  const clean = code?.toUpperCase();
  if (!clean) return null;

  const { error } = await supabase
    .from(ROOMS_TABLE)
    .update({
      status: 'playing',
      start_mode: startMode,
      started_at: new Date().toISOString(),
    })
    .eq('code', clean);

  if (error) return null;
  return getRoomSupabase(clean);
}

async function saveRoomGameStateSupabase(code, gameState) {
  const clean = code?.toUpperCase();
  if (!clean) return { ok: false, error: 'Codice stanza mancante' };

  const { data, error } = await supabase
    .from(ROOMS_TABLE)
    .update({
      game_state: gameState,
      game_updated_at: new Date().toISOString(),
    })
    .eq('code', clean)
    .select('code')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, room: data };
}

async function getRoomGameStateSupabase(code) {
  const clean = code?.toUpperCase();
  if (!clean) return null;

  const { data, error } = await supabase
    .from(ROOMS_TABLE)
    .select('game_state')
    .eq('code', clean)
    .maybeSingle();

  if (error) return null;
  return data?.game_state ?? null;
}

function messageFromSupabase(row) {
  return {
    id: row.id,
    userId: row.user_id,
    nametag: row.nametag,
    text: row.text,
    createdAt: row.created_at,
  };
}

async function listRoomMessagesSupabase(code) {
  const clean = code?.toUpperCase();
  if (!clean) return { ok: true, messages: [] };

  const { data, error } = await supabase
    .from(ROOM_MESSAGES_TABLE)
    .select('id, user_id, nametag, text, created_at')
    .eq('room_code', clean)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) return { ok: false, error: error.message, messages: [] };
  return { ok: true, messages: (data ?? []).slice().reverse().map(messageFromSupabase) };
}

async function sendRoomMessageSupabase(code, user, text) {
  const clean = code?.toUpperCase();
  const { error } = await supabase.from(ROOM_MESSAGES_TABLE).insert({
    room_code: clean,
    user_id: user.id,
    nametag: user.nametag,
    text,
  });

  if (error) return { ok: false, error: error.message, messages: [] };
  return listRoomMessagesSupabase(clean);
}
