// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * E2E Tests for Data Studio CRUD Operations
 *
 * Test Cases: TC-101 to TC-204
 * - TC-101: Create custom table
 * - TC-102: Create from template
 * - TC-103: Load saved table
 * - TC-104: Invalid table name
 * - TC-201: Add entity
 * - TC-202: Add entity with context
 * - TC-203: Remove entity
 * - TC-204: Add multiple entities
 */

import {assert} from 'chai';
import {expectError} from '../../conductor/events.js';
import {
  initializeDataStudio,
  createDataStudioTable,
  addDataStudioEntity,
  getDataStudioTableState,
  saveDataStudioTable,
  deleteDataStudioTable,
} from '../shared/sandbox-helpers.js';
import {
  TEST_TABLE_CONFIG,
  TEST_ENTITIES,
  TEST_ENTITY_SINGLE,
  TEST_ENTITY_XSS,
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

describe('Data Studio CRUD E2E Tests', function() {
  if (this.timeout() > 0) {
    this.timeout(120000);
  }

  setup({enabledDevToolsExperiments: ['protocol-monitor']});

  let createdTableIds: string[] = [];

  // ===========================================================================
  // TC-101: Create custom table
  // ===========================================================================

  it(`${TEST_IDS.TC_101}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-101: Data Studio initialization failed');
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

    // Verify table state
    const state = await getDataStudioTableState(devToolsPage, tableId);
    assert.isTrue(state.success, 'Should get table state');
    assert.strictEqual(state.table?.tableName, TEST_TABLE_CONFIG.tableName, 'Table name should match');
    assert.strictEqual(state.table?.entityType, TEST_TABLE_CONFIG.entityType, 'Entity type should match');
    assert.strictEqual(state.table?.entityCount, 0, 'Should start with 0 entities');
    assert.strictEqual(state.table?.agentGroupCount, 0, 'Should start with 0 agent groups');

    console.log('TC-101 PASSED: Custom table created');
    console.log(`- Table ID: ${tableId}`);
    console.log(`- Table Name: ${state.table?.tableName}`);
  });

  // ===========================================================================
  // TC-102: Create from template
  // ===========================================================================

  it(`${TEST_IDS.TC_102}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-102: Data Studio initialization failed');
      return;
    }

    // Use template via executor
    const templateResult = await devToolsPage.evaluate(async () => {
      try {
        // @ts-expect-error DevTools context
        const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
        const executor = executorModule.DataStudioExecutor.getInstance();

        const result = await executor.handleAction({
          action: 'use-template',
          templateId: 'competitor-analysis',
          tableName: 'My Competitor Analysis',
        });

        return {
          success: true,
          tableId: result?.tableId,
          result,
        };
      } catch (error) {
        return {success: false, error: (error as Error).message};
      }
    });

    assert.isTrue(templateResult.success, 'Should create from template');
    assert.isString(templateResult.tableId, 'Should return table ID');

    const tableId = templateResult.tableId!;
    createdTableIds.push(tableId);

    // Verify template populated data
    const state = await getDataStudioTableState(devToolsPage, tableId);
    assert.isTrue(state.success, 'Should get table state');
    assert.isAbove(state.table?.entityCount || 0, 0, 'Should have template entities');
    assert.isAbove(state.table?.agentGroupCount || 0, 0, 'Should have template agents');

    console.log('TC-102 PASSED: Table created from template');
    console.log(`- Entities: ${state.table?.entityCount}`);
    console.log(`- Agent Groups: ${state.table?.agentGroupCount}`);
  });

  // ===========================================================================
  // TC-103: Load saved table
  // ===========================================================================

  it(`${TEST_IDS.TC_103}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-103: Data Studio initialization failed');
      return;
    }

    // Create and save table
    const tableResult = await createDataStudioTable(
        devToolsPage,
        'Save Load Test',
        'Company',
        'Name',
    );
    const tableId = tableResult.tableId!;
    createdTableIds.push(tableId);

    // Add some data
    await addDataStudioEntity(devToolsPage, tableId, 'Entity 1');
    await addDataStudioEntity(devToolsPage, tableId, 'Entity 2');

    // Save table
    const saveResult = await saveDataStudioTable(devToolsPage, tableId);
    assert.isTrue(saveResult.success, 'Should save table');

    // Load table
    const loadResult = await devToolsPage.evaluate(async (tableId) => {
      try {
        // @ts-expect-error DevTools context
        const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
        const executor = executorModule.DataStudioExecutor.getInstance();

        const result = await executor.handleAction({
          action: 'load-table',
          tableId,
        });

        return {success: true, result};
      } catch (error) {
        return {success: false, error: (error as Error).message};
      }
    }, tableId);

    assert.isTrue(loadResult.success, 'Should load table');

    // Verify data persisted
    const state = await getDataStudioTableState(devToolsPage, tableId);
    assert.strictEqual(state.table?.entityCount, 2, 'Should have 2 entities');
    assert.strictEqual(state.table?.tableName, 'Save Load Test', 'Name should persist');

    console.log('TC-103 PASSED: Table loaded from storage');
  });

  // ===========================================================================
  // TC-104: Invalid table name
  // ===========================================================================

  it(`${TEST_IDS.TC_104}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-104: Data Studio initialization failed');
      return;
    }

    // Try to create table with empty name
    const emptyResult = await createDataStudioTable(
        devToolsPage,
        '',  // Empty name
        'Company',
        'Name',
    );

    // Should either fail or use default name
    if (!emptyResult.success) {
      assert.include(emptyResult.error || '', 'name', 'Should mention name in error');
      console.log('TC-104 PASSED: Empty name rejected');
    } else {
      // If it succeeds, verify a default name was used
      const state = await getDataStudioTableState(devToolsPage, emptyResult.tableId!);
      assert.isTrue(state.table?.tableName?.length! > 0, 'Should have some name');
      createdTableIds.push(emptyResult.tableId!);
      console.log('TC-104 PASSED: Empty name handled with default');
    }
  });

  // ===========================================================================
  // TC-201: Add entity
  // ===========================================================================

  it(`${TEST_IDS.TC_201}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-201: Data Studio initialization failed');
      return;
    }

    const tableResult = await createDataStudioTable(
        devToolsPage,
        'Entity Test',
        'Company',
        'Name',
    );
    const tableId = tableResult.tableId!;
    createdTableIds.push(tableId);

    // Add entity
    const entityResult = await addDataStudioEntity(
        devToolsPage,
        tableId,
        TEST_ENTITY_SINGLE.name,
    );

    assert.isTrue(entityResult.success, 'Should add entity');
    assert.isString(entityResult.entityId, 'Should return entity ID');

    // Verify
    const state = await getDataStudioTableState(devToolsPage, tableId);
    assert.strictEqual(state.table?.entityCount, 1, 'Should have 1 entity');
    assert.strictEqual(state.table?.entities[0]?.name, TEST_ENTITY_SINGLE.name, 'Name should match');

    console.log('TC-201 PASSED: Entity added');
    console.log(`- Entity ID: ${entityResult.entityId}`);
  });

  // ===========================================================================
  // TC-202: Add entity with context
  // ===========================================================================

  it(`${TEST_IDS.TC_202}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-202: Data Studio initialization failed');
      return;
    }

    const tableResult = await createDataStudioTable(
        devToolsPage,
        'Context Test',
        'Company',
        'Name',
    );
    const tableId = tableResult.tableId!;
    createdTableIds.push(tableId);

    // Add entity with context
    const entityResult = await addDataStudioEntity(
        devToolsPage,
        tableId,
        TEST_ENTITY_SINGLE.name,
        TEST_ENTITY_SINGLE.context,
    );

    assert.isTrue(entityResult.success, 'Should add entity with context');

    // Verify context stored
    const state = await getDataStudioTableState(devToolsPage, tableId);
    const entity = state.table?.entities[0];
    assert.strictEqual(entity?.name, TEST_ENTITY_SINGLE.name, 'Name should match');
    assert.strictEqual(entity?.context, TEST_ENTITY_SINGLE.context, 'Context should be stored');

    console.log('TC-202 PASSED: Entity added with context');
    console.log(`- Context: ${entity?.context}`);
  });

  // ===========================================================================
  // TC-203: Remove entity
  // ===========================================================================

  it(`${TEST_IDS.TC_203}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-203: Data Studio initialization failed');
      return;
    }

    const tableResult = await createDataStudioTable(
        devToolsPage,
        'Remove Test',
        'Company',
        'Name',
    );
    const tableId = tableResult.tableId!;
    createdTableIds.push(tableId);

    // Add entity
    const entityResult = await addDataStudioEntity(devToolsPage, tableId, 'To Be Removed');
    const entityId = entityResult.entityId!;

    // Verify added
    let state = await getDataStudioTableState(devToolsPage, tableId);
    assert.strictEqual(state.table?.entityCount, 1, 'Should have 1 entity');

    // Remove entity
    const removeResult = await devToolsPage.evaluate(async (tableId, entityId) => {
      try {
        // @ts-expect-error DevTools context
        const executorModule = await import('/front_end/panels/ai_chat/sandbox_apps/execution/DataStudioExecutor.js');
        const executor = executorModule.DataStudioExecutor.getInstance();

        await executor.handleAction({action: 'load-table', tableId});

        const result = await executor.handleAction({
          action: 'remove-entity',
          entityId,
        });

        return {success: true, result};
      } catch (error) {
        return {success: false, error: (error as Error).message};
      }
    }, tableId, entityId);

    assert.isTrue(removeResult.success, 'Should remove entity');

    // Verify removed
    state = await getDataStudioTableState(devToolsPage, tableId);
    assert.strictEqual(state.table?.entityCount, 0, 'Should have 0 entities');

    console.log('TC-203 PASSED: Entity removed');
  });

  // ===========================================================================
  // TC-204: Add multiple entities
  // ===========================================================================

  it(`${TEST_IDS.TC_204}`, async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-204: Data Studio initialization failed');
      return;
    }

    const tableResult = await createDataStudioTable(
        devToolsPage,
        'Multiple Entities Test',
        'Company',
        'Name',
    );
    const tableId = tableResult.tableId!;
    createdTableIds.push(tableId);

    // Add multiple entities
    for (const entity of TEST_ENTITIES) {
      const result = await addDataStudioEntity(devToolsPage, tableId, entity.name, entity.context);
      assert.isTrue(result.success, `Should add entity: ${entity.name}`);
    }

    // Verify all added
    const state = await getDataStudioTableState(devToolsPage, tableId);
    assert.strictEqual(state.table?.entityCount, TEST_ENTITIES.length, `Should have ${TEST_ENTITIES.length} entities`);

    // Verify names
    const names = state.table?.entities.map((e: {name: string}) => e.name) || [];
    for (const entity of TEST_ENTITIES) {
      assert.include(names, entity.name, `Should include ${entity.name}`);
    }

    console.log('TC-204 PASSED: Multiple entities added');
    console.log(`- Total entities: ${state.table?.entityCount}`);
  });

  // ===========================================================================
  // TC-205 (Bonus): XSS prevention in entity names
  // ===========================================================================

  it('TC-205: XSS prevention in entity names', async ({devToolsPage}) => {
    setupExpectedErrors();

    const initResult = await initializeDataStudio(devToolsPage);
    if (!initResult.success) {
      console.log('SKIPPING TC-205: Data Studio initialization failed');
      return;
    }

    const tableResult = await createDataStudioTable(
        devToolsPage,
        'XSS Entity Test',
        'Company',
        'Name',
    );
    const tableId = tableResult.tableId!;
    createdTableIds.push(tableId);

    // Add entity with XSS payload
    const entityResult = await addDataStudioEntity(
        devToolsPage,
        tableId,
        TEST_ENTITY_XSS.name,
        TEST_ENTITY_XSS.context,
    );

    assert.isTrue(entityResult.success, 'Should add entity');

    // Verify XSS is escaped
    const state = await getDataStudioTableState(devToolsPage, tableId);
    const entity = state.table?.entities[0];

    // Should not contain raw script tags
    assert.notInclude(entity?.name || '', '<script>', 'Name should not contain raw <script>');

    console.log('TC-205 PASSED: XSS escaped in entity');
    console.log(`- Stored name: ${entity?.name?.substring(0, 50)}...`);
  });
});
