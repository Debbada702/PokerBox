import { isSupabaseConfigured, supabase, supabaseConfig } from '../lib/supabaseClient.js';

const USERS_KEY = 'pokerbox_players';
const SESSION_KEY = 'pokerbox_session';
const STARTING_CHIPS = 10_000;

const PLAYERS_TABLE = 'players';

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/** @returns {Promise<{ ok: boolean, user?: object, error?: string }>} */
export async function register({ email, password, nametag }) {
  if (isSupabaseConfigured) {
    return registerSupabase({ email, password, nametag });
  }

  await delay(300);

  const cleanEmail = normalizeEmail(email);
  const cleanTag = nametag.trim();
  const cleanPass = password;

  if (!cleanEmail || !cleanPass || !cleanTag) {
    return { ok: false, error: 'Compila tutti i campi' };
  }
  if (cleanPass.length < 6) {
    return { ok: false, error: 'Password minimo 6 caratteri' };
  }
  if (cleanTag.length < 3) {
    return { ok: false, error: 'Nametag minimo 3 caratteri' };
  }

  const users = loadUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    return { ok: false, error: 'Email già registrata' };
  }
  if (users.some((u) => u.nametag.toLowerCase() === cleanTag.toLowerCase())) {
    return { ok: false, error: 'Nametag già in uso' };
  }

  const user = {
    id: nextId(users),
    nametag: cleanTag,
    email: cleanEmail,
    password: cleanPass,
    chips: STARTING_CHIPS,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);
  setSession(user);

  return { ok: true, user: withoutPassword(user) };
}

/** @returns {Promise<{ ok: boolean, user?: object, error?: string }>} */
export async function login({ email, password }) {
  if (isSupabaseConfigured) {
    return loginSupabase({ email, password });
  }

  await delay(300);

  const cleanEmail = normalizeEmail(email);
  const users = loadUsers();
  const found = users.find((u) => u.email === cleanEmail);

  if (!found || found.password !== password) {
    return { ok: false, error: 'Email o password non corretti' };
  }

  setSession(found);
  return { ok: true, user: withoutPassword(found) };
}

/**
 * Login Google frontend-only via ID token (GIS).
 * Se utente non esiste, viene creato automaticamente.
 */
export async function loginWithGoogleCredential(credential) {
  if (isSupabaseConfigured) {
    return loginGoogleSupabase(credential);
  }

  await delay(150);

  if (!credential) {
    return { ok: false, error: 'Credenziale Google non valida' };
  }

  let payload;
  try {
    payload = decodeJwtPayload(credential);
  } catch {
    return { ok: false, error: 'Impossibile leggere token Google' };
  }

  const email = normalizeEmail(payload?.email ?? '');
  const verified = !!payload?.email_verified;
  const name = (payload?.name ?? payload?.given_name ?? '').trim();
  const sub = payload?.sub;

  if (!email || !verified || !sub) {
    return { ok: false, error: 'Account Google non valido o non verificato' };
  }

  const users = loadUsers();
  let found = users.find((u) => u.email === email);

  if (!found) {
    const baseTag = sanitizeNametag(name || email.split('@')[0] || 'Player');
    const uniqueTag = getUniqueNametag(users, baseTag);
    found = {
      id: nextId(users),
      nametag: uniqueTag,
      email,
      password: null,
      chips: STARTING_CHIPS,
      authProvider: 'google',
      googleSub: sub,
      createdAt: new Date().toISOString(),
    };
    users.push(found);
    saveUsers(users);
  } else if (!found.googleSub) {
    // Migrazione utenti esistenti login/password verso Google
    found.googleSub = sub;
    found.authProvider = found.authProvider ?? 'local';
    saveUsers(users);
  }

  setSession(found);
  return { ok: true, user: withoutPassword(found) };
}

export async function loginWithGoogleOAuth() {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Configura Supabase per usare Google OAuth' };
  }

  const redirectTo = supabaseConfig.redirectUrl || `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, redirecting: true };
}

export function logout() {
  if (isSupabaseConfigured && supabase) {
    supabase.auth.signOut().catch(() => {});
  }
  localStorage.removeItem(SESSION_KEY);
}

export function subscribeToAuthChanges(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session?.user) {
      localStorage.removeItem(SESSION_KEY);
      onChange(null);
      return;
    }

    setTimeout(async () => {
      const result = await buildSafeUserFromSupabaseUser(session.user);
      onChange(result.ok ? result.user : null, result.error);
    }, 0);
  });

  return () => data.subscription.unsubscribe();
}

export async function handleOAuthRedirect() {
  if (!isSupabaseConfigured || !supabase) return { ok: false };

  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const hasOAuthHash = window.location.hash.includes('access_token=');
  const hasOAuthError = url.searchParams.has('error') || window.location.hash.includes('error=');

  if (hasOAuthError) {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, '') || url.search);
    const rawError = params.get('error_description') || params.get('error') || 'Login Google non completato';
    return {
      ok: false,
      error: formatOAuthError(rawError),
    };
  }

  if (!code && !hasOAuthHash) return { ok: false };

  if (hasOAuthHash) {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) return { ok: false, error: error.message };
    }
  }

  if (code) {
    const existing = await supabase.auth.getSession();
    if (!existing.data.session) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return { ok: false, error: error.message };
    }
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) return { ok: false, error: error.message };
  if (!data.session?.user) return { ok: false };

  cleanOAuthUrl();
  return buildSafeUserFromSupabaseUser(data.session.user);
}

export async function getCurrentUser() {
  if (isSupabaseConfigured) {
    return getCurrentUserSupabase();
  }

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Aggiorna chips in sessione (dopo mano) — poi sincronizzare con SQL */
export async function saveUserChips(userId, chips) {
  if (isSupabaseConfigured) {
    return saveUserChipsSupabase(userId, chips);
  }

  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx >= 0) {
    users[idx].chips = chips;
    saveUsers(users);
  }
  const session = await getCurrentUser();
  if (session?.id === userId) {
    setSession({ ...session, chips });
  }
}

export async function updateAccount({ id, nametag, email, password }) {
  if (isSupabaseConfigured) {
    return updateAccountSupabase({ nametag, email, password });
  }

  const cleanTag = nametag.trim();
  const cleanEmail = normalizeEmail(email);
  const cleanPass = password?.trim();

  if (!cleanTag || cleanTag.length < 3) {
    return { ok: false, error: 'Nametag minimo 3 caratteri' };
  }
  if (!cleanEmail) {
    return { ok: false, error: 'Email non valida' };
  }
  if (cleanPass && cleanPass.length < 6) {
    return { ok: false, error: 'Password minimo 6 caratteri' };
  }

  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return { ok: false, error: 'Utente non trovato' };
  if (users.some((u) => u.id !== id && u.email === cleanEmail)) {
    return { ok: false, error: 'Email gia registrata' };
  }
  if (users.some((u) => u.id !== id && u.nametag.toLowerCase() === cleanTag.toLowerCase())) {
    return { ok: false, error: 'Nametag gia in uso' };
  }

  users[idx] = {
    ...users[idx],
    nametag: cleanTag,
    email: cleanEmail,
    password: cleanPass || users[idx].password,
  };
  saveUsers(users);
  setSession(users[idx]);

  return { ok: true, user: withoutPassword(users[idx]) };
}

function setSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(withoutPassword(user)));
}

function withoutPassword(user) {
  const safe = { ...user };
  delete safe.password;
  return safe;
}

function cleanOAuthUrl() {
  if (!window.location.search && !window.location.hash) return;
  window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`);
}

function formatOAuthError(error) {
  let decoded = error;
  for (let i = 0; i < 2; i += 1) {
    try {
      decoded = decodeURIComponent(decoded.replace(/\+/g, ' '));
    } catch {
      break;
    }
  }

  if (decoded.toLowerCase().includes('unable to exchange external code')) {
    return 'Google ha rifiutato lo scambio OAuth. Controlla in Supabase > Authentication > Providers > Google che Client ID e Client Secret siano quelli del client OAuth Google Cloud, poi salva e riprova da capo.';
  }

  return decoded;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export { STARTING_CHIPS };

async function registerSupabase({ email, password, nametag }) {
  const cleanEmail = normalizeEmail(email);
  const cleanTag = nametag.trim();
  const cleanPass = password;

  if (!cleanEmail || !cleanPass || !cleanTag) {
    return { ok: false, error: 'Compila tutti i campi' };
  }
  if (cleanPass.length < 6) {
    return { ok: false, error: 'Password minimo 6 caratteri' };
  }
  if (cleanTag.length < 3) {
    return { ok: false, error: 'Nametag minimo 3 caratteri' };
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: cleanPass,
    options: {
      data: { nametag: cleanTag },
    },
  });

  if (error) return { ok: false, error: error.message };
  if (!data.user) {
    return { ok: false, error: 'Registrazione incompleta. Controlla la mail.' };
  }
  if (!data.session) {
    return {
      ok: false,
      error: 'Registrazione creata. Controlla la mail e conferma account prima di accedere.',
    };
  }

  const profile = await upsertPlayerProfile(data.user.id, {
    nametag: cleanTag,
    email: cleanEmail,
    chips: STARTING_CHIPS,
  });
  if (!profile.ok) return profile;

  const safe = toSafeUser(data.user.id, profile.nametag, cleanEmail, profile.chips);
  setSession(safe);
  return { ok: true, user: safe };
}

async function loginSupabase({ email, password }) {
  const cleanEmail = normalizeEmail(email);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error || !data.user) {
    return { ok: false, error: error?.message ?? 'Email o password non corretti' };
  }

  return buildSafeUserFromSupabaseUser(data.user, cleanEmail);
}

async function loginGoogleSupabase(credential) {
  if (!credential) return { ok: false, error: 'Credenziale Google non valida' };

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: credential,
  });

  if (error || !data.user) {
    return { ok: false, error: error?.message ?? 'Login Google fallito' };
  }

  return buildSafeUserFromSupabaseUser(data.user);
}

async function getCurrentUserSupabase() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return null;

  const result = await buildSafeUserFromSupabaseUser(user);
  return result.ok ? result.user : null;
}

async function buildSafeUserFromSupabaseUser(user, fallbackEmail = '') {
  const profile = await ensureProfileFromUser(user);
  if (!profile.ok) return profile;

  const safe = toSafeUser(user.id, profile.nametag, user.email ?? fallbackEmail, profile.chips);
  setSession(safe);
  return { ok: true, user: safe };
}

async function saveUserChipsSupabase(userId, chips) {
  const { error } = await supabase
    .from(PLAYERS_TABLE)
    .upsert({ id: userId, chips }, { onConflict: 'id' });
  if (error) return;

  const session = await getCurrentUser();
  if (session?.id === userId) {
    setSession({ ...session, chips });
  }
}

async function updateAccountSupabase({ nametag, email, password }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return { ok: false, error: 'Sessione scaduta. Accedi di nuovo.' };

  const cleanTag = nametag.trim();
  const cleanEmail = normalizeEmail(email);
  const cleanPass = password?.trim();

  if (!cleanTag || cleanTag.length < 3) {
    return { ok: false, error: 'Nametag minimo 3 caratteri' };
  }
  if (!cleanEmail) {
    return { ok: false, error: 'Email non valida' };
  }
  if (cleanPass && cleanPass.length < 6) {
    return { ok: false, error: 'Password minimo 6 caratteri' };
  }

  const authUpdates = {};
  if (cleanEmail !== user.email) authUpdates.email = cleanEmail;
  if (cleanPass) authUpdates.password = cleanPass;
  authUpdates.data = { ...(user.user_metadata ?? {}), nametag: cleanTag };

  if (Object.keys(authUpdates).length > 0) {
    const { error } = await supabase.auth.updateUser(authUpdates);
    if (error) return { ok: false, error: error.message };
  }

  const profile = await upsertPlayerProfile(user.id, {
    nametag: cleanTag,
    email: cleanEmail,
    chips: undefined,
  });
  if (!profile.ok) return profile;

  const safe = toSafeUser(user.id, profile.nametag, cleanEmail, profile.chips);
  setSession(safe);
  return { ok: true, user: safe };
}

async function ensureProfileFromUser(user) {
  const { data, error } = await supabase
    .from(PLAYERS_TABLE)
    .select('id, nametag, chips, email')
    .eq('id', user.id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (data) {
    return { ok: true, nametag: data.nametag, chips: data.chips ?? STARTING_CHIPS };
  }

  const fallbackTag = sanitizeNametag(
    user.user_metadata?.nametag ||
      user.user_metadata?.name ||
      user.email?.split('@')?.[0] ||
      'Player',
  );

  return upsertPlayerProfile(user.id, {
    nametag: fallbackTag,
    email: user.email ?? '',
    chips: STARTING_CHIPS,
  });
}

async function upsertPlayerProfile(id, { nametag, email, chips }) {
  const safeTag = sanitizeNametag(nametag);
  const uniqueSafeTag = sanitizeNametag(`${safeTag}${id.replace(/-/g, '').slice(0, 4)}`);
  const payload = { id, nametag: safeTag, email };
  if (chips !== undefined) payload.chips = chips;
  const { data, error } = await supabase
    .from(PLAYERS_TABLE)
    .upsert(payload, { onConflict: 'id' })
    .select('nametag, chips')
    .single();

  if (error?.code === '23505') {
    const retryPayload = { id, nametag: uniqueSafeTag, email };
    if (chips !== undefined) retryPayload.chips = chips;
    const retry = await supabase
      .from(PLAYERS_TABLE)
      .upsert(retryPayload, { onConflict: 'id' })
      .select('nametag, chips')
      .single();

    if (retry.error) return { ok: false, error: retry.error.message };
    return {
      ok: true,
      nametag: retry.data.nametag,
      chips: retry.data.chips ?? STARTING_CHIPS,
    };
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true, nametag: data.nametag, chips: data.chips ?? STARTING_CHIPS };
}

function toSafeUser(id, nametag, email, chips) {
  return { id, nametag, email, chips };
}

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function nextId(users) {
  const max = users.reduce((m, u) => Math.max(m, Number(u.id) || 0), 0);
  return max + 1;
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const base64Url = parts[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  );
  return JSON.parse(json);
}

function sanitizeNametag(raw) {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
  return cleaned.length >= 3 ? cleaned : 'Player';
}

function getUniqueNametag(users, base) {
  const lower = (s) => s.toLowerCase();
  if (!users.some((u) => lower(u.nametag) === lower(base))) return base;
  let i = 2;
  while (users.some((u) => lower(u.nametag) === lower(`${base}${i}`))) {
    i += 1;
  }
  return `${base}${i}`;
}
