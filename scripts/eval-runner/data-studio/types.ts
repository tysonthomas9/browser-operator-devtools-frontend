// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Shared types for Data Studio E2E testing infrastructure.
 */

// =============================================================================
// Data Model Types (matches sources.ts)
// =============================================================================

export interface DataTable {
  tableId: string;
  tableName: string;
  entityType: string;
  entityNameLabel: string;
  entities: Entity[];
  agentGroups: AgentGroup[];
  results: Record<string, Record<string, CellResult>>;
  executionStatus: 'idle' | 'running' | 'paused';
  createdAt?: string;
  modifiedAt?: string;
}

export interface Entity {
  id: string;
  name: string;
  context?: string;
}

export type LLMProviderType = 'openai' | 'cerebras' | 'anthropic' | 'groq';

export interface InlineAgentConfig {
  name: string;           // Internal name (e.g., "company_summary_agent")
  displayName: string;    // Display name in UI
  description: string;    // What the agent does
  systemPrompt: string;   // Custom system prompt
  tools: string[];        // List of tool names (e.g., ["navigate_url", "extract_data"])
  maxIterations?: number; // Default: 10
  temperature?: number;   // Default: 0.7
  provider?: LLMProviderType;  // LLM provider (default: server default)
  model?: string;              // LLM model (default: server default)
}

export interface AgentGroup {
  id: string;
  agentName?: string;              // Optional - for referenced agents
  inlineAgent?: InlineAgentConfig; // Optional - for inline agents
  queryTemplate: string;
  outputColumns: OutputColumn[];
}

export interface OutputColumn {
  id: string;
  key: string;
  label: string;
}

export interface CellResult {
  status: 'pending' | 'running' | 'completed' | 'error';
  values?: Record<string, string>;
  error?: string;
  timestamp?: string;
  executionTimeMs?: number;
}

// =============================================================================
// WebSocket Message Types
// =============================================================================

export interface WSMessage {
  type: string;
  payload?: unknown;
}

export interface WSActionMessage {
  type: 'action';
  payload: DataStudioAction;
}

export interface WSStateUpdateMessage {
  type: 'state-update';
  payload: {
    type: 'init' | 'set-state' | 'saved';
    view?: 'selector' | 'table';
    currentTable?: DataTable | null;
    savedTables?: Array<{ id: string; name: string; entityType: string }>;
  };
}

export interface WSCellUpdateMessage {
  type: 'cell-update';
  payload: {
    entityId: string;
    agentGroupId: string;
    result: CellResult;
  };
}

// =============================================================================
// Action Types
// =============================================================================

export type DataStudioAction =
  | CreateTableAction
  | AddEntityAction
  | RemoveEntityAction
  | AddAgentGroupAction
  | RemoveAgentGroupAction
  | RunAgentGroupAction
  | RunRowAction
  | RunAllAction
  | PauseExecutionAction
  | SaveTableAction
  | LoadTableAction
  | DeleteTableAction
  | UseTemplateAction
  | GetStateAction
  | GoBackAction
  | ReadyAction;

export interface CreateTableAction {
  action: 'create-table';
  tableName: string;
  entityType: string;
  entityNameLabel: string;
}

export interface AddEntityAction {
  action: 'add-entity';
  name: string;
  context?: string;
}

export interface RemoveEntityAction {
  action: 'remove-entity';
  entityId: string;
}

export interface AddAgentGroupAction {
  action: 'add-agent-group';
  agentName?: string;              // Optional - for referenced agents
  inlineAgent?: InlineAgentConfig; // Optional - for inline agents
  queryTemplate: string;
  outputColumns?: OutputColumn[];
}

export interface RemoveAgentGroupAction {
  action: 'remove-agent-group';
  agentGroupId: string;
}

export interface RunAgentGroupAction {
  action: 'run-agent-group';
  entityId: string;
  agentGroupId: string;
}

export interface RunRowAction {
  action: 'run-row';
  entityId: string;
}

export interface RunAllAction {
  action: 'run-all';
}

export interface PauseExecutionAction {
  action: 'pause-execution';
}

export interface SaveTableAction {
  action: 'save-table';
}

export interface LoadTableAction {
  action: 'load-table';
  tableId: string;
}

export interface DeleteTableAction {
  action: 'delete-table';
  tableId: string;
}

export interface UseTemplateAction {
  action: 'use-template';
  templateId: string;
  tableName: string;
}

export interface GetStateAction {
  action: 'get-state';
}

export interface GoBackAction {
  action: 'go-back';
}

export interface ReadyAction {
  action: 'ready';
}

// =============================================================================
// Test Configuration Types
// =============================================================================

export interface DataStudioTestConfig {
  httpPort: number;
  wsPort: number;
  headless: boolean;
  llmProvider: 'openai' | 'cerebras' | 'anthropic' | 'groq';
  llmModel: string;
  timeout: number;
}

export const DEFAULT_TEST_CONFIG: DataStudioTestConfig = {
  httpPort: 3456,
  wsPort: 3457,
  headless: false,
  llmProvider: 'cerebras',
  llmModel: 'llama-3.3-70b',
  timeout: 180000, // 3 minutes
};
