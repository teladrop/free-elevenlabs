'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const TEMPLATES = [
  { id: 'documentary',   name: 'Documentary',         style: 'Documentary',          tone: 'Cinematic',      length: 12, desc: 'Deep-dive storytelling with narrative arc.',           emoji: '🎬', color: '#f97316' },
  { id: 'explainer',     name: 'Explainer',            style: 'Explainer',            tone: 'Conversational', length: 7,  desc: 'Clear, educational breakdown of complex topics.',      emoji: '💡', color: '#3b82f6' },
  { id: 'business',      name: 'Business Deep Dive',   style: 'Business Documentary', tone: 'Authoritative',  length: 15, desc: 'Strategy, economics, and business models.',           emoji: '💼', color: '#22c55e' },
  { id: 'science',       name: 'Science Explainer',    style: 'Educational',          tone: 'Curious',        length: 10, desc: 'Science concepts with curiosity and clarity.',        emoji: '🔬', color: '#06b6d4' },
  { id: 'investigative', name: 'Investigative',        style: 'Investigative',        tone: 'Mysterious',     length: 18, desc: 'Uncovers hidden stories with tension.',               emoji: '🔍', color: '#a855f7' },
  { id: 'history',       name: 'History',              style: 'Storytelling',         tone: 'Cinematic',      length: 14, desc: 'Historical narratives with character and stakes.',     emoji: '📜', color: '#f59e0b' },
  { id: 'listicle',      name: 'Top 10 Listicle',      style: 'Explainer',            tone: 'Energetic',      length: 8,  desc: 'High-paced ranked list with insights.',               emoji: '📋', color: '#ec4899' },
  { id: 'shortform',     name: 'Short-Form / Reel',    style: 'Short-form',           tone: 'Energetic',      length: 3,  desc: 'Punchy content for Shorts/Reels/TikTok.',            emoji: '⚡', color: '#ef4444' },
  { id: 'geopolitics',   name: 'Geopolitics',          style: 'Documentary',          tone: 'Analytical',     length: 20, desc: 'Geopolitical analysis with global context.',          emoji: '🌍', color: '#84cc16' },
  { id: 'videossay',     name: 'Video Essay',          style: 'Video Essay',          tone: 'Analytical',     length: 16, desc: 'Thoughtful, argument-driven long-form essay.',        emoji: '✍️', color: '#14b8a6' },
  { id: 'narrative',     name: 'Narrative Story',      style: 'Narrative',            tone: 'Mysterious',     length: 12, desc: 'Character-driven story with emotional arc.',          emoji: '📚', color: '#8b5cf6' },
  { id: 'howto',         name: 'How-To / Tutorial',    style: 'Educational',          tone: 'Conversational', length: 6,  desc: 'Step-by-step guide with clear instructions.',        emoji: '🛠️', color: '#f59e0b' },
];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item    = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

export default function ScriptTemplatesPage() {
  const router = useRouter();

  const use = (t: typeof TEMPLATES[number]) => {
    const p = new URLSearchParams({ style: t.style, tone: t.tone, videoLength: String(t.length) });
    router.push(`/scripts/generator?${p.toString()}`);
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Script Templates" description="Pre-configured styles — click any to open Script Generator with defaults applied" />

        <div className="px-8 py-6 max-w-[1100px] mx-auto">
          <motion.div variants={stagger} initial="hidden" animate="show"
            className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map(t => (
              <motion.div key={t.id} variants={item}>
                <button onClick={() => use(t)} className="w-full text-left group">
                  <Card className={cn(
                    'cursor-pointer transition-all duration-200 hover:shadow-lg',
                    'hover:border-[hsl(var(--primary))/50]',
                  )}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="text-2xl w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${t.color}18` }}>
                          {t.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm group-hover:text-[hsl(var(--primary))] transition-colors">{t.name}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 leading-relaxed">{t.desc}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">{t.style}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{t.tone}</Badge>
                        <Badge variant="outline" className="text-[10px]" style={{ color: t.color, borderColor: `${t.color}40` }}>{t.length}m</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
