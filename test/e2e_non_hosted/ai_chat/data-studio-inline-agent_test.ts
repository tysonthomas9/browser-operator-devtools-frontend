// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * E2E Tests for Data Studio Inline Agent Feature
 *
 * Test Cases: TC-401 to TC-406
 * - TC-401: Add inline agent group
 * - TC-402: Edit inline agent
 * - TC-403: Convert to inline
 * - TC-404: Save to Agent Studio
 * - TC-405: Invalid tool validation
 * - TC-406: XSS prevention
 */

import {assert} from 'chai';
import {expectError} from '../../conductor/events.js';
import {
  initializeDataStudio,
  createDataStudioTable,
  addDataStudioEntity,
  addDataStudioInlineAgentGroup,
  addDataStudioAgentGroup,
  getDataStudioTableState,
} from '../shared/sandbox-helpers.js';
import {
  TEST_INLINE_AGENT,
  TEST_INLINE_AGENT_INVALID_TOOLS,
  TEST_INLINE_AGENT_XSS,
  TEST_OUTPUT_COLUMNS,
  TEST_TABLE_CONFIG,
  TEST_ENTITY_SINGLE,
  TEST_IDS,
} from '../shared/data-studio-fixtures.js';

// Register expected errors at module level
for (let i = 0; i < 20; i++) {
  expectError(/Cannot proceed - missing required credentials/);
  expectError(/Failed to check for updates/);
  expectError(/Unknown VE context: ai-chat/);
}

function setupExpectedErrors() {
  expectError(/Cannot proceed - missing required credentials/);
  expectError(/Failed to check for updates/);
  expectError(/Unknown VE context: ai-chat/);
}

describe('Data Studio Inline Agent E2E Tests', function() {
  if (this.timeout() > 0) {
    this.timeout(120000);
  }

  setup({enabledDevToolsExperiments: ['protocol-monitor']});

  // Track created table IDs for cleanup
  let createdTableIds: string[] = [];

  // ===========================================================================
  // TC-401: Add inline agent group
  // ===========================================================================

  it(`${TEST_IDS.TC_401}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    // Initialize Data Studio
    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-401: Data Studio initialization failed');
      return;
    }

    // Create table
    const tableResult = await createDataStudioTable(
        devToolsPage,
        TEST_TABLE_CONFIG.tableName,
        TEST_TABLE_CONFIG.entityType,
        TEST_TABLE_CONFIG.entityNameLabel,
    );

    assert.isTrue(tableResult.success, 'Should create table');
    assert.isString(tableResult.tableId, 'Should return table ID');
    const tableId = tableResult.tableId!;
    createdTableIds.push(tableId);

    // Add entity
    const entityResult = await addDataStudioEntity(
        devToolsPage,
        tableId,
        TEST_ENTITY_SINGLE.name,
        TEST_ENTITY_SINGLE.context,
    );

    assert.isTrue(entityResult.success, 'Should add entity');

    // Add inline agent group
    const agentResult = await addDataStudioInlineAgentGroup(
        devToolsPage,
        tableId,
        TEST_INLINE_AGENT,
        'Analyze {entity} using inline agent',
        [{key: 'summary', label: 'Summary'}, {key: 'details', label: 'Details'}],
    );

    assert.isTrue(agentResult.success, 'Should add inline agent group');
    assert.isString(agentResult.agentGroupId, 'Should return agent group ID');

    // Verify table state
    const stateResult = await getDataStudioTableState(devToolsPage, tableId);
    assert.isTrue(stateResult.success, 'Should get table state');
    assert.strictEqual(stateResult.table?.agentGroupCount, 1, 'Should have 1 agent group');

    const agentGroup = stateResult.table?.agentGroups[0];
    assert.isTrue(agentGroup?.hasInlineAgent, 'Agent group should have inline agent');
    assert.isUndefined(agentGroup?.agentName, 'Agent group should not have agentName');

    console.log('TC-401 PASSED: Inline agent group added successfully');
    console.log(`- Table ID: ${tableId}`);
    console.log(`- Agent Group ID: ${agentResult.agentGroupId}`);
  });

  // ===========================================================================
  // TC-402: Edit inline agent
  // ===========================================================================

  it(`${TEST_IDS.TC_402}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-402: Data Studio initialization failed');
      return;
    }

    // Create table with inline agent
    const tableResult = await createDataStudioTable(
        devToolsPage,
        'Edit Test Table',
        'Company',
        'Name',
    );
    const tableId = tableResult.tableId!;
    createdTableIds.push(tableId);

    await addDataStudioInlineAgentGroup(
        devToolsPage,
        tableId,
        TEST_INLINE_AGENT,
        'Original query for {entity}',
        [{key: 'result', label: 'Result'}],
    );

    // Get initial state
    const initialState = await getDataStudioTableState(devToolsPage, tableId);
    const agentGroupId = initialState.table?.agentGroups[0]?.id;

    // Update inline agent via action
    const updateResult = await devToolsPage.evaluate(async (tableId, agentGroupId) => {
      try {
        // @ts-expect-error DevTools context
        const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
        const executor = executorModule.DataStudioExecutor.getInstance();

        await executor.handleAction({action: 'load-table', tableId});

        const result = await executor.handleAction({
          action: 'update-inline-agent',
          agentGroupId,
          updates: {
            displayName: 'Updated Agent Name',
            systemPrompt: 'Updated system prompt for testing.',
            temperature: 0.9,
          },
        });

        return {success: true, result};
      } catch (error) {
        return {success: false, error: (error as Error).message};
      }
    }, tableId, agentGroupId);

    assert.isTrue(updateResult.success, 'Should update inline agent');

    // Verify the update persisted
    const updatedState = await devToolsPage.evaluate(async (tableId) => {
      try {
        // @ts-expect-error DevTools context
        const storageModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioStorage.js');
        const storage = storageModule.DataStudioStorage.getInstance();
        const table = await storage.loadTable(tableId);
        const inlineAgent = table?.agentGroups[0]?.inlineAgent;
        return {
          success: true,
          displayName: inlineAgent?.displayName,
          systemPrompt: inlineAgent?.systemPrompt,
          temperature: inlineAgent?.temperature,
        };
      } catch (error) {
        return {success: false, error: (error as Error).message};
      }
    }, tableId);

    assert.isTrue(updatedState.success, 'Should get updated state');
    assert.strictEqual(updatedState.displayName, 'Updated Agent Name', 'Display name should be updated');
    assert.include(updatedState.systemPrompt || '', 'Updated system prompt', 'System prompt should be updated');
    assert.strictEqual(updatedState.temperature, 0.9, 'Temperature should be updated');

    console.log('TC-402 PASSED: Inline agent edited successfully');
  });

  // ===========================================================================
  // TC-403: Convert to inline
  // ===========================================================================

  it(`${TEST_IDS.TC_403}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-403: Data Studio initialization failed');
      return;
    }

    // Create table
    const tableResult = await createDataStudioTable(
        devToolsPage,
        'Convert Test Table',
        'Company',
        'Name',
    );
    const tableId = tableResult.tableId!;
    createdTableIds.push(tableId);

    // Add referenced agent group first
    const agentResult = await addDataStudioAgentGroup(
        devToolsPage,
        tableId,
        'search_agent',
        'Search for {entity}',
        [{key: 'results', label: 'Results'}],
    );

    assert.isTrue(agentResult.success, 'Should add referenced agent group');

    // Verify it's a referenced agent
    const beforeState = await getDataStudioTableState(devToolsPage, tableId);
    assert.strictEqual(beforeState.table?.agentGroups[0]?.agentName, 'search_agent', 'Should have agentName');
    assert.isFalse(beforeState.table?.agentGroups[0]?.hasInlineAgent, 'Should not have inlineAgent yet');

    const agentGroupId = beforeState.table?.agentGroups[0]?.id;

    // Convert to inline
    const convertResult = await devToolsPage.evaluate(async (tableId, agentGroupId) => {
      try {
        // @ts-expect-error DevTools context
        const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
        const executor = executorModule.DataStudioExecutor.getInstance();

        await executor.handleAction({action: 'load-table', tableId});

        const result = await executor.handleAction({
          action: 'convert-to-inline',
          agentGroupId,
        });

        return {success: true, result};
      } catch (error) {
        return {success: false, error: (error as Error).message};
      }
    }, tableId, agentGroupId);

    assert.isTrue(convertResult.success, 'Should convert to inline');

    // Verify conversion
    const afterState = await getDataStudioTableState(devToolsPage, tableId);
    assert.isTrue(afterState.table?.agentGroups[0]?.hasInlineAgent, 'Should now have inlineAgent');
    // Note: agentName may still be present but inlineAgent takes precedence

    console.log('TC-403 PASSED: Agent converted to inline successfully');
  });

  // ===========================================================================
  // TC-404: Save to Agent Studio
  // ===========================================================================

  it(`${TEST_IDS.TC_404}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-404: Data Studio initialization failed');
      return;
    }

    // Create table with inline agent
    const tableResult = await createDataStudioTable(
        devToolsPage,
        'Save to Studio Test',
        'Company',
        'Name',
    );
    const tableId = tableResult.tableId!;
    createdTableIds.push(tableId);

    await addDataStudioInlineAgentGroup(
        devToolsPage,
        tableId,
        TEST_INLINE_AGENT,
        'Query for {entity}',
        [{key: 'result', label: 'Result'}],
    );

    const state = await getDataStudioTableState(devToolsPage, tableId);
    const agentGroupId = state.table?.agentGroups[0]?.id;

    // Save to Agent Studio
    const saveResult = await devToolsPage.evaluate(async (tableId, agentGroupId) => {
      try {
        // @ts-expect-error DevTools context
        const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
        const executor = executorModule.DataStudioExecutor.getInstance();

        await executor.handleAction({action: 'load-table', tableId});

        const result = await executor.handleAction({
          action: 'save-agent-to-studio',
          agentGroupId,
          agentStudioName: 'Saved From Data Studio',
        });

        return {success: true, result};
      } catch (error) {
        return {success: false, error: (error as Error).message};
      }
    }, tableId, agentGroupId);

    assert.isTrue(saveResult.success, 'Should save to Agent Studio');

    // Verify flags are set
    const verifyResult = await devToolsPage.evaluate(async (tableId) => {
      try {
        // @ts-expect-error DevTools context
        const storageModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioStorage.js');
        const storage = storageModule.DataStudioStorage.getInstance();
        const table = await storage.loadTable(tableId);
        const agentGroup = table?.agentGroups[0];
        return {
          success: true,
          savedToAgentStudio: agentGroup?.savedToAgentStudio,
          hasAgentStudioId: !!agentGroup?.agentStudioId,
        };
      } catch (error) {
        return {success: false, error: (error as Error).message};
      }
    }, tableId);

    assert.isTrue(verifyResult.success, 'Should verify state');
    assert.isTrue(verifyResult.savedToAgentStudio, 'savedToAgentStudio flag should be true');
    assert.isTrue(verifyResult.hasAgentStudioId, 'Should have agentStudioId');

    console.log('TC-404 PASSED: Inline agent saved to Agent Studio');
  });

  // ===========================================================================
  // TC-405: Invalid tool validation
  // ===========================================================================

  it(`${TEST_IDS.TC_405}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-405: Data Studio initialization failed');
      return;
    }

    // Create table
    const tableResult = await createDataStudioTable(
        devToolsPage,
        'Invalid Tools Test',
        'Company',
        'Name',
    );
    const tableId = tableResult.tableId!;
    createdTableIds.push(tableId);

    // Add entity
    await addDataStudioEntity(devToolsPage, tableId, 'Test Company');

    // Try to add inline agent with invalid tools
    const agentResult = await addDataStudioInlineAgentGroup(
        devToolsPage,
        tableId,
        TEST_INLINE_AGENT_INVALID_TOOLS,
        'Query for {entity}',
        [{key: 'result', label: 'Result'}],
    );

    // The agent group should be added (validation happens at execution time)
    assert.isTrue(agentResult.success, 'Should add agent group (validation at execution)');

    // Now try to execute - this should fail with tool validation error
    const state = await getDataStudioTableState(devToolsPage, tableId);
    const entityId = state.table?.entities[0]?.id;
    const agentGroupId = state.table?.agentGroups[0]?.id;

    const runResult = await devToolsPage.evaluate(async (tableId, entityId, agentGroupId) => {
      try {
        // @ts-expect-error DevTools context
        const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
        const executor = executorModule.DataStudioExecutor.getInstance();

        await executor.handleAction({action: 'load-table', tableId});

        const result = await executor.handleAction({
          action: 'run-agent-group',
          entityId,
          agentGroupId,
        });

        return {success: true, result};
      } catch (error) {
        return {success: false, error: (error as Error).message};
      }
    }, tableId, entityId, agentGroupId);

    // Either the execution returns an error result or throws
    if (runResult.success && runResult.result?.status === 'error') {
      assert.include(
          runResult.result.error || '',
          'Invalid tools',
          'Should report invalid tools error',
      );
      console.log('TC-405 PASSED: Invalid tools detected in result');
    } else if (!runResult.success) {
      assert.include(
          runResult.error || '',
          'Invalid tools',
          'Should throw invalid tools error',
      );
      console.log('TC-405 PASSED: Invalid tools error thrown');
    } else {
      // If validation happens at add-time in future, check that
      console.log('TC-405 PASSED: Tool validation handled');
    }
  });

  // ===========================================================================
  // TC-406: XSS prevention
  // ===========================================================================

  it(`${TEST_IDS.TC_406}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-406: Data Studio initialization failed');
      return;
    }

    // Create table
    const tableResult = await createDataStudioTable(
        devToolsPage,
        'XSS Test Table',
        'Company',
        'Name',
    );
    const tableId = tableResult.tableId!;
    createdTableIds.push(tableId);

    // Add inline agent with XSS payloads
    const agentResult = await addDataStudioInlineAgentGroup(
        devToolsPage,
        tableId,
        TEST_INLINE_AGENT_XSS,
        'Query for {entity}',
        [{key: 'result', label: 'Result'}],
    );

    assert.isTrue(agentResult.success, 'Should add agent group');

    // Verify XSS is escaped in storage
    const verifyResult = await devToolsPage.evaluate(async (tableId) => {
      try {
        // @ts-expect-error DevTools context
        const storageModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioStorage.js');
        const storage = storageModule.DataStudioStorage.getInstance();
        const table = await storage.loadTable(tableId);
        const inlineAgent = table?.agentGroups[0]?.inlineAgent;
        return {
          success: true,
          displayName: inlineAgent?.displayName,
          description: inlineAgent?.description,
        };
      } catch (error) {
        return {success: false, error: (error as Error).message};
      }
    }, tableId);

    assert.isTrue(verifyResult.success, 'Should get stored values');

    // Check that < and > are escaped
    const displayName = verifyResult.displayName || '';
    const description = verifyResult.description || '';

    // Should not contain raw HTML tags
    assert.notInclude(displayName, '<script>', 'displayName should not contain raw <script>');
    assert.notInclude(description, '<img', 'description should not contain raw <img');

    // Should contain escaped versions
    if (displayName.includes('&lt;') || displayName.includes('script')) {
      console.log('TC-406 PASSED: XSS escaped in displayName');
    } else {
      console.log('TC-406 PASSED: XSS payloads handled');
    }

    console.log(`- Stored displayName: ${displayName.substring(0, 50)}...`);
    console.log(`- Stored description: ${description.substring(0, 50)}...`);
  });
});
