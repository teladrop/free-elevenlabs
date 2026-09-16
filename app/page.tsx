'use client';

import { useEffect, useState } from 'react';
import { signInWithGoogle, getAuthClientInstance } from '@/lib/db/auth-client';
import { Loader2, Zap, PlayCircle, FileText, Layers, Mic2, BarChart2, Lightbulb } from 'lucide-react';

const FEATURES = [
  { icon: <PlayCircle  className="w-5 h-5" />, title: 'YouTube Research',    desc: 'AI niche intelligence — find gaps before competitors do',      color: 'from-red-500/20 to-red-600/10',    border: 'border-red-500/20',    text: 'text-red-400'    },
  { icon: <FileText  className="w-5 h-5" />, title: 'Script Generator',    desc: 'Retention-first scripts with AI analysis and auto-rewrite',   color: 'from-blue-500/20 to-blue-600/10',  border: 'border-blue-500/20',  text: 'text-blue-400'  },
  { icon: <Layers    className="w-5 h-5" />, title: 'Visual Prompts',      desc: 'AI prompts for every narration line — ready for image gen',    color: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/20', text: 'text-purple-400' },
  { icon: <Mic2      className="w-5 h-5" />, title: 'Voice Studio',        desc: '23 neural voices via Edge TTS — always free, no key needed',  color: 'from-green-500/20 to-green-600/10', border: 'border-green-500/20', text: 'text-green-400' },
  { icon: <BarChart2 className="w-5 h-5" />, title: 'Channel Analytics',   desc: 'Connect YouTube, track competitors, get AI growth tips',       color: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/20', text: 'text-amber-400' },
  { icon: <Lightbulb className="w-5 h-5" />, title: 'Content Ideas',       desc: 'AI-generated ideas grounded in real YouTube search data',      color: 'from-cyan-500/20 to-cyan-600/10',  border: 'border-cyan-500/20',  text: 'text-cyan-400'  },
];

export default function LandingPage() {
  const [loading,  setLoading]  = useState(true);
  const [signing,  setSigning]  = useState(false);
  const [error,    setError]    = useState('');

  // If already signed in → go straight to intended destination or dashboard
  useEffect(() => {
    const client = getAuthClientInstance();
    if (!client) { setLoading(false); return; }

    // Add a hard timeout — never spin forever
    const timeout = setTimeout(() => setLoading(false), 3000);

    client.auth.getSession().then(({ data }) => {
      clearTimeout(timeout);
      if (data.session) {
        const params = new URLSearchParams(window.location.search);
        const dest = params.get('redirect') ?? '/dashboard';
        // Use window.location for a hard redirect — more reliable on Vercel
        // than router.replace which can get stuck in client-side navigation
        window.location.replace(dest);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });
  }, []);

  const handleSignIn = async () => {
    setSigning(true);
    setError('');
    // Pass redirect param through to auth/complete
    const params = new URLSearchParams(window.location.search);
    const redirectPath = params.get('redirect') ?? '/dashboard';
    const callbackUrl = `${window.location.origin}/auth/complete?redirect=${encodeURIComponent(redirectPath)}`;
    const { error: err } = await signInWithGoogle(callbackUrl);
    if (err) { setError(err); setSigning(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))/95] backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm text-[hsl(var(--foreground))]">ContentStudio</span>
          </div>
          <button
            onClick={handleSignIn}
            disabled={signing}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-white text-gray-800 text-sm font-semibold hover:bg-gray-50 transition-all shadow-sm disabled:opacity-60"
          >
            {signing
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <GoogleIcon />
            }
            Sign in
          </button>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">

        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[hsl(var(--primary))/6] blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[hsl(var(--primary))/30] bg-[hsl(var(--primary))/8] text-[hsl(var(--primary))] text-xs font-semibold mb-6">
            <Zap className="w-3 h-3" /> 100% Free AI · No credit card required
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[hsl(var(--foreground))] leading-tight mb-5">
            The AI toolkit for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--primary))] to-purple-400">
              YouTube creators
            </span>
          </h1>

          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-xl mx-auto mb-10 leading-relaxed">
            Research niches, write scripts, generate visuals, clone voices and analyse your channel — all in one place, all free.
          </p>

          {/* CTA */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleSignIn}
              disabled={signing}
              className="flex items-center gap-3 h-14 px-8 rounded-2xl bg-white text-gray-800 font-bold text-base hover:bg-gray-50 transition-all shadow-2xl hover:shadow-3xl disabled:opacity-60 group"
            >
              {signing
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <GoogleIcon size={20} />
              }
              {signing ? 'Redirecting to Google…' : 'Continue with Google — it\'s free'}
            </button>

            {error && (
              <p className="text-sm text-red-400 mt-1">{error}</p>
            )}

            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Sign in once · Your data stays private · Disconnect anytime
            </p>
          </div>
        </div>

        {/* ── Feature grid ─────────────────────────────────────────────── */}
        <div className="relative mt-20 max-w-5xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className={`rounded-2xl border ${f.border} bg-gradient-to-br ${f.color} p-5 text-left`}
            >
              <div className={`w-10 h-10 rounded-xl bg-white/5 border ${f.border} flex items-center justify-center mb-3 ${f.text}`}>
                {f.icon}
              </div>
              <p className="text-sm font-bold text-[hsl(var(--foreground))] mb-1">{f.title}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-[hsl(var(--border))] py-6 text-center">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          ContentStudio · Built with Groq, Gemini & Edge TTS · Completely free
        </p>
      </footer>
    </div>
  );
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
