// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Test fixtures for Data Studio e2e tests
 */

// =============================================================================
// Inline Agent Config Fixtures
// =============================================================================

export interface TestInlineAgentConfig {
  name: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  maxIterations: number;
  temperature: number;
  modelName?: string;
  outputSchema?: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  ui?: {
    avatar?: string;
    color?: string;
    backgroundColor?: string;
  };
}

export const TEST_INLINE_AGENT: TestInlineAgentConfig = {
  name: 'test_inline_agent',
  displayName: 'Test Inline Agent',
  description: 'A test inline agent for e2e testing',
  systemPrompt: 'You are a test agent. For any query, respond with JSON: {"summary": "test result", "details": "This is a test response"}',
  tools: ['navigate_url', 'extract_data'],
  maxIterations: 3,
  temperature: 0.5,
};

export const TEST_INLINE_AGENT_MINIMAL: TestInlineAgentConfig = {
  name: 'minimal_agent',
  displayName: 'Minimal Agent',
  description: 'Minimal config for testing',
  systemPrompt: 'Return "ok" for any input.',
  tools: [],
  maxIterations: 1,
  temperature: 0,
};

export const TEST_INLINE_AGENT_INVALID_TOOLS: TestInlineAgentConfig = {
  name: 'invalid_tools_agent',
  displayName: 'Invalid Tools Agent',
  description: 'Agent with non-existent tools for error testing',
  systemPrompt: 'This agent has invalid tools.',
  tools: ['fake_nonexistent_tool', 'another_fake_tool'],
  maxIterations: 1,
  temperature: 0,
};

export const TEST_INLINE_AGENT_XSS: TestInlineAgentConfig = {
  name: 'xss_test_agent',
  displayName: '<script>alert("xss")</script>',
  description: '<img onerror="alert(1)" src="x">',
  systemPrompt: 'Test XSS prevention.',
  tools: [],
  maxIterations: 1,
  temperature: 0,
};

export const TEST_INLINE_AGENT_FULL: TestInlineAgentConfig = {
  name: 'full_config_agent',
  displayName: 'Full Config Agent',
  description: 'Agent with all optional fields',
  systemPrompt: 'You are a comprehensive test agent.',
  tools: ['navigate_url', 'extract_data', 'scroll_page'],
  maxIterations: 10,
  temperature: 0.7,
  modelName: 'gpt-4o-mini',
  outputSchema: {
    type: 'object',
    properties: {
      result: {type: 'string'},
      confidence: {type: 'number'},
    },
    required: ['result'],
  },
  ui: {
    avatar: '🔬',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
  },
};

// =============================================================================
// Output Column Fixtures
// =============================================================================

export interface TestOutputColumn {
  id: string;
  key: string;
  label: string;
}

export const TEST_OUTPUT_COLUMNS: TestOutputColumn[] = [
  {id: 'col-1', key: 'summary', label: 'Summary'},
  {id: 'col-2', key: 'details', label: 'Details'},
];

export const TEST_OUTPUT_COLUMNS_SINGLE: TestOutputColumn[] = [
  {id: 'col-1', key: 'result', label: 'Result'},
];

export const TEST_OUTPUT_COLUMNS_MULTIPLE: TestOutputColumn[] = [
  {id: 'col-1', key: 'name', label: 'Name'},
  {id: 'col-2', key: 'revenue', label: 'Revenue'},
  {id: 'col-3', key: 'employees', label: 'Employees'},
  {id: 'col-4', key: 'location', label: 'Location'},
];

// =============================================================================
// Entity Fixtures
// =============================================================================

export interface TestEntity {
  name: string;
  context?: string;
}

export const TEST_ENTITIES: TestEntity[] = [
  {name: 'Acme Corp', context: 'Tech company founded in 2010'},
  {name: 'Globex Inc', context: 'Manufacturing company'},
  {name: 'Initech', context: 'Software consulting firm'},
];

export const TEST_ENTITY_SINGLE: TestEntity = {
  name: 'Test Company',
  context: 'A test company for e2e testing',
};

export const TEST_ENTITY_XSS: TestEntity = {
  name: '<script>alert("entity")</script>',
  context: '<img src=x onerror=alert(1)>',
};

// =============================================================================
// Table Fixtures
// =============================================================================

export interface TestTableConfig {
  tableName: string;
  entityType: string;
  entityNameLabel: string;
}

export const TEST_TABLE_CONFIG: TestTableConfig = {
  tableName: 'Test Companies',
  entityType: 'Company',
  entityNameLabel: 'Company Name',
};

export const TEST_TABLE_CONFIG_COMPETITORS: TestTableConfig = {
  tableName: 'Competitor Analysis',
  entityType: 'Competitor',
  entityNameLabel: 'Competitor Name',
};

// =============================================================================
// Agent Group Fixtures
// =============================================================================

export interface TestAgentGroupConfig {
  agentName?: string;
  inlineAgent?: TestInlineAgentConfig;
  queryTemplate: string;
  outputColumns: TestOutputColumn[];
}

export const TEST_AGENT_GROUP_REFERENCED: TestAgentGroupConfig = {
  agentName: 'search_agent',
  queryTemplate: 'Research {entity} and provide a summary of their business.',
  outputColumns: TEST_OUTPUT_COLUMNS,
};

export const TEST_AGENT_GROUP_INLINE: TestAgentGroupConfig = {
  inlineAgent: TEST_INLINE_AGENT,
  queryTemplate: 'Analyze {entity} using the inline agent configuration.',
  outputColumns: TEST_OUTPUT_COLUMNS,
};

export const TEST_AGENT_GROUP_INVALID: TestAgentGroupConfig = {
  // Neither agentName nor inlineAgent - invalid state
  queryTemplate: 'This should fail.',
  outputColumns: TEST_OUTPUT_COLUMNS,
};

// =============================================================================
// Expected Results
// =============================================================================

export const EXPECTED_XSS_ESCAPED = {
  displayName: '&lt;script&gt;alert("xss")&lt;/script&gt;',
  description: '&lt;img onerror="alert(1)" src="x"&gt;',
};

export const EXPECTED_TOOL_VALIDATION_ERROR = /Invalid tools referenced/;

export const EXPECTED_STATE_VALIDATION_ERROR = /must have either agentName or inlineAgent/;

// =============================================================================
// Test IDs (for tracking)
// =============================================================================

export const TEST_IDS = {
  // Table Creation
  TC_101: 'TC-101: Create custom table',
  TC_102: 'TC-102: Create from template',
  TC_103: 'TC-103: Load saved table',
  TC_104: 'TC-104: Invalid table name',

  // Entity Management
  TC_201: 'TC-201: Add entity',
  TC_202: 'TC-202: Add entity with context',
  TC_203: 'TC-203: Remove entity',
  TC_204: 'TC-204: Add multiple entities',

  // Agent Group (Referenced)
  TC_301: 'TC-301: Add agent group',
  TC_302: 'TC-302: Configure output columns',
  TC_303: 'TC-303: Remove agent group',
  TC_304: 'TC-304: Invalid query template',

  // Inline Agent
  TC_401: 'TC-401: Add inline agent group',
  TC_402: 'TC-402: Edit inline agent',
  TC_403: 'TC-403: Convert to inline',
  TC_404: 'TC-404: Save to Agent Studio',
  TC_405: 'TC-405: Invalid tool validation',
  TC_406: 'TC-406: XSS prevention',

  // Execution
  TC_501: 'TC-501: Run single cell',
  TC_502: 'TC-502: Run single row',
  TC_503: 'TC-503: Run all',
  TC_504: 'TC-504: Pause execution',
  TC_505: 'TC-505: Run inline agent',
  TC_506: 'TC-506: Invalid agent state',

  // Results Display
  TC_601: 'TC-601: View completed cell',
  TC_602: 'TC-602: View error cell',
  TC_603: 'TC-603: Copy cell content',
  TC_604: 'TC-604: Long result truncation',

  // Persistence
  TC_701: 'TC-701: Save table',
  TC_702: 'TC-702: Load and verify',
  TC_703: 'TC-703: Delete table',
  TC_704: 'TC-704: Export table',
  TC_705: 'TC-705: Persist inline agents',

  // Navigation
  TC_801: 'TC-801: Back to selector',
  TC_802: 'TC-802: Browser back',
  TC_803: 'TC-803: Close and reopen',
};
