'use client';

import { useEffect, useRef, useState } from 'react';
import { signInWithGoogle, getAuthClientInstance } from '@/lib/db/auth-client';
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, PlayCircle, Mic2, Lightbulb,
  BarChart2, Layers, FileText, Zap, Users, Menu, X,
  ChevronRight, Star, Globe, Shield, Clock, Sparkles,
} from 'lucide-react';

/* ─── Reusable animation wrappers ────────────────────────────────────────── */
function FadeUp({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}>
      {children}
    </motion.div>
  );
}

function StaggerGrid({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'show' : 'hidden'}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
      className={className}>
      {children}
    </motion.div>
  );
}

function StaggerItem({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={{
      hidden: { opacity: 0, y: 28 },
      show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
    }}>
      {children}
    </motion.div>
  );
}

function AnimatedCount({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let n = 0;
    const step = to / 55;
    const id = setInterval(() => {
      n += step;
      if (n >= to) { setVal(to); clearInterval(id); } else setVal(Math.floor(n));
    }, 28);
    return () => clearInterval(id);
  }, [inView, to]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/* ─── Static data ─────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: PlayCircle, title: 'YouTube Research',  tag: 'Research',  gradient: 'from-red-500 to-rose-600',     desc: 'AI niche intelligence — find content gaps before competitors. Live YouTube data, no guesswork.' },
  { icon: FileText,   title: 'Script Generator',  tag: 'Write',     gradient: 'from-blue-500 to-indigo-600',  desc: 'Retention-first scripts with AI analysis, hook scoring, and one-click auto-rewrite.' },
  { icon: Layers,     title: 'Visual Prompts',    tag: 'Design',    gradient: 'from-purple-500 to-violet-600', desc: 'AI image prompts for every narration line — ready for Midjourney, DALL-E, or Firefly.' },
  { icon: Mic2,       title: 'Voice Studio',      tag: 'Audio',     gradient: 'from-green-500 to-emerald-600', desc: '23 Microsoft neural voices — generate full voiceovers in seconds, always free, MP3 download.' },
  { icon: BarChart2,  title: 'Channel Analytics', tag: 'Analytics', gradient: 'from-amber-500 to-orange-600', desc: 'Connect YouTube, track competitors, benchmark performance, get AI growth tips.' },
  { icon: Lightbulb,  title: 'Content Ideas',     tag: 'Ideas',     gradient: 'from-cyan-500 to-sky-600',     desc: 'AI ideas grounded in real YouTube search trends — never run out of video topics.' },
];

const HOW = [
  { n: '01', title: 'Research your niche',        desc: 'Type any topic. ContentStudio pulls live YouTube data, ranks opportunities by demand vs competition, and shows you the exact gap to fill.' },
  { n: '02', title: 'Generate your script',       desc: 'AI writes a retention-optimised script with hook, body, and CTA. Rewrite any section in one click until it feels right.' },
  { n: '03', title: 'Produce visuals & voice',    desc: 'Get AI image prompts for every line and a full voiceover in seconds. Your complete video package is ready to edit.' },
];

const TESTIMONIALS = [
  { name: 'Marcus T.',  handle: '@marcuscreates', avatar: 'M', text: 'Went from 0 to 12K subs in 3 months. The research tool showed me a gap nobody else had spotted.', stars: 5 },
  { name: 'Priya K.',   handle: '@priyatech',     avatar: 'P', text: 'I used to spend 4 hours on a script. Now 20 minutes and retention is way better.', stars: 5 },
  { name: 'Jake R.',    handle: '@jakereviews',   avatar: 'J', text: 'The competitor analytics alone is worth it. I can see exactly why bigger channels beat me and fix it.', stars: 5 },
  { name: 'Sofia M.',   handle: '@sofiacooks',    avatar: 'S', text: "Free forever and this good? I kept waiting for the catch. There isn't one.", stars: 5 },
];

const TRUST = [
  { icon: Shield, label: 'No credit card',   sub: 'Free forever plan'    },
  { icon: Globe,  label: '100% Free AI',     sub: 'No quotas, no limits'  },
  { icon: Clock,  label: 'Ready in 60s',     sub: 'Sign in and go'        },
  { icon: Zap,    label: 'New every week',   sub: 'Features ship fast'    },
];

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [signing,    setSigning]    = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY       = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  useEffect(() => {
    const client = getAuthClientInstance();
    if (!client) return;
    client.auth.getSession().then(({ data }) => {
      if (data.session) {
        const p = new URLSearchParams(window.location.search);
        window.location.replace(p.get('redirect') ?? '/dashboard');
      }
    }).catch(() => {});
  }, []);

  const signIn = async () => {
    try {
      setSigning(true);
      const p = new URLSearchParams(window.location.search);
      const dest = p.get('redirect') ?? '/dashboard';
      if (typeof window !== 'undefined') sessionStorage.setItem('auth_redirect', dest);
      const cb = `${window.location.origin}/auth/complete?redirect=${encodeURIComponent(dest)}`;
      const { error } = await signInWithGoogle(cb);
      if (error) { console.error(error); setSigning(false); }
    } catch (e) { console.error(e); setSigning(false); }
  };

  const GoogleBtn = ({ size = 'lg', label = 'Start free with Google' }: { size?: 'sm' | 'lg'; label?: string }) => (
    <button onClick={signIn} disabled={signing}
      className={`group relative overflow-hidden flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold rounded-2xl transition-all hover:scale-105 hover:shadow-2xl hover:shadow-white/10 disabled:opacity-60 disabled:hover:scale-100 ${size === 'lg' ? 'px-8 py-4 text-lg' : 'px-5 py-2 text-sm'}`}>
      <span className="absolute inset-0 bg-gradient-to-r from-purple-50 to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <span className="relative flex items-center gap-3">
        {signing
          ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-gray-800" />
          : <svg className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
        }
        {signing ? 'Signing in…' : label}
        {!signing && <ArrowRight className={`${size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} group-hover:translate-x-1 transition-transform`} />}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#07070f] text-white overflow-x-hidden selection:bg-purple-500/30">

      {/* ════════════════════════ NAV ════════════════════════════════════ */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[#07070f]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <PlayCircle className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" />
            </div>
            <span className="text-[17px] font-bold tracking-tight">ContentStudio</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="hidden md:block">
            <GoogleBtn size="sm" label="Get started free" />
          </motion.div>

          <button onClick={() => setMobileOpen(v => !v)}
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="md:hidden overflow-hidden border-t border-white/[0.06] bg-[#07070f]/95 px-4 pb-4 pt-3">
              <GoogleBtn size="sm" label="Get started free" />
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ════════════════════════ HERO ═══════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Parallax orbs */}
        <motion.div style={{ y: heroY }} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[20%] left-[15%] w-[700px] h-[700px] bg-purple-600/[0.18] rounded-full blur-[140px]" />
          <div className="absolute top-[30%] right-[10%]  w-[500px] h-[500px] bg-blue-600/[0.15] rounded-full blur-[120px]" />
          <div className="absolute bottom-[10%] left-[40%] w-[400px] h-[400px] bg-indigo-600/[0.12] rounded-full blur-[100px]" />
          {/* Subtle grid */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:72px_72px]" />
          {/* Vignette */}
          <div className="absolute inset-0 bg-radial-[ellipse_at_center] from-transparent to-[#07070f]/80" />
        </motion.div>

        <motion.div style={{ opacity: heroOpacity }} className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-8">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'backOut' }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/25 bg-purple-500/[0.08] text-purple-300 text-sm font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            100% Free · No credit card · No limits
          </motion.div>

          {/* H1 */}
          <div className="overflow-hidden">
            <motion.h1
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight leading-[1.04]">
              Grow Your YouTube
              <br />
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
                  Channel Faster
                </span>
                <motion.div
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.9, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute -bottom-2 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
              </span>
            </motion.h1>
          </div>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.25 }}
            className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Research trends, write retention scripts, generate voiceovers, and track competitors —
            one free AI toolkit built for YouTube creators.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.35 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <GoogleBtn />
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.65, delay: 0.55 }}
            className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-gray-500">
            {['No credit card required', 'Free forever plan', '10K+ active creators'].map((t, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-green-500 shrink-0" /> {t}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-[10px] tracking-[0.25em] uppercase text-gray-600">Scroll</span>
          <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="w-px h-10 bg-gradient-to-b from-gray-500/60 to-transparent" />
        </motion.div>
      </section>

      {/* ════════════════════════ STATS ══════════════════════════════════ */}
      <section className="relative py-16 border-y border-white/[0.05] bg-white/[0.015]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <StaggerGrid className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { to: 10000, suffix: '+', label: 'Scripts generated' },
              { to: 500,   suffix: '+', label: 'Active creators'   },
              { to: 23,    suffix: '',  label: 'Neural voices'      },
              { to: 100,   suffix: '%', label: 'Free forever'       },
            ].map((s, i) => (
              <StaggerItem key={i}>
                <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent tabular-nums">
                  <AnimatedCount to={s.to} suffix={s.suffix} />
                </div>
                <p className="text-sm text-gray-500 mt-1.5">{s.label}</p>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ════════════════════════ HOW IT WORKS ═══════════════════════════ */}
      <section className="relative py-32 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 -translate-y-1/2 left-0 w-[450px] h-[450px] bg-blue-600/[0.08] rounded-full blur-[100px]" />
        </div>
        <div className="max-w-4xl mx-auto relative">
          <FadeUp className="text-center mb-20">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-[0.22em] block mb-3">How it works</span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Idea to video,{' '}
              <span className="text-gray-500">in minutes</span>
            </h2>
          </FadeUp>

          <div className="relative space-y-4">
            {/* Vertical connector line */}
            <div className="absolute left-[27px] top-12 bottom-12 w-px bg-gradient-to-b from-purple-500/30 via-blue-500/20 to-transparent hidden sm:block" />

            {HOW.map((s, i) => (
              <FadeUp key={i} delay={i * 0.13}>
                <div className="group flex gap-5 sm:gap-8 items-start p-6 sm:p-7 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-400 cursor-default">
                  <div className="relative shrink-0 w-[56px] h-[56px] rounded-2xl bg-gradient-to-br from-purple-500/15 to-blue-500/15 border border-white/[0.08] flex items-center justify-center group-hover:border-purple-500/30 transition-colors">
                    <span className="text-sm font-bold text-gray-400 group-hover:text-purple-300 transition-colors">{s.n}</span>
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <h3 className="text-lg font-semibold mb-1.5 group-hover:text-white transition-colors">{s.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                  <ChevronRight className="shrink-0 mt-2 w-4 h-4 text-gray-700 group-hover:text-purple-400 group-hover:translate-x-1 transition-all hidden sm:block" />
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════ FEATURES ═══════════════════════════════ */}
      <section className="relative py-32 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-600/[0.08] rounded-full blur-[130px]" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/[0.08] rounded-full blur-[110px]" />
        </div>
        <div className="max-w-7xl mx-auto relative">
          <FadeUp className="text-center mb-20">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-[0.22em] block mb-3">Everything you need</span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
              One toolkit.{' '}
              <span className="text-gray-500">Every step.</span>
            </h2>
            <p className="text-gray-400 text-lg mt-4 max-w-xl mx-auto leading-relaxed">
              Research, write, produce, and grow — no subscriptions, no paywalls, no catch.
            </p>
          </FadeUp>

          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <StaggerItem key={i}>
                <div className="group relative h-full p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.035] transition-all duration-400 overflow-hidden cursor-default">
                  <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500`} />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-5">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center shadow-lg`}>
                        <f.icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{f.tag}</span>
                    </div>
                    <h3 className="text-[15px] font-semibold mb-2 group-hover:text-white transition-colors">{f.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ════════════════════════ TRUST STRIP ════════════════════════════ */}
      <section className="py-20 px-4 sm:px-6 border-y border-white/[0.05] bg-white/[0.015]">
        <div className="max-w-5xl mx-auto">
          <StaggerGrid className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TRUST.map((t, i) => (
              <StaggerItem key={i}>
                <div className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl hover:bg-white/[0.04] transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <t.icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.sub}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ════════════════════════ TESTIMONIALS ═══════════════════════════ */}
      <section className="relative py-32 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-pink-600/[0.07] rounded-full blur-[100px]" />
        </div>
        <div className="max-w-6xl mx-auto relative">
          <FadeUp className="text-center mb-16">
            <span className="text-xs font-bold text-pink-400 uppercase tracking-[0.22em] block mb-3">Creators love it</span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">Real results,
              <span className="text-gray-500"> real creators</span>
            </h2>
          </FadeUp>

          <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TESTIMONIALS.map((t, i) => (
              <StaggerItem key={i}>
                <div className="h-full flex flex-col gap-4 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.035] transition-all duration-300">
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed flex-1">&ldquo;{t.text}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold shrink-0">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{t.name}</p>
                      <p className="text-[11px] text-gray-500">{t.handle}</p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ════════════════════════ FINAL CTA ══════════════════════════════ */}
      <section className="py-32 px-4 sm:px-6">
        <FadeUp>
          <div className="max-w-3xl mx-auto relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/25 to-blue-600/25 rounded-3xl blur-3xl scale-95" />
            <div className="relative rounded-3xl border border-white/[0.1] bg-white/[0.03] p-10 sm:p-16 text-center overflow-hidden">
              {/* Grid texture */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:44px_44px]" />
              {/* Corner glows */}
              <div className="absolute top-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full blur-2xl" />
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl" />

              <div className="relative space-y-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }} transition={{ duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/25 bg-purple-500/[0.08] text-purple-300 text-sm">
                  <Users className="w-3.5 h-3.5" /> Join 10,000+ creators
                </motion.div>

                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
                  Start creating today.
                  <br />
                  <span className="text-gray-500">It&apos;s free forever.</span>
                </h2>

                <p className="text-gray-400 text-lg max-w-md mx-auto leading-relaxed">
                  No trial period. No credit card. No catch. Sign in with Google and you&apos;re ready in 60 seconds.
                </p>

                <div className="flex justify-center">
                  <GoogleBtn label="Get started free — it's free" />
                </div>
              </div>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ════════════════════════ FOOTER ═════════════════════════════════ */}
      <footer className="border-t border-white/[0.05] py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <PlayCircle className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-400">ContentStudio</span>
          </div>
          <p>© 2026 ContentStudio. Built for creators, by creators.</p>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            All systems operational
          </div>
        </div>
      </footer>
    </div>
  );
}
