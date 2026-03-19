// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import { ToolRegistry } from '../agent_framework/ConfigurableAgentTool.js';
import { MiniAppRegistry } from './MiniAppRegistry.js';
import { MiniAppPageMonitor } from './MiniAppPageMonitor.js';
import { ToolStudioIntegration } from '../core/ToolStudioIntegration.js';

// Import mini apps
import { AgentStudioMiniApp } from './apps/agent_studio/AgentStudioMiniApp.js';
import { DataStudioMiniApp } from './apps/data_studio/DataStudioMiniApp.js';
import { FileManagerMiniApp } from './apps/file_manager/FileManagerMiniApp.js';
import { QAAgentMiniApp } from './apps/qa_agent/QAAgentMiniApp.js';
import { AppBuilderMiniApp } from './apps/app_builder/AppBuilderMiniApp.js';
import { SkillStudioMiniApp } from './apps/skill_studio/SkillStudioMiniApp.js';

// Import mini app tools
import { ListMiniAppsTool } from '../tools/mini_app/ListMiniAppsTool.js';
import { LaunchMiniAppTool } from '../tools/mini_app/LaunchMiniAppTool.js';
import { GetMiniAppStateTool } from '../tools/mini_app/GetMiniAppStateTool.js';
import { UpdateMiniAppStateTool } from '../tools/mini_app/UpdateMiniAppStateTool.js';
import { ExecuteMiniAppActionTool } from '../tools/mini_app/ExecuteMiniAppActionTool.js';
import { CloseMiniAppTool } from '../tools/mini_app/CloseMiniAppTool.js';

const logger = createLogger('MiniAppInitialization');

let initialized = false;

/**
 * Initialize the mini app system
 *
 * This registers all mini apps and their associated tools.
 * Should be called once during application startup.
 */
export function initializeMiniApps(): void {
  if (initialized) {
    logger.warn('Mini app system already initialized');
    return;
  }

  logger.info('Initializing mini app system...');

  // Clear any stale instances from previous session (e.g., after DevTools refresh)
  MiniAppRegistry.reset();

  // Register mini apps
  registerMiniApps();

  // Register mini app tools
  registerMiniAppTools();

  // Initialize custom tools from Tool Studio (async, non-blocking)
  ToolStudioIntegration.initialize().catch(error => {
    logger.error('Failed to initialize Tool Studio custom tools:', error);
  });

  // Initialize page refresh monitor (handles URL hash restoration)
  MiniAppPageMonitor.getInstance().initialize();

  initialized = true;
  logger.info('Mini app system initialized successfully');
}

/**
 * Register all mini apps
 */
function registerMiniApps(): void {
  // Register Agent Studio as a mini app
  MiniAppRegistry.register(new AgentStudioMiniApp());

  // Register Data Studio mini app
  MiniAppRegistry.register(new DataStudioMiniApp());

  // Register File Manager mini app
  MiniAppRegistry.register(new FileManagerMiniApp());

  // Register QA Agent mini app
  MiniAppRegistry.register(new QAAgentMiniApp());

  // Register App Builder mini app
  MiniAppRegistry.register(new AppBuilderMiniApp());

  // Register Skill Studio mini app
  MiniAppRegistry.register(new SkillStudioMiniApp());

  logger.info(`Registered ${MiniAppRegistry.getAllApps().length} mini apps`);
}

/**
 * Register mini app tools in the ToolRegistry
 *
 * These tools allow AI agents to interact with mini apps.
 */
function registerMiniAppTools(): void {
  ToolRegistry.registerToolFactory('list_mini_apps', () => new ListMiniAppsTool());
  ToolRegistry.registerToolFactory('launch_mini_app', () => new LaunchMiniAppTool());
  ToolRegistry.registerToolFactory('get_mini_app_state', () => new GetMiniAppStateTool());
  ToolRegistry.registerToolFactory('update_mini_app_state', () => new UpdateMiniAppStateTool());
  ToolRegistry.registerToolFactory('execute_mini_app_action', () => new ExecuteMiniAppActionTool());
  ToolRegistry.registerToolFactory('close_mini_app', () => new CloseMiniAppTool());

  logger.info('Registered 6 mini app tools');
}

/**
 * Check if mini app system is initialized
 */
export function isMiniAppSystemInitialized(): boolean {
  return initialized;
}

/**
 * Reset the mini app system (for testing)
 */
export function resetMiniAppSystem(): void {
  if (!initialized) {
    return;
  }

  // Close all running mini apps
  MiniAppRegistry.closeAll().catch(error => {
    logger.error('Error closing mini apps during reset:', error);
  });

  initialized = false;
  logger.info('Mini app system reset');
}
