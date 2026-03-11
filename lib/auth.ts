// ─────────────────────────────────────────────────────────────────────────────
//  lib/auth.ts  — localStorage-based auth (no backend required)
//  Keys: gwiq_users    (JSON array of AuthUser)
//        gwiq_session  (JSON Session object)
//        gwiq_seeded   (flag — accounts seeded once)
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'industry' | 'farmer';

export interface AuthUser {
  id:           string;
  name:         string;
  email:        string;
  passwordHash: string;
  role:         UserRole;
  companyName?: string;   // industry — exact match to IndustrySensor.industryName
  farmerName?:  string;   // farmer   — exact match to VRSensor.farmerName
}

export interface Session {
  userId:       string;
  email:        string;
  name:         string;
  role:         UserRole;
  companyName?: string;
  farmerName?:  string;
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

// ── Seed all default company/farmer/admin accounts (runs once) ────────────────
export function seedDefaultAccounts(): void {
  if (localStorage.getItem('gwiq_seeded') === '1') return;

  const DEFAULT_PASSWORD = 'gwiq@2026';
  const ADMIN_PASSWORD   = 'admin1234';

  const companies = [
    'Tiruppur Spinning Mills Ltd.',
    'KPR Knit Wear Processing Unit',
    'Texvalley Bleaching & Dyeing',
    'Prem Knits Export House',
    'Ace Garments Processing',
    'Frontier Hosiery Mills',
    'Coimbatore Precision Engineering Co.',
    'Roots Industries Pump Works',
    'Kgisl Electronics Assembly',
    'Lakshmi Machine Works Ltd.',
    'Pricol Auto Parts Plant',
    'Sakthi Beverages & Cold Chain',
    'Chennai Chemical & Pharma Ltd.',
    'Ashok Leyland Assembly Plant',
    'India Pistons Engineering',
    'Hyundai Paint & Coating Unit',
    'Rane Group Auto Components',
    'Saint-Gobain Glass Processing',
    'Foxconn Electronics MFG',
    'Madurai Garment Exports Pvt.',
    'Pandian Cement Works',
    'TN Cement & Minerals Corp.',
    'Madurai Ceramic Tile Works',
    'Southern Polymers Plant',
  ];

  const farmers = [
    'Muthu Kumar',
    'Selvi Rajan',
    'Anbarasan Pillai',
    'Kavitha Subramaniam',
    'Sundaram Naidu',
  ];

  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);

  const seeded: AuthUser[] = [
    // Admin
    {
      id:           'usr_admin',
      name:         'Admin',
      email:        'admin@gwiq.local',
      passwordHash: hashPassword(ADMIN_PASSWORD),
      role:         'admin',
    },
    // Industry accounts
    ...companies.map((company) => ({
      id:           `usr_ind_${slug(company)}`,
      name:         company,
      email:        `${slug(company)}@gwiq.local`,
      passwordHash: hashPassword(DEFAULT_PASSWORD),
      role:         'industry' as UserRole,
      companyName:  company,
    })),
    // Farmer accounts
    ...farmers.map((farmer) => ({
      id:           `usr_far_${slug(farmer)}`,
      name:         farmer,
      email:        `${slug(farmer)}@gwiq.local`,
      passwordHash: hashPassword(DEFAULT_PASSWORD),
      role:         'farmer' as UserRole,
      farmerName:   farmer,
    })),
  ];

  // Merge with any existing manually-created accounts
  const existing = loadUsers();
  const existingIds = new Set(existing.map((u) => u.id));
  const toAdd = seeded.filter((u) => !existingIds.has(u.id));
  saveUsers([...existing, ...toAdd]);
  localStorage.setItem('gwiq_seeded', '1');
}

// ── Auth operations ───────────────────────────────────────────────────────────
interface AuthResult {
  ok:       boolean;
  session?: Session;
  error?:   string;
}

export function signUp(
  name:     string,
  email:    string,
  password: string,
  role:     UserRole,
): AuthResult {
  if (!name.trim())         return { ok: false, error: 'Name is required.' };
  if (!email.includes('@')) return { ok: false, error: 'Enter a valid email address.' };
  if (password.length < 6)  return { ok: false, error: 'Password must be at least 6 characters.' };

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
    companyName:  role === 'industry' ? name.trim() : undefined,
    farmerName:   role === 'farmer'   ? name.trim() : undefined,
  };
  saveUsers([...users, newUser]);

  const session: Session = {
    userId:      newUser.id,
    email:       newUser.email,
    name:        newUser.name,
    role:        newUser.role,
    companyName: newUser.companyName,
    farmerName:  newUser.farmerName,
  };
  saveSession(session);
  return { ok: true, session };
}

/**
 * Log in by matching identifier against email OR name (case-insensitive).
 * Industry users log in with their company name; farmers with their name;
 * admin with "admin" or "admin@gwiq.local".
 */
export function logIn(identifier: string, password: string): AuthResult {
  if (!identifier.trim()) return { ok: false, error: 'Username / company name is required.' };
  if (!password)          return { ok: false, error: 'Password is required.' };

  const users = loadUsers();
  const norm  = identifier.toLowerCase().trim();
  const user  = users.find(
    (u) => u.email.toLowerCase() === norm || u.name.toLowerCase() === norm,
  );
  if (!user) {
    return { ok: false, error: 'No account found. Check your company name or username.' };
  }
  if (user.passwordHash !== hashPassword(password)) {
    return { ok: false, error: 'Incorrect password.' };
  }

  const session: Session = {
    userId:      user.id,
    email:       user.email,
    name:        user.name,
    role:        user.role,
    companyName: user.companyName,
    farmerName:  user.farmerName,
  };
  saveSession(session);
  return { ok: true, session };
}
