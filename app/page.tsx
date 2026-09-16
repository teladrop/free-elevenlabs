'use client';

import { useEffect, useState } from 'react';
import { signInWithGoogle, getAuthClientInstance } from '@/lib/db/auth-client';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Video,
  FileText,
  Zap,
  TrendingUp,
  Users,
  ArrowRight,
  Check,
  PlayCircle,
  Mic2,
  Lightbulb,
  BarChart2,
  Layers,
  Menu,
  X,
} from 'lucide-react';

export default function LandingPage() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const client = getAuthClientInstance();
    if (!client) {
      setIsLoading(false);
      return;
    }

    const timeout = setTimeout(() => setIsLoading(false), 3000);

    client.auth.getSession().then(({ data }) => {
      clearTimeout(timeout);
      if (data.session) {
        const params = new URLSearchParams(window.location.search);
        const dest = params.get('redirect') ?? '/dashboard';
        window.location.replace(dest);
      } else {
        setIsLoading(false);
      }
    }).catch(() => {
      clearTimeout(timeout);
      setIsLoading(false);
    });
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      const params = new URLSearchParams(window.location.search);
      const redirectPath = params.get('redirect') ?? '/dashboard';
      const callbackUrl = `${window.location.origin}/auth/complete?redirect=${encodeURIComponent(redirectPath)}`;
      const { error: err } = await signInWithGoogle(callbackUrl);
      if (err) {
        console.error('Sign in error:', err);
        setIsSigningIn(false);
      }
    } catch (err) {
      console.error('Unexpected sign-in error:', err);
      setIsSigningIn(false);
    }
  };

  const features = [
    {
      icon: PlayCircle,
      title: 'YouTube Research',
      description: 'AI niche intelligence — find gaps before competitors do',
      gradient: 'from-red-500 to-red-600',
    },
    {
      icon: FileText,
      title: 'Script Generator',
      description: 'Retention-first scripts with AI analysis and auto-rewrite',
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      icon: Layers,
      title: 'Visual Prompts',
      description: 'AI prompts for every narration line — ready for image gen',
      gradient: 'from-purple-500 to-purple-600',
    },
    {
      icon: Mic2,
      title: 'Voice Studio',
      description: '23 neural voices via Edge TTS — always free, no key needed',
      gradient: 'from-green-500 to-green-600',
    },
    {
      icon: BarChart2,
      title: 'Channel Analytics',
      description: 'Connect YouTube, track competitors, get AI growth tips',
      gradient: 'from-amber-500 to-amber-600',
    },
    {
      icon: Lightbulb,
      title: 'Content Ideas',
      description: 'AI-generated ideas grounded in real YouTube search data',
      gradient: 'from-cyan-500 to-cyan-600',
    },
  ];

  const stats = [
    { value: '10K+', label: 'Scripts Generated' },
    { value: '500+', label: 'Active Creators' },
    { value: '100%', label: 'Free Forever' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500/30 border-t-purple-500" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-gray-950/80 backdrop-blur-xl border-b border-white/5 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <PlayCircle className="w-8 h-8 text-purple-500" />
              <span className="text-xl font-bold">ContentStudio</span>
            </motion.div>

            {/* Desktop CTA */}
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="hidden md:flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-full font-medium transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
            >
              {isSigningIn ? 'Signing in...' : 'Get Started Free'}
              {!isSigningIn && <ArrowRight className="w-4 h-4" />}
            </motion.button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t border-white/5 bg-gray-950/95 backdrop-blur-xl"
          >
            <div className="px-4 py-4 space-y-3">
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-full font-medium transition-all shadow-lg disabled:opacity-50"
              >
                {isSigningIn ? 'Signing in...' : 'Get Started Free'}
                {!isSigningIn && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full text-sm"
            >
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300">100% Free AI · No credit card required</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight"
            >
              Create Viral Content
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                10x Faster
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto"
            >
              The complete AI toolkit for YouTube creators. Generate scripts, analyze trends,
              and produce professional content in minutes, not hours.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="group w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-full font-semibold text-lg transition-all shadow-2xl shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
              >
                {isSigningIn ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Start Free with Google</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>No credit card required</span>
              </div>
              <span className="hidden sm:inline text-gray-700">•</span>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Free forever plan</span>
              </div>
            </motion.div>
          </div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto"
          >
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-gray-500 mt-2">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Gradient orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Everything You Need to <span className="text-purple-400">Succeed</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Powerful tools designed for modern content creators
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} opacity-20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 text-transparent bg-gradient-to-br ${feature.gradient} bg-clip-text`} style={{ WebkitTextFillColor: 'transparent', backgroundClip: 'text' }} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto text-center bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/20 rounded-3xl p-8 sm:p-12"
        >
          <Users className="w-16 h-16 mx-auto mb-6 text-purple-400" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Join Thousands of Creators
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Start creating professional content today. No experience required.
          </p>
          <button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="px-8 py-4 bg-white hover:bg-gray-100 text-gray-900 rounded-full font-semibold text-lg transition-all shadow-xl hover:shadow-2xl hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 mx-auto"
          >
            {isSigningIn ? 'Signing in...' : 'Get Started Free'}
            {!isSigningIn && <ArrowRight className="w-5 h-5" />}
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          <p>© 2026 ContentStudio. Built for creators, by creators.</p>
        </div>
      </footer>
    </div>
  );
}
