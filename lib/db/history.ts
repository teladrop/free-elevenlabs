/**
 * History persistence layer — Supabase
 *
 * Required tables (run in Supabase SQL editor):
 *
 * create table script_history (
 *   id          uuid primary key default gen_random_uuid(),
 *   created_at  timestamptz default now(),
 *   topic       text not null,
 *   params      jsonb not null,   -- ScriptGenerationParams
 *   script      text not null,
 *   analysis    jsonb,            -- ScriptAnalysis | null
 *   word_count  int,
 *   duration_m  int
 * );
 *
 * create table visual_history (
 *   id           uuid primary key default gen_random_uuid(),
 *   created_at   timestamptz default now(),
 *   script_text  text not null,
 *   visual_style text not null,
 *   visual_bible text,
 *   lines        jsonb not null,  -- ScriptLine[]
 *   prompt_count int
 * );
 *
 * -- Optional: enable Row Level Security and allow anon reads/writes for a
 * -- single-user local tool:
 * alter table script_history enable row level security;
 * create policy "allow all" on script_history for all using (true) with check (true);
 * alter table visual_history enable row level security;
 * create policy "allow all" on visual_history for all using (true) with check (true);
 */

import { supabase } from './supabase';
import type { ScriptGenerationParams, ScriptAnalysis, ScriptLine } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScriptHistoryEntry {
  id: string;
  created_at: string;
  topic: string;
  params: ScriptGenerationParams;
  script: string;
  analysis: ScriptAnalysis | null;
  word_count: number | null;
  duration_m: number | null;
}

export interface VisualHistoryEntry {
  id: string;
  created_at: string;
  script_text: string;
  visual_style: string;
  visual_bible: string | null;
  lines: ScriptLine[];
  prompt_count: number | null;
}

// ── Script history ─────────────────────────────────────────────────────────

export async function saveScriptHistory(
  params: ScriptGenerationParams,
  script: string,
  analysis: ScriptAnalysis | null,
): Promise<string | null> {
  if (!supabase) return null;
  const words = script.split(/\s+/).filter(Boolean).length;
  const { data, error } = await supabase
    .from('script_history')
    .insert({
      topic:      params.topic,
      params,
      script,
      analysis,
      word_count: words,
      duration_m: Math.round(words / 140),
    })
    .select('id')
    .single();
  if (error) { console.error('[history] saveScript:', error.message); return null; }
  return data.id;
}

export async function listScriptHistory(limit = 50): Promise<ScriptHistoryEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('script_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[history] listScripts:', error.message); return []; }
  return data ?? [];
}

export async function getScriptHistory(id: string): Promise<ScriptHistoryEntry | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('script_history')
    .select('*')
    .eq('id', id)
    .single();
  if (error) { console.error('[history] getScript:', error.message); return null; }
  return data;
}

export async function deleteScriptHistory(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('script_history').delete().eq('id', id);
  if (error) { console.error('[history] deleteScript:', error.message); return false; }
  return true;
}

// ── Visual history ─────────────────────────────────────────────────────────

export async function saveVisualHistory(
  scriptText: string,
  visualStyle: string,
  visualBible: string,
  lines: ScriptLine[],
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('visual_history')
    .insert({
      script_text:  scriptText,
      visual_style: visualStyle,
      visual_bible: visualBible || null,
      lines,
      prompt_count: lines.filter(l => l.visualPrompt?.trim()).length,
    })
    .select('id')
    .single();
  if (error) { console.error('[history] saveVisual:', error.message); return null; }
  return data.id;
}

export async function listVisualHistory(limit = 50): Promise<VisualHistoryEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('visual_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[history] listVisuals:', error.message); return []; }
  return data ?? [];
}

export async function getVisualHistory(id: string): Promise<VisualHistoryEntry | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('visual_history')
    .select('*')
    .eq('id', id)
    .single();
  if (error) { console.error('[history] getVisual:', error.message); return null; }
  return data;
}

export async function deleteVisualHistory(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('visual_history').delete().eq('id', id);
  if (error) { console.error('[history] deleteVisual:', error.message); return false; }
  return true;
}
