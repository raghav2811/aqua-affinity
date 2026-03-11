'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import type { Session } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatLanguage = 'en' | 'ta' | 'hi';

interface AIChatBotProps {
  session: Session;
}

// ── Language config ────────────────────────────────────────────────────────────

const LANG_OPTIONS: { id: ChatLanguage; label: string; flag: string }[] = [
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'ta', label: 'தமிழ்',   flag: '🇮🇳' },
  { id: 'hi', label: 'हिंदी',   flag: '🇮🇳' },
];

const LANG_GREETING: Record<ChatLanguage, (name: string) => string> = {
  en: (name) => `Hi ${name}! 👋 I'm AquaBot. Ask me anything about your sensor readings, irrigation schedule, sprinkler status, or water levels.`,
  ta: (name) => `வணக்கம் ${name}! 👋 நான் AquaBot. உங்கள் சென்சார் தரவு, நீர்ப்பாசன அட்டவணை, தெளிப்பான் நிலை அல்லது நீர் மட்டம் பற்றி என்னிடம் கேளுங்கள்.`,
  hi: (name) => `नमस्ते ${name}! 👋 मैं AquaBot हूँ। अपने सेंसर डेटा, सिंचाई समय, स्प्रिंकलर स्थिति या जल स्तर के बारे में मुझसे पूछें।`,
};

const LANG_PLACEHOLDER: Record<ChatLanguage, string> = {
  en: 'Ask about water levels, irrigation…',
  ta: 'நீர் மட்டம், நீர்ப்பாசனம் பற்றி கேளுங்கள்…',
  hi: 'जल स्तर, सिंचाई के बारे में पूछें…',
};

const LANG_SENDING: Record<ChatLanguage, string> = {
  en: 'Network error — please try again.',
  ta: 'இணைய பிழை — மீண்டும் முயற்சிக்கவும்.',
  hi: 'नेटवर्क त्रुटि — कृपया पुनः प्रयास करें।',
};

// ── Role colour palette ────────────────────────────────────────────────────────

function roleAccent(role: string) {
  if (role === 'farmer')   return { bg: '#059669', light: 'rgba(5,150,105,0.12)', border: '#bbf7d0' };
  if (role === 'industry') return { bg: '#0284c7', light: 'rgba(2,132,199,0.10)', border: '#bae6fd' };
  return                          { bg: '#7c3aed', light: 'rgba(124,58,237,0.10)', border: '#ddd6fe' };
}

// ── Markdown-lite renderer ────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    return (
      <span key={i}>
        {part.split('\n').map((line, j, arr) => (
          <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
        ))}
      </span>
    );
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AIChatBot({ session }: AIChatBotProps) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [lang, setLang]         = useState<ChatLanguage>('en');
  const [showLangMenu, setShowLangMenu] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const accent    = roleAccent(session.role);

  const isFarmer = session.role === 'farmer';

  // ── Re-set greeting when language changes ────────────────────────────────
  const resetWithGreeting = useCallback((l: ChatLanguage) => {
    const name = session.name ?? 'Farmer';
    if (isFarmer) {
      setMessages([{ role: 'assistant', content: LANG_GREETING[l](name) }]);
    } else {
      // Non-farmers always English
      setMessages([{ role: 'assistant', content: `Hello! I'm AquaBot${session.companyName ? ` for ${session.companyName}` : ''}. Ask me about extraction compliance, NOC status, fines, or groundwater data.` }]);
    }
  }, [session, isFarmer]);

  // ── Pre-populate greeting on first open ──────────────────────────────────
  useEffect(() => {
    if (open && messages.length === 0) {
      resetWithGreeting(lang);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Change language ───────────────────────────────────────────────────────
  function changeLang(l: ChatLanguage) {
    setLang(l);
    setShowLangMenu(false);
    setError(null);
    resetWithGreeting(l); // clear history & show new greeting
  }

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError(null);

    const historyToSend = next.slice(-10).map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:    historyToSend,
          role:        session.role,
          farmerName:  session.farmerName,
          companyName: session.companyName,
          language:    lang,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]); }
    } catch {
      setError(LANG_SENDING[lang]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, loading, messages, session, lang]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const currentLang = LANG_OPTIONS.find(l => l.id === lang)!;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Floating button ─────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-5 right-5 z-[3000] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95"
        style={{
          background:  accent.bg,
          color:       '#ffffff',
          boxShadow:   `0 8px 32px ${accent.bg}55`,
          border:      '1.5px solid rgba(255,255,255,0.25)',
        }}
        title="Open AquaBot"
      >
        <Bot size={18} />
        <span className="text-sm font-semibold tracking-wide">AquaBot</span>
        {open && <ChevronDown size={14} className="opacity-75" />}
      </button>

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed bottom-20 right-5 z-[3000] flex flex-col rounded-2xl overflow-hidden"
            style={{
              width: 'min(400px, calc(100vw - 24px))',
              height: 'min(560px, calc(100vh - 120px))',
              background: '#ffffff',
              border:     `1px solid ${accent.border}`,
              boxShadow:  '0 20px 60px rgba(0,0,0,0.15)',
            }}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            {/* ── Header ──────────────────────────────────────────────── */}
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ background: accent.bg, borderBottom: 'none' }}
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <Sparkles size={14} style={{ color: '#ffffff' }} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none" style={{ color: '#ffffff' }}>AquaBot</p>
                  <p className="text-xs mt-0.5 leading-none" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {session.role === 'farmer'   ? `🌾 ${session.name}`   :
                     session.role === 'industry' ? `🏭 ${session.companyName ?? session.name}` :
                     '🔐 Admin Dashboard'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Language picker — only for farmers */}
                {isFarmer && (
                  <div className="relative">
                    <button
                      onClick={() => setShowLangMenu(v => !v)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.18)',
                        color: '#ffffff',
                        border: '1px solid rgba(255,255,255,0.25)',
                        backdropFilter: 'blur(4px)',
                      }}
                      title="Change language"
                    >
                      <span style={{ fontSize: 14 }}>{currentLang.flag}</span>
                      <span>{currentLang.label}</span>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 3.5L5 6.5L8 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>

                    <AnimatePresence>
                      {showLangMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0,  scale: 1    }}
                          exit={{    opacity: 0, y: -6, scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-9 rounded-xl overflow-hidden shadow-2xl"
                          style={{
                            background: '#ffffff',
                            border: `1px solid ${accent.border}`,
                            minWidth: 130,
                            zIndex: 10,
                          }}
                        >
                          {LANG_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => changeLang(opt.id)}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors text-left"
                              style={{
                                background: lang === opt.id ? `${accent.light}` : 'transparent',
                                color: lang === opt.id ? accent.bg : '#374151',
                                borderBottom: '1px solid #f0f9ff',
                              }}
                            >
                              <span style={{ fontSize: 15 }}>{opt.flag}</span>
                              <div>
                                <div style={{ fontWeight: lang === opt.id ? 700 : 500 }}>{opt.label}</div>
                                {opt.id === 'ta' && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>Tamil</div>}
                                {opt.id === 'hi' && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>Hindi</div>}
                              </div>
                              {lang === opt.id && (
                                <svg className="ml-auto" width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6L5 9L10 3" stroke={accent.bg} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.12)' }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* ── Language banner (shown when non-English) ─────────────── */}
            {isFarmer && lang !== 'en' && (
              <div
                className="flex items-center gap-2 px-4 py-1.5 flex-shrink-0 text-xs"
                style={{
                  background: accent.light,
                  borderBottom: `1px solid ${accent.border}`,
                  color: accent.bg,
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: 13 }}>{currentLang.flag}</span>
                {lang === 'ta' && <span>தமிழில் பேசுகிறோம் — Responding in Tamil</span>}
                {lang === 'hi' && <span>हिंदी में बात करें — Responding in Hindi</span>}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-1.5 mt-0.5"
                      style={{ background: accent.light, border: `1px solid ${accent.border}` }}
                    >
                      <Bot size={12} style={{ color: accent.bg }} />
                    </div>
                  )}
                  <div
                    className="max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed"
                    style={
                      msg.role === 'user'
                        ? { background: accent.bg, color: '#ffffff', borderBottomRightRadius: 4 }
                        : { background: '#f8fafc', color: '#1e293b', border: `1px solid ${accent.border}`, borderBottomLeftRadius: 4 }
                    }
                  >
                    {renderMarkdown(msg.content)}
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <motion.div
                  className="flex justify-start items-center gap-1.5"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: accent.light, border: `1px solid ${accent.border}` }}
                  >
                    <Bot size={12} style={{ color: accent.bg }} />
                  </div>
                  <div
                    className="px-3 py-2 rounded-2xl flex items-center gap-1"
                    style={{ background: '#f8fafc', border: `1px solid ${accent.border}` }}
                  >
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: accent.bg }}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {error && (
                <div className="mx-1 px-3 py-2 rounded-xl text-xs" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                  {error}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* ── Input bar ────────────────────────────────────────────── */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
              style={{ borderTop: `1px solid ${accent.border}`, background: '#fafafa' }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isFarmer
                    ? LANG_PLACEHOLDER[lang]
                    : session.role === 'industry'
                    ? 'Ask about extraction, NOC compliance…'
                    : 'Ask about platform stats, compliance…'
                }
                className="flex-1 text-xs px-3 py-2 rounded-xl outline-none"
                style={{
                  background: '#ffffff',
                  border: `1px solid ${accent.border}`,
                  color: '#1e293b',
                  fontFamily: lang === 'ta' ? '"Latha", "Noto Sans Tamil", sans-serif' : lang === 'hi' ? '"Mangal", "Noto Sans Devanagari", sans-serif' : 'inherit',
                }}
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0 transition-all"
                style={{
                  background: input.trim() && !loading ? accent.bg : '#e2e8f0',
                  color:      input.trim() && !loading ? '#ffffff'  : '#94a3b8',
                }}
              >
                {loading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Send size={13} />
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
