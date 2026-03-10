'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets, Factory, Wheat, Mail, Lock, Eye, EyeOff,
  User, AlertCircle, Loader2, CheckCircle, LogIn,
} from 'lucide-react';
import { signUp, logIn, Session, UserRole } from '@/lib/auth';

// ─────────────────────────────────────────────────────────────────────────────
//  Password strength
// ─────────────────────────────────────────────────────────────────────────────
function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) || /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0-4
}
const STRENGTH_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e'];
const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Strong'];

// ─────────────────────────────────────────────────────────────────────────────
//  Input field
// ─────────────────────────────────────────────────────────────────────────────
function AuthInput({
  icon, type, placeholder, value, onChange, roleColor,
  right,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  roleColor: string;
  right?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className="relative flex items-center rounded-xl overflow-hidden mb-3 transition-all"
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: `1px solid ${focused ? roleColor : 'rgba(255,255,255,0.20)'}`,
        boxShadow: focused ? `0 0 0 3px ${roleColor}22` : 'none',
      }}
    >
      <span className="absolute left-3.5 flex-shrink-0" style={{ color: focused ? roleColor : 'rgba(255,255,255,0.45)' }}>
        {icon}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full h-12 bg-transparent pl-10 pr-4 text-sm text-white placeholder-white/40 outline-none"
        autoComplete="off"
        style={{ color: 'white' }}
      />
      {right && <span className="absolute right-3">{right}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Animated SVG wave at bottom
// ─────────────────────────────────────────────────────────────────────────────
function WaveBand() {
  return (
    <div className="absolute bottom-0 left-0 w-full overflow-hidden pointer-events-none select-none"
      style={{ height: 90, opacity: 0.18 }}>
      <svg viewBox="0 0 1440 90" preserveAspectRatio="none"
        style={{ width: '200%', height: '100%', animation: 'waveScroll 12s linear infinite' }}>
        <path
          d="M0,45 C180,90 360,0 540,45 C720,90 900,0 1080,45 C1260,90 1440,0 1440,45 L1440,90 L0,90 Z"
          fill="white"
        />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Floating blobs
// ─────────────────────────────────────────────────────────────────────────────
const BLOBS = [
  { w: 420, h: 420, x: -80,  y: -80,  blur: 110, delay: 0,    dur: 18 },
  { w: 340, h: 340, x: '70%',y: '60%',blur: 90,  delay: 4,    dur: 22 },
  { w: 280, h: 280, x: '50%',y: -60,  blur: 80,  delay: 8,    dur: 16 },
  { w: 260, h: 260, x: -40,  y: '65%',blur: 70,  delay: 2,    dur: 20 },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────────────────────
interface AuthPageProps {
  onAuth: (session: Session) => void;
}

export default function AuthPage({ onAuth }: AuthPageProps) {
  // Mode & role
  const [mode, setMode]     = useState<'login' | 'signup'>('login');
  const [role, setRole]     = useState<UserRole>('industry');

  // Form fields
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);

  // UI state
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [shaking, setShaking]   = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [tilt, setTilt]         = useState({ rx: 0, ry: 0 });

  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef  = useRef<number | null>(null);

  // ── 3-D mouse tilt ──────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (flipping || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    const dx   = (e.clientX - cx) / (rect.width  / 2);
    const dy   = (e.clientY - cy) / (rect.height / 2);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTilt({ rx: -dy * 12, ry: dx * 12 });
    });
  }, [flipping]);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTilt({ rx: 0, ry: 0 });
  }, []);

  // ── Mode flip (3-D rotate) ────────────────────────────────────────────────
  function flipMode() {
    if (flipping) return;
    setFlipping(true);
    setError('');
    // Rotate to edge
    setTilt({ rx: 0, ry: 90 });
    setTimeout(() => {
      setMode((m) => m === 'login' ? 'signup' : 'login');
      setName(''); setEmail(''); setPassword(''); setConfirm('');
      setTilt({ rx: 0, ry: -90 });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTilt({ rx: 0, ry: 0 });
          setTimeout(() => setFlipping(false), 300);
        });
      });
    }, 280);
  }

  // ── Shake on error ────────────────────────────────────────────────────────
  function shake() {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.');
      shake(); return;
    }
    setLoading(true);
    // Simulate brief network delay (localStorage is instant — add realism)
    await new Promise((r) => setTimeout(r, 600));
    const result = mode === 'login'
      ? logIn(email, password)
      : signUp(name, email, password, role);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Authentication failed.');
      shake(); return;
    }
    setSuccess(true);
    setTimeout(() => onAuth(result.session!), 900);
  }

  const roleColor  = role === 'industry' ? '#0284c7' : '#059669';
  const str        = passwordStrength(password);
  const cardTransform = `perspective(1200px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`;

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden select-none"
      style={{ background: 'linear-gradient(150deg, #0c4a6e 0%, #0369a1 35%, #0ea5e9 70%, #38bdf8 100%)' }}>

      {/* ── Blobs ──────────────────────────────────────────────────────────── */}
      {BLOBS.map((b, i) => (
        <div key={i} className="absolute pointer-events-none rounded-full"
          style={{
            width: b.w, height: b.h,
            left: b.x, top: b.y,
            background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)',
            filter: `blur(${b.blur}px)`,
            animation: `authFloat ${b.dur}s ease-in-out infinite ${b.delay}s alternate`,
          }} />
      ))}

      {/* ── Wave ───────────────────────────────────────────────────────────── */}
      <WaveBand />

      {/* ── Logo ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2.5 z-10">
        <div className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)' }}>
          <Droplets size={22} color="white" />
        </div>
        <span className="text-2xl font-extrabold tracking-tight text-white">GWiQ</span>
      </div>

      {/* ── Card wrapper (perspective) ──────────────────────────────────────── */}
      <div style={{ perspective: 1200 }}>
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={shaking ? 'auth-shake' : ''}
          style={{
            width: 'min(420px, 92vw)',
            background: 'rgba(255,255,255,0.10)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.20)',
            borderRadius: 24,
            boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
            overflow: 'hidden',
            transform: cardTransform,
            transition: flipping
              ? 'transform 0.28s cubic-bezier(0.4,0,0.2,1)'
              : 'transform 0.15s ease-out',
            willChange: 'transform',
          }}
        >
          <form onSubmit={handleSubmit} noValidate>
            <div className="px-8 pt-8 pb-7">
              {/* ── Role selector ─────────────────────────────────────────── */}
              <div className="flex gap-3 mb-6">
                {(['industry', 'farmer'] as UserRole[]).map((r) => {
                  const c = r === 'industry' ? '#0284c7' : '#059669';
                  const sel = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={sel ? {
                        background: c,
                        color: 'white',
                        boxShadow: `0 0 24px ${c}60`,
                        border: `1px solid ${c}`,
                        animation: 'pulse3d 2s ease-in-out infinite',
                      } : {
                        background: 'transparent',
                        color: 'rgba(255,255,255,0.75)',
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}
                    >
                      {r === 'industry' ? <Factory size={15} /> : <Wheat size={15} />}
                      {r === 'industry' ? 'Industry' : 'Farmer'}
                    </button>
                  );
                })}
              </div>

              {/* ── Heading ───────────────────────────────────────────────── */}
              <h2 className="text-white font-bold text-xl mb-0.5">
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </h2>
              <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {mode === 'login'
                  ? `Access the ${role === 'industry' ? 'Industry' : 'Farmer'} dashboard`
                  : `Join the GWiQ ${role === 'industry' ? 'Industry' : 'Farmer'} network`}
              </p>

              {/* ── Fields ────────────────────────────────────────────────── */}
              {mode === 'signup' && (
                <AuthInput icon={<User size={15} />} type="text" placeholder="Full name"
                  value={name} onChange={setName} roleColor={roleColor} />
              )}
              <AuthInput icon={<Mail size={15} />} type="email" placeholder="Email address"
                value={email} onChange={setEmail} roleColor={roleColor} />
              <AuthInput
                icon={<Lock size={15} />}
                type={showPw ? 'text' : 'password'}
                placeholder="Password"
                value={password} onChange={setPassword}
                roleColor={roleColor}
                right={
                  <button type="button" onClick={() => setShowPw((p) => !p)}
                    style={{ color: 'rgba(255,255,255,0.45)', padding: 4 }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />

              {/* Password strength bar */}
              {mode === 'signup' && password.length > 0 && (
                <div className="mb-3">
                  <div className="flex gap-1 mb-1">
                    {[0,1,2,3].map((i) => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all"
                        style={{ background: i < str ? STRENGTH_COLORS[str - 1] : 'rgba(255,255,255,0.12)' }} />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: str > 0 ? STRENGTH_COLORS[str - 1] : 'rgba(255,255,255,0.4)' }}>
                    {str > 0 ? STRENGTH_LABELS[str - 1] : ''}
                  </p>
                </div>
              )}

              {mode === 'signup' && (
                <AuthInput
                  icon={<Lock size={15} />}
                  type={showCf ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirm} onChange={setConfirm}
                  roleColor={roleColor}
                  right={
                    <button type="button" onClick={() => setShowCf((p) => !p)}
                      style={{ color: 'rgba(255,255,255,0.45)', padding: 4 }}>
                      {showCf ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  }
                />
              )}

              {mode === 'login' && (
                <div className="flex justify-end mb-4">
                  <button type="button" className="text-xs transition-opacity hover:opacity-80"
                    style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Forgot password?
                  </button>
                </div>
              )}

              {/* ── Error alert ───────────────────────────────────────────── */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key={error}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4 text-sm"
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.4)',
                      color: '#fca5a5',
                    }}
                  >
                    <AlertCircle size={14} className="flex-shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Submit button ─────────────────────────────────────────── */}
              <button
                type="submit"
                disabled={loading || success}
                className="w-full flex items-center justify-center gap-2.5 font-semibold text-white rounded-2xl transition-all overflow-hidden relative auth-shimmer"
                style={{
                  height: 52,
                  background: success ? '#16a34a' : roleColor,
                  boxShadow: `0 8px 28px ${roleColor}55`,
                  fontSize: 15,
                  opacity: loading ? 0.85 : 1,
                }}
              >
                {success ? (
                  <>
                    <CheckCircle size={18} />
                    Welcome!
                  </>
                ) : loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    {mode === 'login' ? 'Sign in' : 'Create account'}
                  </>
                )}
              </button>

              {/* ── Mode switcher ─────────────────────────────────────────── */}
              <p className="text-center mt-5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={flipMode}
                  className="font-semibold transition-opacity hover:opacity-80"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                >
                  {mode === 'login' ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
