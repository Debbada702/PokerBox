/**
 * Contratto API SQL Server (futuro).
 *
 * CREATE TABLE Players (
 *   Id           INT IDENTITY PRIMARY KEY,
 *   Nametag      NVARCHAR(32) NOT NULL UNIQUE,
 *   Email        NVARCHAR(255) NOT NULL UNIQUE,
 *   PasswordHash NVARCHAR(255) NOT NULL,
 *   Chips        INT NOT NULL DEFAULT 10000,
 *   CreatedAt    DATETIME2 DEFAULT GETUTCDATE()
 * );
 *
 * CREATE TABLE PlayerWallets (
 *   PlayerId     INT PRIMARY KEY REFERENCES Players(Id),
 *   WalletAddress NVARCHAR(64),
 *   BottiBalance DECIMAL(18,8) DEFAULT 0
 * );
 *
 * CREATE TABLE Rooms (
 *   Id           INT IDENTITY PRIMARY KEY,
 *   Code         NVARCHAR(8) NOT NULL UNIQUE,
 *   HostId       INT NOT NULL REFERENCES Players(Id),
 *   CreatedAt    DATETIME2 DEFAULT GETUTCDATE()
 * );
 */

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export async function apiRegister({ email, password, nametag }) {
  if (!API_BASE) return null;
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, nametag }),
  });
  return res.json();
}

export async function apiLogin({ email, password }) {
  if (!API_BASE) return null;
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function apiUpdateChips(playerId, chips) {
  if (!API_BASE) return null;
  const res = await fetch(`${API_BASE}/players/${playerId}/chips`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chips }),
  });
  return res.json();
}

export async function apiConvertBotti(playerId, amount) {
  if (!API_BASE) return null;
  const res = await fetch(`${API_BASE}/players/${playerId}/convert-botti`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
  return res.json();
}

export async function apiCreateRoom(hostId) {
  if (!API_BASE) return null;
  const res = await fetch(`${API_BASE}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostId }),
  });
  return res.json();
}

export async function apiJoinRoom(code, playerId) {
  if (!API_BASE) return null;
  const res = await fetch(`${API_BASE}/rooms/${code}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId }),
  });
  return res.json();
}
