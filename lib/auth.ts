// ─────────────────────────────────────────────────────────────────────────────
//  lib/auth.ts  — localStorage-based auth (no backend required)
//  Keys: gwiq_users  (JSON array of AuthUser)
//        gwiq_session (JSON Session object)
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'industry' | 'farmer';

export interface AuthUser {
  id:           string;
  name:         string;
  email:        string;
  passwordHash: string;
  role:         UserRole;
}

export interface Session {
  userId: string;
  email:  string;
  name:   string;
  role:   UserRole;
}

// ── FNV-1a hash (client-safe, deterministic) ──────────────────────────────────
function hashPassword(password: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < password.length; i++) {
    h ^= password.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── Storage helpers ───────────────────────────────────────────────────────────
function loadUsers(): AuthUser[] {
  try {
    return JSON.parse(localStorage.getItem('gwiq_users') ?? '[]') as AuthUser[];
  } catch { return []; }
}

function saveUsers(users: AuthUser[]): void {
  localStorage.setItem('gwiq_users', JSON.stringify(users));
}

export function saveSession(session: Session): void {
  localStorage.setItem('gwiq_session', JSON.stringify(session));
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem('gwiq_session');
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch { return null; }
}

export function clearSession(): void {
  localStorage.removeItem('gwiq_session');
}

// ── Auth operations ───────────────────────────────────────────────────────────
interface AuthResult {
  ok:      boolean;
  session?: Session;
  error?:  string;
}

export function signUp(
  name: string,
  email: string,
  password: string,
  role: UserRole,
): AuthResult {
  if (!name.trim())             return { ok: false, error: 'Name is required.' };
  if (!email.includes('@'))     return { ok: false, error: 'Enter a valid email address.' };
  if (password.length < 6)     return { ok: false, error: 'Password must be at least 6 characters.' };

  const users = loadUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: 'An account with this email already exists.' };
  }

  const newUser: AuthUser = {
    id:           `usr_${Date.now().toString(36)}`,
    name:         name.trim(),
    email:        email.toLowerCase().trim(),
    passwordHash: hashPassword(password),
    role,
  };
  saveUsers([...users, newUser]);

  const session: Session = {
    userId: newUser.id,
    email:  newUser.email,
    name:   newUser.name,
    role:   newUser.role,
  };
  saveSession(session);
  return { ok: true, session };
}

export function logIn(
  email: string,
  password: string,
): AuthResult {
  if (!email.includes('@'))  return { ok: false, error: 'Enter a valid email address.' };
  if (!password)             return { ok: false, error: 'Password is required.' };

  const users = loadUsers();
  const user  = users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!user)                          return { ok: false, error: 'No account found for this email.' };
  if (user.passwordHash !== hashPassword(password)) {
    return { ok: false, error: 'Incorrect password.' };
  }

  const session: Session = {
    userId: user.id,
    email:  user.email,
    name:   user.name,
    role:   user.role,
  };
  saveSession(session);
  return { ok: true, session };
}
