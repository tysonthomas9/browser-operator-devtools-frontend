// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../../../core/Logger.js';
import type {
  MiniApp,
  MiniAppSPA,
  MiniAppController,
  MiniAppBridge,
  MiniAppState,
  MiniAppActionSchema,
  MiniAppStateSchema,
  SPAToDevToolsAction,
} from '../../types/MiniAppTypes.js';
import { AppBuilderSPA } from '../../../ui/app_builder/AppBuilderSPA.js';
import { AppProjectManager } from '../../../core/AppProjectManager.js';
import type {
  AppProject,
  ProjectSummary,
  ProjectFormData,
  ProjectFile,
} from './AppBuilderTypes.js';
import { DEFAULT_PROJECT_TEMPLATE, buildFileTree } from './AppBuilderTypes.js';

const logger = createLogger('AppBuilderMiniApp');

/**
 * AppBuilderMiniApp - AI-powered React app generator
 *
 * Features:
 * - Create React/TypeScript/Tailwind apps from prompts
 * - Live preview via WebContainers
 * - File editing with CodeMirror
 * - Project persistence in IndexedDB
 */
export class AppBuilderMiniApp implements MiniApp {
  id = 'app_builder';
  name = 'App Builder';
  description = 'Create and edit React web applications with AI assistance. Generate apps from prompts, edit code, and see live previews.';
  icon = '🛠️';

  // Route definitions for URL-based navigation
  routes = [
    { name: 'list', pattern: '#app-builder' },
    { name: 'project', pattern: '#app-builder/project/:projectId' },
    { name: 'new', pattern: '#app-builder/new' },
  ];

  getSPA(): MiniAppSPA {
    return {
      html: AppBuilderSPA.html,
      css: AppBuilderSPA.css,
      js: AppBuilderSPA.js,
    };
  }

  getSupportedActions(): MiniAppActionSchema[] {
    return [
      {
        name: 'create-project',
        description: 'Create a new app project with default template',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Project name' },
            description: { type: 'string', description: 'Project description' },
          },
          required: ['name'],
        },
      },
      {
        name: 'list-projects',
        description: 'Get a list of all saved projects',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'open-project',
        description: 'Open a project by ID',
        schema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The project ID to open' },
          },
          required: ['projectId'],
        },
      },
      {
        name: 'delete-project',
        description: 'Delete a project by ID',
        schema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'The project ID to delete' },
          },
          required: ['projectId'],
        },
      },
      {
        name: 'update-file',
        description: 'Update a file in the current project',
        schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path (e.g., src/App.tsx)' },
            content: { type: 'string', description: 'New file content' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'create-file',
        description: 'Create a new file in the current project',
        schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to create' },
            content: { type: 'string', description: 'File content' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'delete-file',
        description: 'Delete a file from the current project',
        schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to delete' },
          },
          required: ['path'],
        },
      },
    ];
  }

  getStateSchema(): MiniAppStateSchema {
    return {
      type: 'object',
      properties: {
        project: {
          type: 'object',
          description: 'Currently open project or null',
        },
        projects: {
          type: 'array',
          description: 'List of saved projects',
        },
        selectedFile: {
          type: 'string',
          description: 'Currently selected file path',
        },
        isLoading: {
          type: 'boolean',
          description: 'Whether the app is loading',
        },
      },
    };
  }

  createController(): MiniAppController {
    return new AppBuilderMiniAppController();
  }
}

/**
 * Controller for App Builder mini app
 */
class AppBuilderMiniAppController implements MiniAppController {
  private bridge: MiniAppBridge | null = null;
  private closeCallback: (() => void | Promise<void>) | null = null;
  private projectManager: AppProjectManager;

  // State
  private currentProject: AppProject | null = null;
  private selectedFile: string | null = null;

  constructor() {
    this.projectManager = AppProjectManager.getInstance();
  }

  async initialize(bridge: MiniAppBridge): Promise<void> {
    this.bridge = bridge;
    bridge.onAction(this.handleAction.bind(this));
    logger.info('AppBuilderMiniAppController initialized');
  }

  async cleanup(): Promise<void> {
    this.bridge = null;
    this.currentProject = null;
    this.selectedFile = null;
    logger.info('AppBuilderMiniAppController cleaned up');
  }

  onClose(callback: () => void | Promise<void>): void {
    this.closeCallback = callback;
  }

  async getState(): Promise<MiniAppState> {
    const projects = await this.projectManager.getAllProjects();
    const projectSummaries: ProjectSummary[] = projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      fileCount: p.files.length,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return {
      project: this.currentProject,
      projects: projectSummaries,
      selectedFile: this.selectedFile,
      isLoading: false,
    };
  }

  async setState(state: MiniAppState): Promise<void> {
    if (state.selectedFile !== undefined) {
      this.selectedFile = state.selectedFile as string | null;
    }
  }

  async updateState(updates: Partial<MiniAppState>): Promise<void> {
    if (updates.selectedFile !== undefined) {
      this.selectedFile = updates.selectedFile as string | null;
    }
  }

  async executeAction(actionName: string, args: unknown): Promise<unknown> {
    const argsObj = args as Record<string, unknown>;

    switch (actionName) {
      case 'create-project':
        return this.handleCreateProject({
          name: argsObj.name as string,
          description: (argsObj.description as string) || '',
        });

      case 'list-projects':
        return this.handleListProjects();

      case 'open-project':
        return this.handleOpenProject(argsObj.projectId as string);

      case 'delete-project':
        return this.handleDeleteProject(argsObj.projectId as string);

      case 'update-file':
        return this.handleUpdateFile(
          argsObj.path as string,
          argsObj.content as string
        );

      case 'create-file':
        return this.handleCreateFile(
          argsObj.path as string,
          argsObj.content as string
        );

      case 'delete-file':
        return this.handleDeleteFile(argsObj.path as string);

      default:
        throw new Error(`Unknown action: ${actionName}`);
    }
  }

  // ============================================================================
  // SPA Action Handlers
  // ============================================================================

  private async handleAction(action: SPAToDevToolsAction): Promise<void> {
    logger.info('Handling SPA action:', action.type);

    switch (action.type) {
      case 'ready':
        await this.pushInitialState();
        break;

      case 'create-project': {
        const payload = action.payload as { data: ProjectFormData };
        await this.handleCreateProjectFromSPA(payload.data);
        break;
      }

      case 'open-project': {
        const payload = action.payload as { projectId: string };
        await this.handleOpenProjectFromSPA(payload.projectId);
        break;
      }

      case 'delete-project': {
        const payload = action.payload as { projectId: string };
        await this.handleDeleteProjectFromSPA(payload.projectId);
        break;
      }

      case 'select-file': {
        const payload = action.payload as { path: string };
        await this.handleSelectFile(payload.path);
        break;
      }

      case 'file-changed': {
        const payload = action.payload as { path: string; content: string };
        await this.handleFileChanged(payload.path, payload.content);
        break;
      }

      case 'create-file': {
        const payload = action.payload as { path: string; content: string };
        await this.handleCreateFileFromSPA(payload.path, payload.content);
        break;
      }

      case 'delete-file': {
        const payload = action.payload as { path: string };
        await this.handleDeleteFileFromSPA(payload.path);
        break;
      }

      case 'close':
        if (this.closeCallback) {
          await this.closeCallback();
        }
        break;

      default:
        logger.warn('Unknown SPA action type:', action.type);
    }
  }

  // ============================================================================
  // Action Implementations
  // ============================================================================

  private async handleCreateProject(data: ProjectFormData): Promise<{ success: boolean; project?: AppProject; error?: string }> {
    try {
      const project = await this.projectManager.createProject({
        name: data.name,
        description: data.description || '',
        files: DEFAULT_PROJECT_TEMPLATE,
      });

      this.currentProject = project;
      this.selectedFile = 'src/App.tsx';

      return { success: true, project };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create project:', error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleListProjects(): Promise<{ projects: ProjectSummary[] }> {
    const projects = await this.projectManager.getAllProjects();
    return {
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        fileCount: p.files.length,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  }

  private async handleOpenProject(projectId: string): Promise<{ success: boolean; project?: AppProject; error?: string }> {
    try {
      const project = await this.projectManager.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      this.currentProject = project;
      this.selectedFile = project.files.length > 0 ? project.files[0].path : null;

      return { success: true, project };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to open project:', error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleDeleteProject(projectId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.projectManager.deleteProject(projectId);

      if (this.currentProject?.id === projectId) {
        this.currentProject = null;
        this.selectedFile = null;
      }

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to delete project:', error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleUpdateFile(path: string, content: string): Promise<{ success: boolean; error?: string }> {
    if (!this.currentProject) {
      return { success: false, error: 'No project open' };
    }

    try {
      const fileIndex = this.currentProject.files.findIndex(f => f.path === path);
      if (fileIndex === -1) {
        return { success: false, error: 'File not found' };
      }

      this.currentProject.files[fileIndex].content = content;
      await this.projectManager.updateProject(this.currentProject.id, {
        files: this.currentProject.files,
      });

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to update file:', error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleCreateFile(path: string, content: string): Promise<{ success: boolean; error?: string }> {
    if (!this.currentProject) {
      return { success: false, error: 'No project open' };
    }

    try {
      const exists = this.currentProject.files.some(f => f.path === path);
      if (exists) {
        return { success: false, error: 'File already exists' };
      }

      const ext = path.split('.').pop()?.toLowerCase() || '';
      const mimeTypes: Record<string, string> = {
        ts: 'text/typescript',
        tsx: 'text/typescript',
        js: 'text/javascript',
        jsx: 'text/javascript',
        json: 'application/json',
        html: 'text/html',
        css: 'text/css',
      };

      const newFile: ProjectFile = {
        path,
        content,
        type: mimeTypes[ext] || 'text/plain',
      };

      this.currentProject.files.push(newFile);
      await this.projectManager.updateProject(this.currentProject.id, {
        files: this.currentProject.files,
      });

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create file:', error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleDeleteFile(path: string): Promise<{ success: boolean; error?: string }> {
    if (!this.currentProject) {
      return { success: false, error: 'No project open' };
    }

    try {
      const fileIndex = this.currentProject.files.findIndex(f => f.path === path);
      if (fileIndex === -1) {
        return { success: false, error: 'File not found' };
      }

      this.currentProject.files.splice(fileIndex, 1);
      await this.projectManager.updateProject(this.currentProject.id, {
        files: this.currentProject.files,
      });

      if (this.selectedFile === path) {
        this.selectedFile = this.currentProject.files.length > 0
          ? this.currentProject.files[0].path
          : null;
      }

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to delete file:', error);
      return { success: false, error: errorMsg };
    }
  }

  // ============================================================================
  // SPA-triggered Handlers
  // ============================================================================

  private async pushInitialState(): Promise<void> {
    const projects = await this.projectManager.getAllProjects();
    const projectSummaries: ProjectSummary[] = projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      fileCount: p.files.length,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    await this.bridge?.sendToSPA({
      action: 'init',
      payload: {
        projects: projectSummaries,
        project: this.currentProject,
        fileTree: this.currentProject ? buildFileTree(this.currentProject.files) : [],
        selectedFile: this.selectedFile,
      },
    });

    logger.info('Initial state pushed to SPA');
  }

  private async handleCreateProjectFromSPA(data: ProjectFormData): Promise<void> {
    const result = await this.handleCreateProject(data);

    if (result.success && result.project) {
      const projects = await this.projectManager.getAllProjects();
      const projectSummaries: ProjectSummary[] = projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        fileCount: p.files.length,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

      await this.bridge?.sendToSPA({
        action: 'project-created',
        payload: {
          project: result.project,
          projects: projectSummaries,
          fileTree: buildFileTree(result.project.files),
          selectedFile: this.selectedFile,
        },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Project created successfully!', type: 'success' },
      });
    } else {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: result.error || 'Failed to create project', type: 'error' },
      });
    }
  }

  private async handleOpenProjectFromSPA(projectId: string): Promise<void> {
    const result = await this.handleOpenProject(projectId);

    if (result.success && result.project) {
      await this.bridge?.sendToSPA({
        action: 'project-opened',
        payload: {
          project: result.project,
          fileTree: buildFileTree(result.project.files),
          selectedFile: this.selectedFile,
        },
      });
    } else {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: result.error || 'Failed to open project', type: 'error' },
      });
    }
  }

  private async handleDeleteProjectFromSPA(projectId: string): Promise<void> {
    const result = await this.handleDeleteProject(projectId);

    if (result.success) {
      const projects = await this.projectManager.getAllProjects();
      const projectSummaries: ProjectSummary[] = projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        fileCount: p.files.length,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

      await this.bridge?.sendToSPA({
        action: 'project-deleted',
        payload: { projects: projectSummaries },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Project deleted successfully!', type: 'success' },
      });
    } else {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: result.error || 'Failed to delete project', type: 'error' },
      });
    }
  }

  private async handleSelectFile(path: string): Promise<void> {
    this.selectedFile = path;

    if (this.currentProject) {
      const file = this.currentProject.files.find(f => f.path === path);
      if (file) {
        await this.bridge?.sendToSPA({
          action: 'file-selected',
          payload: {
            path: file.path,
            content: file.content,
            type: file.type,
          },
        });
      }
    }
  }

  private async handleFileChanged(path: string, content: string): Promise<void> {
    // Update file in memory and persist
    const result = await this.handleUpdateFile(path, content);

    if (result.success) {
      // Notify SPA to sync with WebContainer
      await this.bridge?.sendToSPA({
        action: 'file-synced',
        payload: { path, content },
      });
    }
  }

  private async handleCreateFileFromSPA(path: string, content: string): Promise<void> {
    const result = await this.handleCreateFile(path, content);

    if (result.success && this.currentProject) {
      await this.bridge?.sendToSPA({
        action: 'file-created',
        payload: {
          path,
          fileTree: buildFileTree(this.currentProject.files),
        },
      });
    } else {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: result.error || 'Failed to create file', type: 'error' },
      });
    }
  }

  private async handleDeleteFileFromSPA(path: string): Promise<void> {
    const result = await this.handleDeleteFile(path);

    if (result.success && this.currentProject) {
      await this.bridge?.sendToSPA({
        action: 'file-deleted',
        payload: {
          path,
          fileTree: buildFileTree(this.currentProject.files),
          selectedFile: this.selectedFile,
        },
      });
    } else {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: result.error || 'Failed to delete file', type: 'error' },
      });
    }
  }
}
