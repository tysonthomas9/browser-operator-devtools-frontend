// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../../../core/Logger.js';
import { SkillStorageManager } from '../../../skills/SkillStorageManager.js';
import { SkillExecutor } from '../../../skills/SkillExecutor.js';
import type { LearnedSkill, SkillTestRecord, SkillSchema } from '../../../skills/types/SkillTypes.js';
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
import { MiniAppEventBus } from '../../MiniAppEventBus.js';
import { SkillStudioSPA } from '../../../ui/skill_studio/SkillStudioSPA.js';

const logger = createLogger('SkillStudioMiniApp');

/**
 * Skill info for the SPA
 */
interface SkillInfo {
  id: string;
  name: string;
  description: string;
  domain: string;
  version: number;
  tags: string[];
  source: string;
  schema: object;
  verification: {
    status: string;
    testCount: number;
    successCount: number;
    consecutiveFailures: number;
    requiredSuccesses: number;
    lastTestedAt?: string;
    lastError?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Test record info for the SPA
 */
interface TestRecordInfo {
  id: string;
  skillId: string;
  args: Record<string, unknown>;
  result: {
    success: boolean;
    output?: unknown;
    error?: string;
    executionTimeMs: number;
  };
  pageUrl: string;
  timestamp: string;
}

/**
 * Form data for saving skills
 */
interface SkillFormData {
  name: string;
  description: string;
  domain: string;
  source: string;
  tags: string[];
  schema: object;
}

/**
 * SkillStudioMiniApp - Manage learned automation skills
 *
 * Features:
 * - View all skills (verified, unverified, failing)
 * - Create, edit, and delete skills
 * - Test skills with custom arguments
 * - View test history
 * - Import/export skills
 */
export class SkillStudioMiniApp implements MiniApp {
  id = 'skill_studio';
  name = 'Skill Studio';
  description = 'Create, manage, and test automation skills that can be reused across websites. View verification status and test history.';
  icon = '🧠';

  // Route definitions for URL-based navigation
  routes = [
    { name: 'list', pattern: '#skill-studio' },
    { name: 'skill', pattern: '#skill-studio/skill/:id' },
    { name: 'new', pattern: '#skill-studio/new' },
    { name: 'test', pattern: '#skill-studio/test/:id' },
    { name: 'history', pattern: '#skill-studio/history/:id' },
  ];

  getSPA(): MiniAppSPA {
    return {
      html: SkillStudioSPA.html,
      css: SkillStudioSPA.css,
      js: SkillStudioSPA.js,
    };
  }

  getSupportedActions(): MiniAppActionSchema[] {
    return [
      {
        name: 'select-skill',
        description: 'Select a skill by ID to view or edit',
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The skill ID to select' },
          },
          required: ['id'],
        },
      },
      {
        name: 'create-skill',
        description: 'Start creating a new skill',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'save-skill',
        description: 'Save the current skill configuration',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name (snake_case)' },
            description: { type: 'string', description: 'Skill description' },
            domain: { type: 'string', description: 'Domain scope (e.g., amazon.com)' },
            source: { type: 'string', description: 'JavaScript source code' },
            tags: { type: 'array', description: 'Tags for categorization' },
            schema: { type: 'object', description: 'JSON Schema for parameters' },
          },
          required: ['name', 'description', 'domain', 'source'],
        },
      },
      {
        name: 'delete-skill',
        description: 'Delete the currently selected skill',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'test-skill',
        description: 'Test a skill with specific arguments',
        schema: {
          type: 'object',
          properties: {
            skill_id: { type: 'string', description: 'The skill ID to test' },
            args: { type: 'object', description: 'Arguments to pass to the skill' },
          },
          required: ['skill_id', 'args'],
        },
      },
      {
        name: 'list-skills',
        description: 'Get a list of all skills',
        schema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Optional domain filter' },
            status: { type: 'string', description: 'Optional status filter (verified, unverified, failing)' },
          },
        },
      },
      {
        name: 'get-test-history',
        description: 'Get test history for a skill',
        schema: {
          type: 'object',
          properties: {
            skill_id: { type: 'string', description: 'The skill ID to get history for' },
          },
          required: ['skill_id'],
        },
      },
      {
        name: 'export-skills',
        description: 'Export all skills as JSON',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'import-skills',
        description: 'Import skills from JSON',
        schema: {
          type: 'object',
          properties: {
            skills: { type: 'array', description: 'Array of skill objects to import' },
            mode: { type: 'string', description: 'Import mode: skip or replace' },
          },
          required: ['skills'],
        },
      },
    ];
  }

  getStateSchema(): MiniAppStateSchema {
    return {
      type: 'object',
      properties: {
        skills: {
          type: 'array',
          description: 'List of all skills',
        },
        selectedSkill: {
          type: 'object',
          description: 'Currently selected skill or null',
        },
        isCreatingNew: {
          type: 'boolean',
          description: 'Whether a new skill is being created',
        },
        testHistory: {
          type: 'array',
          description: 'Test history for the selected skill',
        },
        domainFilter: {
          type: 'string',
          description: 'Current domain filter',
        },
        statusFilter: {
          type: 'string',
          description: 'Current status filter',
        },
      },
    };
  }

  createController(): MiniAppController {
    return new SkillStudioMiniAppController();
  }
}

/**
 * Controller for Skill Studio mini app
 */
class SkillStudioMiniAppController implements MiniAppController {
  private bridge: MiniAppBridge | null = null;
  private closeCallback: (() => void | Promise<void>) | null = null;

  // State
  private selectedSkillId: string | null = null;
  private isCreatingNew = false;
  private domainFilter = '';
  private statusFilter = '';

  async initialize(bridge: MiniAppBridge): Promise<void> {
    this.bridge = bridge;
    bridge.onAction(this.handleAction.bind(this));
    logger.info('SkillStudioMiniAppController initialized');
  }

  async cleanup(): Promise<void> {
    this.bridge = null;
    this.selectedSkillId = null;
    this.isCreatingNew = false;
    this.domainFilter = '';
    this.statusFilter = '';
    logger.info('SkillStudioMiniAppController cleaned up');
  }

  onClose(callback: () => void | Promise<void>): void {
    this.closeCallback = callback;
  }

  async getState(): Promise<MiniAppState> {
    const skills = await this.loadSkills();
    let selectedSkill: SkillInfo | null = null;
    let testHistory: TestRecordInfo[] = [];

    if (this.selectedSkillId) {
      const manager = SkillStorageManager.getInstance();
      const skill = await manager.getSkill(this.selectedSkillId);
      if (skill) {
        selectedSkill = this.toSkillInfo(skill);
        const records = await manager.getTestRecords(this.selectedSkillId);
        testHistory = records.map(r => this.toTestRecordInfo(r));
      }
    }

    return {
      skills,
      selectedSkill,
      isCreatingNew: this.isCreatingNew,
      testHistory,
      domainFilter: this.domainFilter,
      statusFilter: this.statusFilter,
    };
  }

  async setState(state: MiniAppState): Promise<void> {
    if (state.selectedSkillId) {
      this.selectedSkillId = state.selectedSkillId as string;
    }
    if (state.isCreatingNew !== undefined) {
      this.isCreatingNew = state.isCreatingNew as boolean;
    }
    if (state.domainFilter !== undefined) {
      this.domainFilter = state.domainFilter as string;
    }
    if (state.statusFilter !== undefined) {
      this.statusFilter = state.statusFilter as string;
    }
  }

  async updateState(updates: Partial<MiniAppState>): Promise<void> {
    await this.setState(updates);
  }

  async executeAction(actionName: string, args: unknown): Promise<unknown> {
    const argsObj = args as Record<string, unknown>;

    switch (actionName) {
      case 'select-skill':
        return this.handleSelectSkillAction(argsObj.id as string);

      case 'create-skill':
        return this.handleNewSkillAction();

      case 'save-skill':
        return this.handleSaveSkillAction(argsObj as unknown as SkillFormData);

      case 'delete-skill':
        return this.handleDeleteSkillAction();

      case 'test-skill':
        return this.handleTestSkillAction(argsObj.skill_id as string, argsObj.args as Record<string, unknown>);

      case 'list-skills':
        return this.handleListSkillsAction(argsObj.domain as string | undefined, argsObj.status as string | undefined);

      case 'get-test-history':
        return this.handleGetTestHistoryAction(argsObj.skill_id as string);

      case 'export-skills':
        return this.handleExportSkillsAction();

      case 'import-skills':
        return this.handleImportSkillsAction(argsObj.skills as LearnedSkill[], argsObj.mode as 'skip' | 'replace');

      default:
        throw new Error(`Unknown action: ${actionName}`);
    }
  }

  // ============================================================================
  // SPA Action Handlers
  // ============================================================================

  async handleAction(action: SPAToDevToolsAction): Promise<void> {
    logger.info('Handling SPA action:', action.type);

    switch (action.type) {
      case 'ready':
        await this.pushInitialState();
        break;

      case 'select-skill': {
        const actionData = action as SPAToDevToolsAction & { id: string };
        await this.handleSelectSkill(actionData.id);
        break;
      }

      case 'new-skill':
        await this.handleNewSkill();
        break;

      case 'save-skill': {
        const actionData = action as SPAToDevToolsAction & { data: SkillFormData };
        await this.handleSaveSkill(actionData.data);
        break;
      }

      case 'delete-skill':
        await this.handleDeleteSkill();
        break;

      case 'test-skill': {
        const actionData = action as SPAToDevToolsAction & { args: Record<string, unknown> };
        if (this.selectedSkillId) {
          await this.handleTestSkill(this.selectedSkillId, actionData.args);
        }
        break;
      }

      case 'filter-change': {
        const actionData = action as SPAToDevToolsAction & { domain?: string; status?: string };
        this.domainFilter = actionData.domain || '';
        this.statusFilter = actionData.status || '';
        await this.pushSkillsList();
        break;
      }

      case 'export-skills':
        await this.handleExportSkills();
        break;

      case 'import-skills': {
        const actionData = action as SPAToDevToolsAction & { skills: LearnedSkill[]; mode?: 'skip' | 'replace' };
        await this.handleImportSkills(actionData.skills, actionData.mode);
        break;
      }

      case 'close':
        if (this.closeCallback) {
          await this.closeCallback();
        }
        break;

      case 'state-changed':
        MiniAppEventBus.getInstance().emitStateChanged('skill_studio', action.payload);
        break;

      default:
        logger.warn('Unknown SPA action type:', action.type);
    }
  }

  // ============================================================================
  // Action Implementations
  // ============================================================================

  private async handleSelectSkillAction(id: string): Promise<{ success: boolean; skill?: SkillInfo }> {
    const manager = SkillStorageManager.getInstance();
    const skill = await manager.getSkill(id);

    if (!skill) {
      return { success: false };
    }

    this.selectedSkillId = id;
    this.isCreatingNew = false;

    await this.bridge?.sendToSPA({
      action: 'skill-selected',
      payload: { skill: this.toSkillInfo(skill) },
    });

    return { success: true, skill: this.toSkillInfo(skill) };
  }

  private async handleNewSkillAction(): Promise<{ success: boolean }> {
    this.isCreatingNew = true;
    this.selectedSkillId = null;

    await this.bridge?.sendToSPA({
      action: 'skill-selected',
      payload: { skill: this.createEmptySkill() },
    });

    return { success: true };
  }

  private async handleSaveSkillAction(data: SkillFormData): Promise<{ success: boolean; skill?: SkillInfo; error?: string }> {
    try {
      const manager = SkillStorageManager.getInstance();

      if (this.isCreatingNew) {
        const skill = await manager.createSkill({
          name: data.name,
          description: data.description,
          domain: data.domain,
          source: data.source,
          schema: data.schema as SkillSchema,
          tags: data.tags || [],
        });

        this.selectedSkillId = skill.id;
        this.isCreatingNew = false;

        return { success: true, skill: this.toSkillInfo(skill) };
      } else if (this.selectedSkillId) {
        const skill = await manager.updateSkill(this.selectedSkillId, {
          name: data.name,
          description: data.description,
          source: data.source,
          schema: data.schema as SkillSchema,
          tags: data.tags || [],
        });

        return { success: true, skill: this.toSkillInfo(skill) };
      } else {
        return { success: false, error: 'No skill selected to update' };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleDeleteSkillAction(): Promise<{ success: boolean; error?: string }> {
    if (!this.selectedSkillId) {
      return { success: false, error: 'No skill selected' };
    }

    try {
      const manager = SkillStorageManager.getInstance();
      await manager.deleteSkill(this.selectedSkillId);

      this.selectedSkillId = null;

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleTestSkillAction(skillId: string, args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    try {
      const manager = SkillStorageManager.getInstance();
      const skill = await manager.getSkill(skillId);

      if (!skill) {
        return { success: false, error: `Skill not found: ${skillId}` };
      }

      const executor = SkillExecutor.getInstance();
      const result = await executor.executeSkill(skill, args, { testMode: true });

      return { success: result.success, result: result.output, error: result.error };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  private async handleListSkillsAction(domain?: string, status?: string): Promise<{ skills: SkillInfo[] }> {
    const manager = SkillStorageManager.getInstance();
    let skills: LearnedSkill[];

    if (domain) {
      skills = await manager.getSkillsByDomain(domain);
    } else {
      skills = await manager.getAllSkills();
    }

    // Filter by status if provided
    if (status) {
      skills = skills.filter(s => s.verification.status === status);
    }

    return { skills: skills.map(s => this.toSkillInfo(s)) };
  }

  private async handleGetTestHistoryAction(skillId: string): Promise<{ history: TestRecordInfo[] }> {
    const manager = SkillStorageManager.getInstance();
    const records = await manager.getTestRecords(skillId);
    return { history: records.map(r => this.toTestRecordInfo(r)) };
  }

  private async handleExportSkillsAction(): Promise<{ skills: LearnedSkill[] }> {
    const manager = SkillStorageManager.getInstance();
    const skills = await manager.exportSkills();
    return { skills };
  }

  private async handleImportSkillsAction(skills: LearnedSkill[], mode: 'skip' | 'replace' = 'skip'): Promise<{ imported: number; skipped: string[] }> {
    const manager = SkillStorageManager.getInstance();
    return manager.importSkills(skills, mode);
  }

  // ============================================================================
  // SPA-Triggered Handlers
  // ============================================================================

  private async pushInitialState(): Promise<void> {
    const skills = await this.loadSkills();

    await this.bridge?.sendToSPA({
      action: 'init',
      payload: {
        skills,
        selectedSkill: null,
        isCreatingNew: false,
      },
    });

    logger.info('Initial state pushed to SPA');
  }

  private async pushSkillsList(): Promise<void> {
    const skills = await this.loadSkills();

    await this.bridge?.sendToSPA({
      action: 'skills-updated',
      payload: { skills },
    });
  }

  private async handleSelectSkill(id: string): Promise<void> {
    this.isCreatingNew = false;
    this.selectedSkillId = id;

    const manager = SkillStorageManager.getInstance();
    const skill = await manager.getSkill(id);

    if (skill) {
      const testHistory = await manager.getTestRecords(id);
      await this.bridge?.sendToSPA({
        action: 'skill-selected',
        payload: {
          skill: this.toSkillInfo(skill),
          testHistory: testHistory.map(r => this.toTestRecordInfo(r)),
        },
      });
    } else {
      logger.warn(`Skill not found: ${id}`);
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Skill not found', type: 'error' },
      });
      this.selectedSkillId = null;
    }
  }

  private async handleNewSkill(): Promise<void> {
    this.isCreatingNew = true;
    this.selectedSkillId = null;

    await this.bridge?.sendToSPA({
      action: 'skill-selected',
      payload: { skill: this.createEmptySkill(), isNew: true },
    });
  }

  private async handleSaveSkill(data: SkillFormData): Promise<void> {
    const result = await this.handleSaveSkillAction(data);

    if (result.success) {
      const skills = await this.loadSkills();
      await this.bridge?.sendToSPA({
        action: 'skills-updated',
        payload: { skills },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Skill saved successfully!', type: 'success' },
      });
    } else {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: result.error || 'Failed to save skill', type: 'error' },
      });
    }
  }

  private async handleDeleteSkill(): Promise<void> {
    const result = await this.handleDeleteSkillAction();

    if (result.success) {
      const skills = await this.loadSkills();
      await this.bridge?.sendToSPA({
        action: 'skills-updated',
        payload: { skills },
      });

      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: 'Skill deleted successfully!', type: 'success' },
      });
    } else {
      await this.bridge?.sendToSPA({
        action: 'notification',
        payload: { message: result.error || 'Failed to delete skill', type: 'error' },
      });
    }
  }

  private async handleTestSkill(skillId: string, args: Record<string, unknown>): Promise<void> {
    await this.bridge?.sendToSPA({
      action: 'test-started',
      payload: {},
    });

    const result = await this.handleTestSkillAction(skillId, args);

    // Reload skill to get updated verification status
    const manager = SkillStorageManager.getInstance();
    const skill = await manager.getSkill(skillId);
    const testHistory = await manager.getTestRecords(skillId);

    await this.bridge?.sendToSPA({
      action: 'test-result',
      payload: {
        success: result.success,
        result: result.result,
        error: result.error,
        skill: skill ? this.toSkillInfo(skill) : null,
        testHistory: testHistory.map(r => this.toTestRecordInfo(r)),
      },
    });
  }

  private async handleExportSkills(): Promise<void> {
    const result = await this.handleExportSkillsAction();

    await this.bridge?.sendToSPA({
      action: 'export-ready',
      payload: { skills: result.skills },
    });
  }

  private async handleImportSkills(skills: LearnedSkill[], mode?: 'skip' | 'replace'): Promise<void> {
    const result = await this.handleImportSkillsAction(skills, mode || 'skip');

    const updatedSkills = await this.loadSkills();
    await this.bridge?.sendToSPA({
      action: 'skills-updated',
      payload: { skills: updatedSkills },
    });

    await this.bridge?.sendToSPA({
      action: 'notification',
      payload: {
        message: `Imported ${result.imported} skills. ${result.skipped.length > 0 ? `Skipped: ${result.skipped.join(', ')}` : ''}`,
        type: result.imported > 0 ? 'success' : 'warning',
      },
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async loadSkills(): Promise<SkillInfo[]> {
    const manager = SkillStorageManager.getInstance();
    let skills: LearnedSkill[];

    if (this.domainFilter) {
      skills = await manager.getSkillsByDomain(this.domainFilter);
    } else {
      skills = await manager.getAllSkills();
    }

    if (this.statusFilter) {
      skills = skills.filter(s => s.verification.status === this.statusFilter);
    }

    return skills.map(s => this.toSkillInfo(s));
  }

  private toSkillInfo(skill: LearnedSkill): SkillInfo {
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      domain: skill.domain,
      version: skill.version,
      tags: skill.tags,
      source: skill.source,
      schema: skill.schema,
      verification: {
        status: skill.verification.status,
        testCount: skill.verification.testCount,
        successCount: skill.verification.successCount,
        consecutiveFailures: skill.verification.consecutiveFailures,
        requiredSuccesses: skill.verification.requiredSuccesses,
        lastTestedAt: skill.verification.lastTestedAt,
        lastError: skill.verification.lastError,
      },
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
    };
  }

  private toTestRecordInfo(record: SkillTestRecord): TestRecordInfo {
    return {
      id: record.id,
      skillId: record.skillId,
      args: record.args,
      result: {
        success: record.result.success,
        output: record.result.output,
        error: record.result.error,
        executionTimeMs: record.result.executionTimeMs,
      },
      pageUrl: record.pageUrl,
      timestamp: record.timestamp,
    };
  }

  private createEmptySkill(): SkillInfo {
    return {
      id: '',
      name: '',
      description: '',
      domain: '',
      version: 1,
      tags: [],
      source: `// Skill code here
// Available variables:
// - args: The input arguments (validated against schema)
// - helpers: DOM helper functions (waitForElement, click, type, etc.)
//
// Return a JSON-serializable value

const result = await helpers.getText('.some-selector');
return { success: true, data: result };`,
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      verification: {
        status: 'unverified',
        testCount: 0,
        successCount: 0,
        consecutiveFailures: 0,
        requiredSuccesses: 3,
      },
      createdAt: '',
      updatedAt: '',
    };
  }
}
