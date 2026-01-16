// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Data Studio Test Server
 *
 * WebSocket server that uses DataStudioCore for business logic.
 * Provides WebSocket-based context for communication, in-memory storage,
 * and agent execution via AgentBridge.
 */

// IMPORTANT: Must be first import to shim browser globals before DevTools imports
import '../lib/BrowserGlobals.js';

import {WebSocketServer, WebSocket} from 'ws';
import type {
  DataStudioAction,
  WSMessage,
  DataStudioTestConfig,
  DEFAULT_TEST_CONFIG,
} from './types.js';
import {
  DataStudioCore,
  type DataStudioContext,
  type DataTable,
  type TableIndexEntry,
  type CellResult,
  type StateUpdateMessage,
  type CellUpdateMessage,
  type LLMContext,
  type InlineAgentConfig,
  type AvailableAgent,
  type Template,
  DEFAULT_TEMPLATES,
} from '../../../front_end/panels/ai_chat/sandbox_apps/execution/DataStudioCore.js';
import {getDataStudioFiles} from '../../../front_end/panels/ai_chat/sandbox_apps/apps/data-studio/sources.js';
import {AgentBridge} from '../AgentBridge.js';
import {BrowserExecutor, type ExecutionContext, type BrowserConfig} from '../BrowserExecutor.js';
import type {CLIOptions} from '../types.js';

export interface DataStudioTestServerOptions {
  wsPort?: number;
  headless?: boolean;
  llmProvider?: 'openai' | 'cerebras' | 'anthropic' | 'groq';
  llmModel?: string;
  apiKey?: string;
}

/**
 * WebSocket context implementation for DataStudioCore
 */
class WebSocketContext implements DataStudioContext {
  private tables: Map<string, DataTable> = new Map();

  constructor(
    private readonly clients: Set<WebSocket>,
    private readonly agentBridge: AgentBridge | null,
    private readonly executionContext: ExecutionContext | null,
    private readonly options: DataStudioTestServerOptions,
  ) {}

  // Storage operations (in-memory)
  async getTable(tableId: string): Promise<DataTable | null> {
    return this.tables.get(tableId) || null;
  }

  async saveTable(table: DataTable): Promise<void> {
    this.tables.set(table.tableId, {...table, modifiedAt: new Date().toISOString()});
  }

  async listTables(): Promise<TableIndexEntry[]> {
    return Array.from(this.tables.values()).map(t => ({
      id: t.tableId,
      name: t.tableName,
      entityType: t.entityType,
    }));
  }

  async deleteTable(tableId: string): Promise<void> {
    this.tables.delete(tableId);
  }

  // Communication (WebSocket)
  sendStateUpdate(message: StateUpdateMessage): void {
    this.broadcast(message);
  }

  sendCellUpdate(message: CellUpdateMessage): void {
    this.broadcast(message);
  }

  private broadcast(msg: unknown): void {
    const data = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  // Agent execution
  async executeAgent(
    agentName: string,
    query: string,
    entityName: string,
    llmContext: LLMContext,
  ): Promise<{success: boolean; output?: unknown; error?: string}> {
    if (!this.agentBridge || !this.executionContext) {
      return {success: false, error: 'Agent bridge or execution context not initialized'};
    }

    // Navigate to blank page for agent execution
    await this.executionContext.page.goto('about:blank');

    return this.agentBridge.execute(
      {
        id: `ds-${Date.now()}`,
        name: `Data Studio: ${entityName}`,
        description: query,
        url: 'about:blank',
        tool: agentName,
        input: {
          query: query,
          objective: query,
          reasoning: `Data Studio research for ${entityName}`,
          scope: 'focused',
        },
        validation: {
          type: 'llm-judge',
          llmJudge: {criteria: ['Task was attempted']},
        },
        metadata: {
          tags: ['data-studio'],
          timeout: 120000,
        },
      },
      this.executionContext,
      undefined,
    );
  }

  // LLM configuration
  getLLMContext(inlineConfig?: InlineAgentConfig): LLMContext {
    const provider = inlineConfig?.provider || this.options.llmProvider || 'openai';
    const model = inlineConfig?.model || this.options.llmModel || 'gpt-4o-mini';

    return {
      apiKey: this.getApiKeyForProvider(provider),
      provider: provider as any,
      model,
      miniModel: model,
      nanoModel: model,
    };
  }

  getApiKeyForProvider(provider: string): string {
    if (this.options.apiKey) return this.options.apiKey;
    switch (provider) {
      case 'cerebras':
        return process.env.CEREBRAS_API_KEY || '';
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY || '';
      case 'groq':
        return process.env.GROQ_API_KEY || '';
      case 'openai':
      default:
        return process.env.OPENAI_API_KEY || '';
    }
  }

  // Available agents (hardcoded for test server)
  async getAvailableAgents(): Promise<AvailableAgent[]> {
    return [
      {name: 'research_agent', description: 'Research and analyze information'},
      {name: 'action_agent', description: 'Perform actions on web pages'},
      {name: 'web_task_agent', description: 'Complete multi-step web tasks'},
    ];
  }

  // Templates
  getTemplates(): Template[] {
    return DEFAULT_TEMPLATES;
  }

  // Browser navigation
  async navigateToBlank(): Promise<void> {
    if (this.executionContext) {
      await this.executionContext.page.goto('about:blank');
    }
  }

  // Logging
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown): void {
    const prefix = `[DataStudio]`;
    switch (level) {
      case 'error':
        console.error(prefix, message, data !== undefined ? data : '');
        break;
      case 'warn':
        console.warn(prefix, message, data !== undefined ? data : '');
        break;
      case 'debug':
        // Only log debug in verbose mode
        if (process.env.DEBUG) {
          console.log(prefix, '[DEBUG]', message, data !== undefined ? data : '');
        }
        break;
      case 'info':
      default:
        console.log(prefix, message, data !== undefined ? data : '');
    }
  }

  // Test helpers
  getTableDirect(tableId: string): DataTable | undefined {
    return this.tables.get(tableId);
  }

  getAllTablesDirect(): DataTable[] {
    return Array.from(this.tables.values());
  }
}

/**
 * Data Studio Test Server
 *
 * WebSocket server for testing Data Studio with real agent execution.
 */
export class DataStudioTestServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private agentBridge: AgentBridge | null = null;
  private browserExecutor: BrowserExecutor | null = null;
  private executionContext: ExecutionContext | null = null;
  private options: DataStudioTestServerOptions;
  private wsPort: number;

  private core: DataStudioCore | null = null;
  private context: WebSocketContext | null = null;

  constructor(options: DataStudioTestServerOptions = {}) {
    this.options = options;
    this.wsPort = options.wsPort ?? 3457;
  }

  async start(): Promise<void> {
    console.log('[DataStudioTestServer] Starting...');

    // Initialize browser executor for agent execution
    console.log('[DataStudioTestServer] Launching browser...');
    this.browserExecutor = new BrowserExecutor({
      headless: this.options.headless ?? true,
      timeout: 120000,
      screenshotDir: '/tmp/data-studio-test-screenshots',
    } as BrowserConfig);
    await this.browserExecutor.launch();

    // Create execution context for agents
    this.executionContext = await this.browserExecutor.createContext();

    // Initialize agent bridge
    console.log('[DataStudioTestServer] Initializing agent bridge...');
    const provider = this.options.llmProvider ?? 'openai';
    const getApiKey = (): string => {
      if (this.options.apiKey) return this.options.apiKey;
      switch (provider) {
        case 'cerebras':
          return process.env.CEREBRAS_API_KEY || '';
        case 'anthropic':
          return process.env.ANTHROPIC_API_KEY || '';
        case 'groq':
          return process.env.GROQ_API_KEY || '';
        case 'openai':
        default:
          return process.env.OPENAI_API_KEY || '';
      }
    };
    const cliOptions: CLIOptions = {
      provider,
      model: this.options.llmModel ?? (provider === 'openai' ? 'gpt-4o-mini' : 'llama-3.3-70b'),
      apiKey: getApiKey(),
      parallel: false,
      concurrency: 1,
      timeout: 120000,
      retries: 0,
      judgeProvider: 'openai',
      judgeModel: 'gpt-4o',
    };
    this.agentBridge = new AgentBridge(cliOptions);
    await this.agentBridge.init();

    // Create context and core
    this.context = new WebSocketContext(
      this.clients,
      this.agentBridge,
      this.executionContext,
      this.options,
    );
    this.core = new DataStudioCore(this.context);

    // Start WebSocket server
    console.log(`[DataStudioTestServer] Starting WebSocket server on port ${this.wsPort}...`);
    this.wss = new WebSocketServer({port: this.wsPort});

    this.wss.on('connection', ws => {
      console.log('[WS] Client connected');
      this.clients.add(ws);

      ws.on('message', async data => {
        try {
          const msg = JSON.parse(data.toString()) as WSMessage;
          await this.handleMessage(ws, msg);
        } catch (error) {
          console.error('[WS] Failed to parse message:', error);
          ws.send(JSON.stringify({type: 'error', payload: {message: String(error)}}));
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('[WS] Client disconnected');
      });

      ws.on('error', error => {
        console.error('[WS] Connection error:', error);
      });
    });

    console.log(`[DataStudioTestServer] Ready on ws://localhost:${this.wsPort}`);
  }

  private async handleMessage(ws: WebSocket, msg: WSMessage): Promise<void> {
    console.log('[WS] Received:', msg.type);

    if (msg.type === 'init') {
      // Send VFS files for in-browser bundling
      const vfsFiles = getDataStudioFiles();
      console.log('[VFS] Sending files:', Object.keys(vfsFiles).length, 'files');
      console.log('[VFS] File paths:', Object.keys(vfsFiles).join(', '));
      this.sendToClient(ws, {
        type: 'sync-files',
        payload: {
          files: vfsFiles,
          entry: '/src/index.tsx',
          incremental: false,
        },
      });
      // Wait for bundler-ready before sending build-request
      return;
    }

    if (msg.type === 'bundler-ready') {
      // Bundler is ready, trigger build
      console.log('[VFS] Bundler ready, triggering build');
      const buildId = `build-${Date.now()}`;
      this.sendToClient(ws, {
        type: 'build-request',
        payload: {buildId},
      });
      return;
    }

    if (msg.type === 'build-result') {
      // Client finished building, send execute-code to render the app
      const {success, js, css, errors} = msg.payload as {
        success: boolean;
        js: string;
        css: string;
        errors?: string[];
      };

      if (success && js) {
        console.log('[VFS] Build succeeded, executing code');
        this.sendToClient(ws, {
          type: 'execute-code',
          payload: {js, css: css || ''},
        });
      } else {
        console.error('[VFS] Build failed:', errors);
      }
      return;
    }

    if (msg.type === 'action' && msg.payload) {
      await this.handleAction(msg.payload as DataStudioAction);
    }
  }

  private sendToClient(ws: WebSocket, message: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private async handleAction(action: DataStudioAction): Promise<void> {
    if (!this.core) return;

    console.log('[Action]', action.action);

    switch (action.action) {
      case 'create-table':
        await this.core.createTable({
          tableName: action.tableName,
          entityType: action.entityType,
          entityNameLabel: action.entityNameLabel,
        });
        break;

      case 'add-entity':
        await this.core.addEntity({name: action.name, context: action.context});
        break;

      case 'remove-entity':
        await this.core.removeEntity(action.entityId);
        break;

      case 'add-agent-group':
        await this.core.addAgentGroup({
          agentName: action.agentName,
          inlineAgent: action.inlineAgent,
          queryTemplate: action.queryTemplate,
          outputColumns: action.outputColumns,
        });
        break;

      case 'remove-agent-group':
        await this.core.removeAgentGroup(action.agentGroupId);
        break;

      case 'run-agent-group':
        await this.core.runAgentGroup(action.entityId, action.agentGroupId);
        break;

      case 'run-row':
        await this.core.runRow(action.entityId);
        break;

      case 'run-all':
        await this.core.runAll();
        break;

      case 'pause-execution':
        this.core.pauseExecution();
        break;

      case 'save-table':
        await this.core.saveTable();
        break;

      case 'load-table':
        await this.core.loadTable(action.tableId);
        break;

      case 'delete-table':
        await this.core.deleteTable(action.tableId);
        break;

      case 'use-template':
        await this.core.useTemplate({templateId: action.templateId, tableName: action.tableName});
        break;

      case 'go-back':
        this.core.goBack();
        break;

      case 'get-state':
      case 'ready':
        await this.core.broadcastState();
        break;

      default:
        console.log('[Action] Unknown:', (action as any).action);
    }
  }

  // Test helpers
  getTableState(tableId?: string): DataTable | undefined {
    const currentTable = this.core?.getCurrentTable();
    if (tableId) {
      return this.context?.getTableDirect(tableId);
    }
    return currentTable || undefined;
  }

  getAllTables(): DataTable[] {
    return this.context?.getAllTablesDirect() || [];
  }

  getCurrentTableId(): string | null {
    return this.core?.getCurrentTable()?.tableId || null;
  }

  async stop(): Promise<void> {
    console.log('[DataStudioTestServer] Stopping...');

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    // Close browser
    if (this.executionContext) {
      await this.browserExecutor?.closeContext(this.executionContext);
      this.executionContext = null;
    }
    if (this.browserExecutor) {
      await this.browserExecutor.close();
      this.browserExecutor = null;
    }

    console.log('[DataStudioTestServer] Stopped');
  }
}
