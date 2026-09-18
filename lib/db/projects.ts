/**
 * Projects persistence layer — Supabase
 *
 * Uses the SERVICE-ROLE client so it bypasses RLS and works from any
 * API route on Vercel (no local filesystem, no ENOENT errors).
 *
 * All public functions accept an optional userId. When provided, rows are
 * scoped to that user. The API route passes the authenticated user's id.
 *
 * Table: projects  (run migration 006 to create it)
 */

import { getServerAuthClient } from './auth-server';
import type { Project } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map a DB row → Project (camelCase) */
function rowToProject(r: Record<string, unknown>): Project {
  return {
    id:                 r.id                 as string,
    title:              r.title              as string,
    topic:              r.topic              as string,
    contentType:        r.content_type       as string,
    style:              r.style              as string,
    targetAudience:     r.target_audience    as string,
    videoLength:        r.video_length       as number,
    tone:               r.tone               as string,
    retentionIntensity: r.retention_intensity as number,
    platform:           r.platform           as string,
    researchNotes:      r.research_notes     as string | undefined,
    selectedAngle:      r.selected_angle     as string | undefined,
    script:             r.script             as string | undefined,
    scriptAnalysis:     r.script_analysis    as Project['scriptAnalysis'],
    visualStyle:        r.visual_style       as string | undefined,
    visualBible:        r.visual_bible       as Project['visualBible'],
    lines:              r.lines              as Project['lines'],
    voiceSettings:      r.voice_settings     as Project['voiceSettings'],
    status:             r.status             as Project['status'],
    createdAt:          r.created_at         as number,
    updatedAt:          r.updated_at         as number,
  };
}

/** Map a Project (partial) → DB columns (snake_case) */
function projectToRow(p: Partial<Project>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.title              !== undefined) row.title               = p.title;
  if (p.topic              !== undefined) row.topic               = p.topic;
  if (p.contentType        !== undefined) row.content_type        = p.contentType;
  if (p.style              !== undefined) row.style               = p.style;
  if (p.targetAudience     !== undefined) row.target_audience     = p.targetAudience;
  if (p.videoLength        !== undefined) row.video_length        = p.videoLength;
  if (p.tone               !== undefined) row.tone                = p.tone;
  if (p.retentionIntensity !== undefined) row.retention_intensity = p.retentionIntensity;
  if (p.platform           !== undefined) row.platform            = p.platform;
  if (p.researchNotes      !== undefined) row.research_notes      = p.researchNotes;
  if (p.selectedAngle      !== undefined) row.selected_angle      = p.selectedAngle;
  if (p.script             !== undefined) row.script              = p.script;
  if (p.scriptAnalysis     !== undefined) row.script_analysis     = p.scriptAnalysis;
  if (p.visualStyle        !== undefined) row.visual_style        = p.visualStyle;
  if (p.visualBible        !== undefined) row.visual_bible        = p.visualBible;
  if (p.lines              !== undefined) row.lines               = p.lines;
  if (p.voiceSettings      !== undefined) row.voice_settings      = p.voiceSettings;
  if (p.status             !== undefined) row.status              = p.status;
  return row;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createProject(
  title: string,
  topic: string,
  params: Partial<Project>,
  userId?: string,
): Promise<Project> {
  const db = getServerAuthClient();
  if (!db) throw new Error('Database not configured');

  const now       = Date.now();
  const projectId = `project_${now}_${Math.random().toString(36).slice(2, 11)}`;

  const row = {
    id:                 projectId,
    user_id:            userId ?? null,
    title,
    topic,
    content_type:       params.contentType        ?? 'educational',
    style:              params.style              ?? 'documentary',
    target_audience:    params.targetAudience     ?? 'general',
    video_length:       params.videoLength        ?? 10,
    tone:               params.tone               ?? 'conversational',
    retention_intensity: params.retentionIntensity ?? 7,
    platform:           params.platform           ?? 'youtube',
    research_notes:     params.researchNotes      ?? null,
    selected_angle:     params.selectedAngle      ?? null,
    script:             params.script             ?? null,
    script_analysis:    params.scriptAnalysis     ?? null,
    visual_style:       params.visualStyle        ?? null,
    visual_bible:       params.visualBible        ?? null,
    lines:              params.lines              ?? null,
    voice_settings:     params.voiceSettings      ?? null,
    status:             params.status             ?? 'draft',
    created_at:         now,
    updated_at:         now,
  };

  const { data, error } = await db.from('projects').insert(row).select().single();
  if (error) throw new Error(error.message);
  return rowToProject(data);
}

export async function getProject(
  projectId: string,
  userId?: string,
): Promise<Project | null> {
  const db = getServerAuthClient();
  if (!db) return null;

  let q = db.from('projects').select('*').eq('id', projectId);
  if (userId) q = q.eq('user_id', userId);

  const { data, error } = await q.single();
  if (error || !data) return null;
  return rowToProject(data);
}

export async function listProjects(userId?: string): Promise<Project[]> {
  const db = getServerAuthClient();
  if (!db) return [];

  let q = db.from('projects').select('*').order('updated_at', { ascending: false });
  if (userId) q = q.eq('user_id', userId);

  const { data, error } = await q;
  if (error || !data) return [];
  return data.map(rowToProject);
}

export async function updateProject(
  projectId: string,
  updates: Partial<Project>,
  userId?: string,
): Promise<Project | null> {
  const db = getServerAuthClient();
  if (!db) return null;

  const row = { ...projectToRow(updates), updated_at: Date.now() };

  let q = db.from('projects').update(row).eq('id', projectId);
  if (userId) q = q.eq('user_id', userId);

  const { data, error } = await q.select().single();
  if (error || !data) return null;
  return rowToProject(data);
}

export async function deleteProject(
  projectId: string,
  userId?: string,
): Promise<boolean> {
  const db = getServerAuthClient();
  if (!db) return false;

  let q = db.from('projects').delete().eq('id', projectId);
  if (userId) q = q.eq('user_id', userId);

  const { error } = await q;
  return !error;
}

// ── Legacy helpers (kept for compatibility with existing API route calls) ─────

export async function updateProjectScript(
  projectId: string,
  script: string,
  analysis?: Record<string, unknown>,
): Promise<Project | null> {
  return updateProject(projectId, {
    script,
    scriptAnalysis: analysis as unknown as Project['scriptAnalysis'],
    status: 'scripting',
  });
}

export async function updateProjectVisuals(
  projectId: string,
  visualStyle: string,
  visualBible?: Record<string, string>,
): Promise<Project | null> {
  return updateProject(projectId, {
    visualStyle,
    visualBible: visualBible as unknown as Project['visualBible'],
    status: 'visual',
  });
}

export async function updateProjectLines(
  projectId: string,
  lines: Record<string, unknown>[],
): Promise<Project | null> {
  return updateProject(projectId, { lines: lines as unknown as Project['lines'] });
}

// Re-export getUserFromRequest for convenience (used by the API route)
export { getUserFromRequest } from './auth-server';
