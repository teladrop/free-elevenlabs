/**
 * History persistence layer — Supabase (per-user scoped)
 *
 * All functions require a userId — rows are filtered/inserted with user_id.
 * Uses the SERVICE-ROLE client so queries work regardless of RLS.
 *
 * Tables (run migration 005 if not done):
 *
 * script_history:
 *   id uuid PK, user_id uuid FK auth.users, created_at, topic text,
 *   params jsonb, script text, analysis jsonb, word_count int, duration_m int
 *
 * visual_history:
 *   id uuid PK, user_id uuid FK auth.users, created_at, script_text text,
 *   visual_style text, visual_bible text, lines jsonb, prompt_count int
 */

import { getServerAuthClient } from './auth-server';
import type { ScriptGenerationParams, ScriptAnalysis, ScriptLine } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScriptHistoryEntry {
  id:         string;
  user_id:    string;
  created_at: string;
  topic:      string;
  params:     ScriptGenerationParams;
  script:     string;
  analysis:   ScriptAnalysis | null;
  word_count: number | null;
  duration_m: number | null;
}

export interface VisualHistoryEntry {
  id:           string;
  user_id:      string;
  created_at:   string;
  script_text:  string;
  visual_style: string;
  visual_bible: string | null;
  lines:        ScriptLine[];
  prompt_count: number | null;
}

// Helper — returns the service-role client or throws if not configured
function db() {
  const client = getServerAuthClient();
  if (!client) throw new Error('Supabase service-role client not configured');
  return client;
}

// ── Script history ─────────────────────────────────────────────────────────

export async function saveScriptHistory(
  userId:   string,
  params:   ScriptGenerationParams,
  script:   string,
  analysis: ScriptAnalysis | null,
): Promise<string | null> {
  try {
    const words = script.split(/\s+/).filter(Boolean).length;
    const { data, error } = await db()
      .from('script_history')
      .insert({
        user_id:    userId,
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
  } catch (e) { console.error('[history] saveScript exception:', e); return null; }
}

export async function listScriptHistory(
  userId: string,
  limit  = 50,
): Promise<ScriptHistoryEntry[]> {
  try {
    const { data, error } = await db()
      .from('script_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { console.error('[history] listScripts:', error.message); return []; }
    return data ?? [];
  } catch (e) { console.error('[history] listScripts exception:', e); return []; }
}

export async function getScriptHistory(
  userId: string,
  id:     string,
): Promise<ScriptHistoryEntry | null> {
  try {
    const { data, error } = await db()
      .from('script_history')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)   // ensure ownership
      .single();
    if (error) { console.error('[history] getScript:', error.message); return null; }
    return data;
  } catch (e) { console.error('[history] getScript exception:', e); return null; }
}

export async function deleteScriptHistory(
  userId: string,
  id:     string,
): Promise<boolean> {
  try {
    const { error } = await db()
      .from('script_history')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);  // ensure ownership
    if (error) { console.error('[history] deleteScript:', error.message); return false; }
    return true;
  } catch (e) { console.error('[history] deleteScript exception:', e); return false; }
}

// ── Visual history ─────────────────────────────────────────────────────────

export async function saveVisualHistory(
  userId:      string,
  scriptText:  string,
  visualStyle: string,
  visualBible: string,
  lines:       ScriptLine[],
): Promise<string | null> {
  try {
    const { data, error } = await db()
      .from('visual_history')
      .insert({
        user_id:      userId,
        script_text:  scriptText,
        visual_style: visualStyle,
        visual_bible: visualBible || null,
        lines,
        prompt_count: lines.filter(l => l.visualPrompt?.trim() && !l.visualPrompt.startsWith('❌')).length,
      })
      .select('id')
      .single();
    if (error) { console.error('[history] saveVisual:', error.message); return null; }
    return data.id;
  } catch (e) { console.error('[history] saveVisual exception:', e); return null; }
}

export async function listVisualHistory(
  userId: string,
  limit  = 50,
): Promise<VisualHistoryEntry[]> {
  try {
    const { data, error } = await db()
      .from('visual_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { console.error('[history] listVisuals:', error.message); return []; }
    return data ?? [];
  } catch (e) { console.error('[history] listVisuals exception:', e); return []; }
}

export async function getVisualHistory(
  userId: string,
  id:     string,
): Promise<VisualHistoryEntry | null> {
  try {
    const { data, error } = await db()
      .from('visual_history')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)   // ensure ownership
      .single();
    if (error) { console.error('[history] getVisual:', error.message); return null; }
    return data;
  } catch (e) { console.error('[history] getVisual exception:', e); return null; }
}

export async function deleteVisualHistory(
  userId: string,
  id:     string,
): Promise<boolean> {
  try {
    const { error } = await db()
      .from('visual_history')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);  // ensure ownership
    if (error) { console.error('[history] deleteVisual:', error.message); return false; }
    return true;
  } catch (e) { console.error('[history] deleteVisual exception:', e); return false; }
}
