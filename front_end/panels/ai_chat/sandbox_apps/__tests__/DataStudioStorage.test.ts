// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for DataStudioStorage - IndexedDB storage for Data Studio v2 tables
 *
 * Tests the atomic transaction patterns that prevent race conditions.
 * Uses real IndexedDB (available in Karma browser environment).
 */

import {
  DataStudioStorage,
  type DataStudioTable,
  type CellResult,
} from '../execution/DataStudioStorage.js';

// =============================================================================
// Tests
// =============================================================================

describe('ai_chat: DataStudioStorage', () => {
  beforeEach(() => {
    // Reset singleton to get fresh database connection
    DataStudioStorage.reset();
  });

  afterEach(async () => {
    // Clean up all tables after each test
    try {
      const storage = DataStudioStorage.getInstance();
      await storage.clearAll();
    } catch {
      // Ignore cleanup errors
    }
    DataStudioStorage.reset();
  });

  function createTestTable(overrides: Partial<DataStudioTable> = {}): DataStudioTable {
    // Use unique IDs to avoid conflicts between tests
    const uniqueId = `test-table-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      tableId: overrides.tableId || uniqueId,
      tableName: overrides.tableName || 'Test Table',
      entityType: 'Companies',
      entityNameLabel: 'Company',
      entities: overrides.entities || [
        {id: 'entity-1', name: 'Company A'},
        {id: 'entity-2', name: 'Company B'},
      ],
      agentGroups: overrides.agentGroups || [
        {id: 'agent-1', agentName: 'Agent 1', queryTemplate: '...', outputColumns: []},
        {id: 'agent-2', agentName: 'Agent 2', queryTemplate: '...', outputColumns: []},
      ],
      results: overrides.results || {},
      executionStatus: overrides.executionStatus || 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  describe('basic CRUD operations', () => {
    it('saves and loads a table', async () => {
      const storage = DataStudioStorage.getInstance();
      const table = createTestTable();

      await storage.saveTable(table);
      const loaded = await storage.loadTable(table.tableId);

      assert.isNotNull(loaded);
      assert.strictEqual(loaded?.tableName, 'Test Table');
      assert.strictEqual(loaded?.entities.length, 2);
    });

    it('lists tables', async () => {
      const storage = DataStudioStorage.getInstance();
      const table1 = createTestTable({tableName: 'Table 1'});
      const table2 = createTestTable({tableName: 'Table 2'});
      await storage.saveTable(table1);
      await storage.saveTable(table2);

      const tables = await storage.listTables();

      assert.isAtLeast(tables.length, 2);
      const names = tables.map(t => t.name);
      assert.include(names, 'Table 1');
      assert.include(names, 'Table 2');
    });

    it('deletes a table', async () => {
      const storage = DataStudioStorage.getInstance();
      const table = createTestTable();
      await storage.saveTable(table);

      await storage.deleteTable(table.tableId);
      const loaded = await storage.loadTable(table.tableId);

      assert.isNull(loaded);
    });

    it('checks table existence', async () => {
      const storage = DataStudioStorage.getInstance();
      const table = createTestTable();

      assert.isFalse(await storage.tableExists(table.tableId));

      await storage.saveTable(table);

      assert.isTrue(await storage.tableExists(table.tableId));
    });
  });

  describe('updateResults - atomic transaction', () => {
    it('updates results within single transaction', async () => {
      const storage = DataStudioStorage.getInstance();
      const table = createTestTable();
      await storage.saveTable(table);

      const newResults: Record<string, Record<string, CellResult>> = {
        'entity-1': {
          'agent-1': {status: 'completed', values: {output: 'result1'}},
        },
      };

      await storage.updateResults(table.tableId, newResults);

      const loaded = await storage.loadTable(table.tableId);
      assert.deepEqual(loaded?.results, newResults);
    });

    it('throws if table not found', async () => {
      const storage = DataStudioStorage.getInstance();

      try {
        await storage.updateResults('non-existent-table-id', {});
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'Table not found');
      }
    });
  });

  describe('mergeResults - atomic merge', () => {
    it('merges new results preserving existing', async () => {
      const storage = DataStudioStorage.getInstance();
      const table = createTestTable({
        results: {
          'entity-1': {
            'agent-1': {status: 'completed', values: {output: 'existing'}},
          },
        },
      });
      await storage.saveTable(table);

      // Merge results for entity-2
      await storage.mergeResults(table.tableId, {
        'entity-2': {
          'agent-1': {status: 'completed', values: {output: 'new'}},
        },
      });

      const loaded = await storage.loadTable(table.tableId);

      // Both results should exist
      assert.strictEqual(loaded?.results['entity-1']['agent-1'].values?.output, 'existing');
      assert.strictEqual(loaded?.results['entity-2']['agent-1'].values?.output, 'new');
    });

    it('merges additional agent results for same entity', async () => {
      const storage = DataStudioStorage.getInstance();
      const table = createTestTable({
        results: {
          'entity-1': {
            'agent-1': {status: 'completed', values: {output: 'agent1-result'}},
          },
        },
      });
      await storage.saveTable(table);

      // Merge agent-2 result for same entity
      await storage.mergeResults(table.tableId, {
        'entity-1': {
          'agent-2': {status: 'completed', values: {output: 'agent2-result'}},
        },
      });

      const loaded = await storage.loadTable(table.tableId);

      // Both agent results should exist for entity-1
      assert.strictEqual(loaded?.results['entity-1']['agent-1'].values?.output, 'agent1-result');
      assert.strictEqual(loaded?.results['entity-1']['agent-2'].values?.output, 'agent2-result');
    });
  });

  describe('updateCellResult - single cell update', () => {
    it('updates single cell atomically', async () => {
      const storage = DataStudioStorage.getInstance();
      const table = createTestTable();
      await storage.saveTable(table);

      await storage.updateCellResult(table.tableId, 'entity-1', 'agent-1', {
        status: 'completed',
        values: {output: 'cell-value'},
      });

      const loaded = await storage.loadTable(table.tableId);
      assert.strictEqual(loaded?.results['entity-1']['agent-1'].values?.output, 'cell-value');
    });

    it('creates nested structure if not exists', async () => {
      const storage = DataStudioStorage.getInstance();
      const table = createTestTable({results: {}});
      await storage.saveTable(table);

      await storage.updateCellResult(table.tableId, 'new-entity', 'new-agent', {
        status: 'running',
      });

      const loaded = await storage.loadTable(table.tableId);
      assert.strictEqual(loaded?.results['new-entity']['new-agent'].status, 'running');
    });
  });

  describe('updateExecutionStatus - atomic status update', () => {
    it('updates execution status', async () => {
      const storage = DataStudioStorage.getInstance();
      const table = createTestTable({executionStatus: 'idle'});
      await storage.saveTable(table);

      await storage.updateExecutionStatus(table.tableId, 'running');

      const loaded = await storage.loadTable(table.tableId);
      assert.strictEqual(loaded?.executionStatus, 'running');
    });

    it('throws if table not found', async () => {
      const storage = DataStudioStorage.getInstance();

      try {
        await storage.updateExecutionStatus('non-existent-table-id', 'running');
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'Table not found');
      }
    });
  });

  describe('race condition prevention', () => {
    it('mergeResults preserves concurrent updates (no data loss)', async () => {
      const storage = DataStudioStorage.getInstance();
      const table = createTestTable({results: {}});
      await storage.saveTable(table);

      // Simulate concurrent updates from different agents
      // Both should be preserved due to atomic merge semantics
      await Promise.all([
        storage.mergeResults(table.tableId, {
          'entity-1': {
            'agent-1': {status: 'completed', values: {output: 'result-1'}},
          },
        }),
        storage.mergeResults(table.tableId, {
          'entity-1': {
            'agent-2': {status: 'completed', values: {output: 'result-2'}},
          },
        }),
      ]);

      const loaded = await storage.loadTable(table.tableId);

      // Both results should be preserved - this is the key race condition fix
      assert.isOk(loaded?.results['entity-1']['agent-1'], 'agent-1 result should exist');
      assert.isOk(loaded?.results['entity-1']['agent-2'], 'agent-2 result should exist');
      assert.strictEqual(loaded?.results['entity-1']['agent-1'].values?.output, 'result-1');
      assert.strictEqual(loaded?.results['entity-1']['agent-2'].values?.output, 'result-2');
    });

    it('updateCellResult allows concurrent cell updates', async () => {
      const storage = DataStudioStorage.getInstance();
      const table = createTestTable({results: {}});
      await storage.saveTable(table);

      // Simulate concurrent cell updates
      await Promise.all([
        storage.updateCellResult(table.tableId, 'entity-1', 'agent-1', {
          status: 'completed',
          values: {output: 'cell-1-1'},
        }),
        storage.updateCellResult(table.tableId, 'entity-1', 'agent-2', {
          status: 'completed',
          values: {output: 'cell-1-2'},
        }),
        storage.updateCellResult(table.tableId, 'entity-2', 'agent-1', {
          status: 'completed',
          values: {output: 'cell-2-1'},
        }),
      ]);

      const loaded = await storage.loadTable(table.tableId);

      // All 3 cells should have results
      assert.strictEqual(loaded?.results['entity-1']['agent-1'].values?.output, 'cell-1-1');
      assert.strictEqual(loaded?.results['entity-1']['agent-2'].values?.output, 'cell-1-2');
      assert.strictEqual(loaded?.results['entity-2']['agent-1'].values?.output, 'cell-2-1');
    });

    it('sequential mergeResults accumulate correctly', async () => {
      const storage = DataStudioStorage.getInstance();
      const table = createTestTable({results: {}});
      await storage.saveTable(table);

      // Sequential updates should all accumulate
      await storage.mergeResults(table.tableId, {
        'entity-1': {'agent-1': {status: 'completed', values: {output: 'r1'}}},
      });
      await storage.mergeResults(table.tableId, {
        'entity-1': {'agent-2': {status: 'completed', values: {output: 'r2'}}},
      });
      await storage.mergeResults(table.tableId, {
        'entity-2': {'agent-1': {status: 'completed', values: {output: 'r3'}}},
      });

      const loaded = await storage.loadTable(table.tableId);

      assert.strictEqual(loaded?.results['entity-1']['agent-1'].values?.output, 'r1');
      assert.strictEqual(loaded?.results['entity-1']['agent-2'].values?.output, 'r2');
      assert.strictEqual(loaded?.results['entity-2']['agent-1'].values?.output, 'r3');
    });
  });
});
