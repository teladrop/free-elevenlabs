import { NextRequest, NextResponse } from 'next/server';
import { createProject, listProjects, getProject, updateProject, deleteProject } from '@/lib/db/projects';
import { ApiResponse, Project } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('id');

    if (projectId) {
      // Get single project
      const project = await getProject(projectId);
      if (!project) {
        return NextResponse.json(
          { success: false, error: 'Project not found' } as ApiResponse<null>,
          { status: 404 },
        );
      }
      return NextResponse.json({ success: true, data: project } as ApiResponse<Project>);
    } else {
      // List all projects
      const projects = await listProjects();
      return NextResponse.json({
        success: true,
        data: projects,
        message: `Found ${projects.length} projects`,
      } as ApiResponse<Project[]>);
    }
  } catch (error) {
    console.error('Projects GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch projects' } as ApiResponse<null>,
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, title, topic, params, projectId, updates } = body;

    if (action === 'create') {
      // Create new project
      if (!title || !topic) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields: title, topic' } as ApiResponse<null>,
          { status: 400 },
        );
      }

      const project = await createProject(title, topic, params || {});
      return NextResponse.json({ success: true, data: project } as ApiResponse<Project>, { status: 201 });
    } else if (action === 'update') {
      // Update existing project
      if (!projectId) {
        return NextResponse.json(
          { success: false, error: 'projectId is required for update' } as ApiResponse<null>,
          { status: 400 },
        );
      }

      const updated = await updateProject(projectId, updates || {});
      if (!updated) {
        return NextResponse.json(
          { success: false, error: 'Project not found' } as ApiResponse<null>,
          { status: 404 },
        );
      }

      return NextResponse.json({ success: true, data: updated } as ApiResponse<Project>);
    } else if (action === 'delete') {
      // Delete project
      if (!projectId) {
        return NextResponse.json(
          { success: false, error: 'projectId is required for delete' } as ApiResponse<null>,
          { status: 400 },
        );
      }

      const deleted = await deleteProject(projectId);
      if (!deleted) {
        return NextResponse.json(
          { success: false, error: 'Project not found' } as ApiResponse<null>,
          { status: 404 },
        );
      }

      return NextResponse.json({ success: true, message: 'Project deleted' } as ApiResponse<null>);
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use: create, update, or delete' } as ApiResponse<null>,
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Projects POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to process project' } as ApiResponse<null>,
      { status: 500 },
    );
  }
}
