'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisualStyle } from '@/lib/types';

const STYLES: { id: VisualStyle; name: string; emoji: string; desc: string; color: string }[] = [
  { id: '2d-stickman',       name: '2D Stickman',       emoji: '🧍', desc: 'Simple stick figures',          color: '#3b82f6' },
  { id: '2d-minimal',        name: '2D Minimal',         emoji: '⬜', desc: 'Flat design, clean shapes',    color: '#22c55e' },
  { id: '2d-editorial',      name: '2D Editorial',       emoji: '🖌️', desc: 'Illustrated editorial',         color: '#f59e0b' },
  { id: '2d-documentary',    name: '2D Documentary',     emoji: '📰', desc: 'Documentary illustration',      color: '#ef4444' },
  { id: '3d-stylized',       name: '3D Stylized',        emoji: '🎮', desc: 'Expressive 3D renders',         color: '#a855f7' },
  { id: '3d-educational',    name: '3D Educational',     emoji: '🔬', desc: 'Clean 3D education style',      color: '#06b6d4' },
  { id: '3d-isometric',      name: '3D Isometric',       emoji: '📦', desc: 'Isometric grid layout',         color: '#ec4899' },
  { id: 'cinematic',         name: 'Cinematic',          emoji: '🎬', desc: 'Film-quality renders',           color: '#f97316' },
  { id: 'photorealistic',    name: 'Photorealistic',     emoji: '📷', desc: 'Hyper-realistic renders',        color: '#84cc16' },
  { id: '3d-lowpoly',        name: 'Low-Poly 3D',        emoji: '💎', desc: 'Polygon art aesthetic',          color: '#14b8a6' },
  { id: 'paper-cutout',      name: 'Paper Cutout',       emoji: '✂️', desc: 'Cut-paper animation',           color: '#f59e0b' },
  { id: 'hand-drawn',        name: 'Hand-Drawn',         emoji: '✏️', desc: 'Sketch / hand-drawn feel',      color: '#d97706' },
  { id: 'infographic',       name: 'Infographic',        emoji: '📊', desc: 'Data visualisation charts',     color: '#3b82f6' },
  { id: 'animated-diagram',  name: 'Animated Diagram',   emoji: '🔄', desc: 'Flowcharts and diagrams',       color: '#22c55e' },
  { id: 'minimal-geometric', name: 'Minimal Geometric',  emoji: '🔷', desc: 'Abstract geometric art',        color: '#a855f7' },
  { id: 'map-geographic',    name: 'Map / Geographic',   emoji: '🗺️', desc: 'Geography and location',        color: '#06b6d4' },
  { id: 'retro',             name: 'Retro Illustration',  emoji: '📻', desc: 'Vintage / retro art',           color: '#f97316' },
];

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3'];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item    = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: { duration: 0.2 } } };

export default function VisualStylesPage() {
  const [selectedStyle, setSelectedStyle] = useState<VisualStyle>('3d-stylized');
  const [aspectRatio,   setAspectRatio]   = useState('16:9');
  const [colorDir,      setColorDir]      = useState('');
  const [lighting,      setLighting]      = useState('');
  const [environment,   setEnvironment]   = useState('');
  const [charAppear,    setCharAppear]    = useState('');
  const [charClothing,  setCharClothing]  = useState('');
  const [cameraLang,    setCameraLang]    = useState('');
  const [saved,         setSaved]         = useState(false);

  useEffect(() => {
    const b = localStorage.getItem('visualBible');
    if (b) {
      try {
        const j = JSON.parse(b);
        setSelectedStyle(j.style || '3d-stylized');
        setAspectRatio(j.aspectRatio || '16:9');
        setColorDir(j.colorDirection || '');
        setLighting(j.lighting || '');
        setEnvironment(j.environment || '');
        setCharAppear(j.characterAppearance || '');
        setCharClothing(j.characterClothing || '');
        setCameraLang(j.cameraLanguage || '');
      } catch {}
    }
  }, []);

  const save = () => {
    const bible = {
      style: selectedStyle, aspectRatio,
      colorDirection: colorDir, lighting, environment,
      characterAppearance: charAppear, characterClothing: charClothing,
      cameraLanguage: cameraLang,
    };
    localStorage.setItem('visualBible', JSON.stringify(bible));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const selected = STYLES.find(s => s.id === selectedStyle);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <PageHeader title="Visual Styles" description="Choose a style and configure your Visual Bible for scene-to-scene consistency">
          <Button onClick={save} className="gap-2">
            {saved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Visual Bible'}
          </Button>
        </PageHeader>

        <div className="px-8 py-6 max-w-[1280px] mx-auto grid grid-cols-[1fr_320px] gap-6">

          {/* Style grid */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-4">Visual Style</p>
            <motion.div variants={stagger} initial="hidden" animate="show"
              className="grid grid-cols-3 xl:grid-cols-4 gap-3">
              {STYLES.map(s => {
                const active = selectedStyle === s.id;
                return (
                  <motion.button key={s.id} variants={item}
                    onClick={() => setSelectedStyle(s.id)}
                    className={cn(
                      'relative rounded-xl border p-4 text-left transition-all duration-150 cursor-pointer',
                      active
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))/8]'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))/40]',
                    )}
                    style={{ boxShadow: active ? `0 0 0 1px hsl(var(--primary))` : undefined }}
                  >
                    {active && (
                      <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    <div className="text-2xl mb-2">{s.emoji}</div>
                    <p className={cn('text-xs font-bold mb-0.5', active ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--foreground))]')}>{s.name}</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-snug">{s.desc}</p>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>

          {/* Visual Bible sidebar */}
          <div className="space-y-4 sticky top-4">
            {selected && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: `${selected.color}20` }}>
                      {selected.emoji}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{selected.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{selected.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-5 space-y-4">
                <p className="text-sm font-semibold">Visual Bible</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] -mt-2">These settings keep every scene visually consistent.</p>

                {/* Aspect ratio */}
                <div>
                  <Label className="mb-2 block">Aspect Ratio</Label>
                  <div className="flex gap-2">
                    {ASPECT_RATIOS.map(r => (
                      <button key={r} onClick={() => setAspectRatio(r)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                          aspectRatio === r
                            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))/12] text-[hsl(var(--primary))]'
                            : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-hover))]',
                        )}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {[
                  { label: 'Color Direction',        val: colorDir,     set: setColorDir,     ph: 'e.g. muted earth tones, warm highlights' },
                  { label: 'Lighting',               val: lighting,     set: setLighting,     ph: 'e.g. soft studio, dramatic side lighting' },
                  { label: 'Environment',            val: environment,  set: setEnvironment,  ph: 'e.g. modern office interiors' },
                  { label: 'Character Appearance',   val: charAppear,   set: setCharAppear,   ph: 'e.g. stylized business professional' },
                  { label: 'Character Clothing',     val: charClothing, set: setCharClothing, ph: 'e.g. casual-smart, blue tones' },
                  { label: 'Camera Language',        val: cameraLang,   set: setCameraLang,   ph: 'e.g. wide shots, close-ups for emotion' },
                ].map(f => (
                  <div key={f.label}>
                    <Label className="mb-1.5 block">{f.label}</Label>
                    <Input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} className="text-xs" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
