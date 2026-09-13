import fs from 'fs/promises';
import path from 'path';
import { Project } from '@/lib/types';

/**
 * File-based project storage
 * Uses JSON files stored in .kiro/projects directory
 * In production, this would be replaced with a proper database
 */

const PROJECTS_DIR = path.join(process.cwd(), '.kiro', 'projects');

async function ensureProjectsDir() {
  try {
    await fs.mkdir(PROJECTS_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

async function getProjectPath(projectId: string): Promise<string> {
  await ensureProjectsDir();
  return path.join(PROJECTS_DIR, `${projectId}.json`);
}

/**
 * Create a new project
 */
export async function createProject(
  title: string,
  topic: string,
  params: Partial<Project>,
): Promise<Project> {
  const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  const project: Project = {
    id: projectId,
    title,
    topic,
    contentType: params.contentType || 'educational',
    style: params.style || 'documentary',
    targetAudience: params.targetAudience || 'general',
    videoLength: params.videoLength || 10,
    tone: params.tone || 'conversational',
    retentionIntensity: params.retentionIntensity || 7,
    platform: params.platform || 'youtube',
    researchNotes: params.researchNotes,
    selectedAngle: params.selectedAngle,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  const projectPath = await getProjectPath(projectId);
  await fs.writeFile(projectPath, JSON.stringify(project, null, 2), 'utf-8');

  return project;
}

/**
 * Get a single project
 */
export async function getProject(projectId: string): Promise<Project | null> {
  try {
    const projectPath = await getProjectPath(projectId);
    const data = await fs.readFile(projectPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * List all projects
 */
export async function listProjects(): Promise<Project[]> {
  try {
    await ensureProjectsDir();
    const files = await fs.readdir(PROJECTS_DIR);
    const projects: Project[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const data = await fs.readFile(path.join(PROJECTS_DIR, file), 'utf-8');
        const project = JSON.parse(data);
        projects.push(project);
      } catch {
        // Skip invalid files
      }
    }

    // Sort by updatedAt descending
    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * Update a project
 */
export async function updateProject(projectId: string, updates: Partial<Project>): Promise<Project | null> {
  const project = await getProject(projectId);
  if (!project) {
    return null;
  }

  const updated: Project = {
    ...project,
    ...updates,
    id: project.id, // Never update ID
    createdAt: project.createdAt, // Never update creation time
    updatedAt: Date.now(),
  };

  const projectPath = await getProjectPath(projectId);
  await fs.writeFile(projectPath, JSON.stringify(updated, null, 2), 'utf-8');

  return updated;
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  try {
    const projectPath = await getProjectPath(projectId);
    await fs.unlink(projectPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Update script for a project
 */
export async function updateProjectScript(
  projectId: string,
  script: string,
  analysis?: Record<string, unknown>,
): Promise<Project | null> {
  return updateProject(projectId, {
    script,
    scriptAnalysis: analysis as any,
    status: 'scripting',
  });
}

/**
 * Update visual settings for a project
 */
export async function updateProjectVisuals(
  projectId: string,
  visualStyle: string,
  visualBible?: Record<string, string>,
): Promise<Project | null> {
  return updateProject(projectId, {
    visualStyle,
    visualBible: visualBible as any,
    status: 'visual',
  });
}

/**
 * Update script lines with visual prompts
 */
export async function updateProjectLines(
  projectId: string,
  lines: Record<string, unknown>[],
): Promise<Project | null> {
  return updateProject(projectId, {
    lines: lines as any,
  });
}
