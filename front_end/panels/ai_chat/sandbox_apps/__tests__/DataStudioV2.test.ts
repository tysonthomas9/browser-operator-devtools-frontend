// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for Data Studio v2 sandbox app template
 */

import {VFSManager} from '../vfs/VFSManager.js';
import {
  getDataStudioFiles,
  INDEX_SOURCE,
  TYPES_SOURCE,
  STORE_SOURCE,
  BRIDGE_SOURCE,
  APP_SOURCE,
  HEADER_SOURCE,
  SELECTOR_VIEW_SOURCE,
  TABLE_VIEW_SOURCE,
  DATA_TABLE_SOURCE,
  ICONS_SOURCE,
  MODALS_SOURCE,
  CREATE_TABLE_MODAL_SOURCE,
  ADD_ENTITY_MODAL_SOURCE,
  ADD_AGENT_MODAL_SOURCE,
  CELL_DETAIL_MODAL_SOURCE,
  NOTIFICATION_SOURCE,
  STYLES_SOURCE,
} from '../apps/data-studio/sources.js';

describe('ai_chat: Data Studio v2', () => {
  let vfs: VFSManager;

  beforeEach(() => {
    vfs = VFSManager.getInstance();
    vfs.reset();
  });

  afterEach(() => {
    vfs.reset();
  });

  // ==========================================================================
  // Source Constants Tests
  // ==========================================================================

  describe('source constants', () => {
    it('INDEX_SOURCE contains Preact render', () => {
      assert.include(INDEX_SOURCE, 'import { render } from');
      assert.include(INDEX_SOURCE, 'preact');
      assert.include(INDEX_SOURCE, '<App />');
    });

    it('TYPES_SOURCE contains DataTable interface', () => {
      assert.include(TYPES_SOURCE, 'interface DataTable');
      assert.include(TYPES_SOURCE, 'entities:');
      assert.include(TYPES_SOURCE, 'agentGroups:');
      assert.include(TYPES_SOURCE, 'results:');
    });

    it('TYPES_SOURCE contains Entity interface', () => {
      assert.include(TYPES_SOURCE, 'interface Entity');
      assert.include(TYPES_SOURCE, 'id: string');
      assert.include(TYPES_SOURCE, 'name: string');
    });

    it('TYPES_SOURCE contains AgentGroup interface', () => {
      assert.include(TYPES_SOURCE, 'interface AgentGroup');
      assert.include(TYPES_SOURCE, 'agentName:');
      assert.include(TYPES_SOURCE, 'queryTemplate:');
      assert.include(TYPES_SOURCE, 'outputColumns:');
    });

    it('TYPES_SOURCE contains CellResult interface', () => {
      assert.include(TYPES_SOURCE, 'interface CellResult');
      assert.include(TYPES_SOURCE, 'pending');
      assert.include(TYPES_SOURCE, 'running');
      assert.include(TYPES_SOURCE, 'completed');
      assert.include(TYPES_SOURCE, 'error');
    });

    it('STORE_SOURCE uses Preact signals', () => {
      assert.include(STORE_SOURCE, 'import { signal');
      assert.include(STORE_SOURCE, 'preact/signals');
    });

    it('STORE_SOURCE exports state management functions', () => {
      assert.include(STORE_SOURCE, 'export const state');
      assert.include(STORE_SOURCE, 'export function setState');
      assert.include(STORE_SOURCE, 'export function setCurrentTable');
      assert.include(STORE_SOURCE, 'export function updateCellResult');
      assert.include(STORE_SOURCE, 'export function addEntity');
      assert.include(STORE_SOURCE, 'export function removeEntity');
      assert.include(STORE_SOURCE, 'export function addAgentGroup');
      assert.include(STORE_SOURCE, 'export function removeAgentGroup');
    });

    it('BRIDGE_SOURCE handles sandbox communication', () => {
      assert.include(BRIDGE_SOURCE, '__sandbox');
      assert.include(BRIDGE_SOURCE, 'sendAction');
      assert.include(BRIDGE_SOURCE, 'handleMessage');
      assert.include(BRIDGE_SOURCE, 'initBridge');
    });

    it('BRIDGE_SOURCE handles message types', () => {
      assert.include(BRIDGE_SOURCE, 'set-state');
      assert.include(BRIDGE_SOURCE, 'set-table');
      assert.include(BRIDGE_SOURCE, 'update-cell');
      assert.include(BRIDGE_SOURCE, 'entity-added');
      assert.include(BRIDGE_SOURCE, 'agent-group-added');
    });

    it('APP_SOURCE imports all major components', () => {
      assert.include(APP_SOURCE, 'import { Header }');
      assert.include(APP_SOURCE, 'import { SelectorView }');
      assert.include(APP_SOURCE, 'import { TableView }');
      assert.include(APP_SOURCE, 'CreateTableModal');
      assert.include(APP_SOURCE, 'AddEntityModal');
      assert.include(APP_SOURCE, 'AddAgentModal');
    });

    it('HEADER_SOURCE contains navigation elements', () => {
      assert.include(HEADER_SOURCE, 'Data Studio');
      assert.include(HEADER_SOURCE, 'handleSave');
      assert.include(HEADER_SOURCE, 'handleBack');
      assert.include(HEADER_SOURCE, 'handleClose');
    });

    it('SELECTOR_VIEW_SOURCE contains table and template lists', () => {
      assert.include(SELECTOR_VIEW_SOURCE, 'Your Tables');
      assert.include(SELECTOR_VIEW_SOURCE, 'Start from Template');
      assert.include(SELECTOR_VIEW_SOURCE, 'Create Custom Table');
      assert.include(SELECTOR_VIEW_SOURCE, 'handleLoadTable');
      assert.include(SELECTOR_VIEW_SOURCE, 'handleDeleteTable');
    });

    it('TABLE_VIEW_SOURCE contains action bar elements', () => {
      assert.include(TABLE_VIEW_SOURCE, 'Entity Type');
      assert.include(TABLE_VIEW_SOURCE, 'Add Agent');
      assert.include(TABLE_VIEW_SOURCE, 'Run All');
      assert.include(TABLE_VIEW_SOURCE, 'Export');
    });

    it('DATA_TABLE_SOURCE renders table structure', () => {
      assert.include(DATA_TABLE_SOURCE, '<table');
      assert.include(DATA_TABLE_SOURCE, '<thead>');
      assert.include(DATA_TABLE_SOURCE, '<tbody>');
      assert.include(DATA_TABLE_SOURCE, 'ResultCell');
    });

    it('ICONS_SOURCE exports icon components', () => {
      assert.include(ICONS_SOURCE, 'export function TableIcon');
      assert.include(ICONS_SOURCE, 'export function PlayIcon');
      assert.include(ICONS_SOURCE, 'export function PauseIcon');
      assert.include(ICONS_SOURCE, 'export function SaveIcon');
      assert.include(ICONS_SOURCE, 'export function TrashIcon');
    });

    it('MODALS_SOURCE manages modal state', () => {
      assert.include(MODALS_SOURCE, 'activeModal');
      assert.include(MODALS_SOURCE, 'openModal');
      assert.include(MODALS_SOURCE, 'closeModal');
      assert.include(MODALS_SOURCE, 'cellDetailData');
    });

    it('CREATE_TABLE_MODAL_SOURCE has form fields', () => {
      assert.include(CREATE_TABLE_MODAL_SOURCE, 'Table Name');
      assert.include(CREATE_TABLE_MODAL_SOURCE, 'Entity Type');
      assert.include(CREATE_TABLE_MODAL_SOURCE, 'Entity Name Column');
    });

    it('ADD_ENTITY_MODAL_SOURCE has entity form', () => {
      assert.include(ADD_ENTITY_MODAL_SOURCE, 'Name');
      assert.include(ADD_ENTITY_MODAL_SOURCE, 'Additional Context');
      assert.include(ADD_ENTITY_MODAL_SOURCE, 'add-entity');
    });

    it('ADD_AGENT_MODAL_SOURCE has agent configuration', () => {
      assert.include(ADD_AGENT_MODAL_SOURCE, 'Select Agent');
      assert.include(ADD_AGENT_MODAL_SOURCE, 'Query Template');
      assert.include(ADD_AGENT_MODAL_SOURCE, 'Output Columns');
      assert.include(ADD_AGENT_MODAL_SOURCE, '{entity}');
    });

    it('CELL_DETAIL_MODAL_SOURCE shows cell content', () => {
      assert.include(CELL_DETAIL_MODAL_SOURCE, 'Cell Detail');
      assert.include(CELL_DETAIL_MODAL_SOURCE, 'Copy');
      assert.include(CELL_DETAIL_MODAL_SOURCE, 'clipboard');
    });

    it('NOTIFICATION_SOURCE provides toast notifications', () => {
      assert.include(NOTIFICATION_SOURCE, 'showNotification');
      assert.include(NOTIFICATION_SOURCE, 'success');
      assert.include(NOTIFICATION_SOURCE, 'error');
    });

    it('STYLES_SOURCE contains Tailwind directives', () => {
      assert.include(STYLES_SOURCE, '@tailwind');
    });
  });

  // ==========================================================================
  // getDataStudioFiles Tests
  // ==========================================================================

  describe('getDataStudioFiles', () => {
    it('returns all required files', () => {
      const files = getDataStudioFiles();

      assert.isOk(files['/src/index.tsx']);
      assert.isOk(files['/src/types.ts']);
      assert.isOk(files['/src/store.ts']);
      assert.isOk(files['/src/bridge.ts']);
      assert.isOk(files['/src/App.tsx']);
      assert.isOk(files['/src/styles.css']);
    });

    it('returns all component files', () => {
      const files = getDataStudioFiles();

      assert.isOk(files['/src/components/Header.tsx']);
      assert.isOk(files['/src/components/SelectorView.tsx']);
      assert.isOk(files['/src/components/TableView.tsx']);
      assert.isOk(files['/src/components/DataTable.tsx']);
      assert.isOk(files['/src/components/Icons.tsx']);
    });

    it('returns all modal files', () => {
      const files = getDataStudioFiles();

      assert.isOk(files['/src/components/modals.ts']);
      assert.isOk(files['/src/components/CreateTableModal.tsx']);
      assert.isOk(files['/src/components/AddEntityModal.tsx']);
      assert.isOk(files['/src/components/AddAgentModal.tsx']);
      assert.isOk(files['/src/components/CellDetailModal.tsx']);
      assert.isOk(files['/src/components/Notification.tsx']);
    });

    it('returns correct number of files', () => {
      const files = getDataStudioFiles();
      // 17 files total
      assert.strictEqual(Object.keys(files).length, 17);
    });

    it('all files are non-empty strings', () => {
      const files = getDataStudioFiles();

      for (const [path, content] of Object.entries(files)) {
        assert.isString(content, `${path} should be a string`);
        assert.isTrue(content.length > 0, `${path} should not be empty`);
      }
    });
  });

  // ==========================================================================
  // VFS Integration Tests
  // ==========================================================================

  describe('VFS integration', () => {
    it('data-studio template creates all files', () => {
      const result = vfs.createApp('test-app', 'data-studio');
      const files = result.files;

      // Core files
      assert.isOk(files['/src/index.tsx']);
      assert.isOk(files['/src/App.tsx']);
      assert.isOk(files['/src/types.ts']);
      assert.isOk(files['/src/store.ts']);
      assert.isOk(files['/src/bridge.ts']);

      // Components
      assert.isOk(files['/src/components/Header.tsx']);
      assert.isOk(files['/src/components/DataTable.tsx']);
    });

    it('data-studio template includes shadcn components', () => {
      const result = vfs.createApp('test-app', 'data-studio');
      const files = result.files;

      // Should include shadcn
      assert.isOk(files['/src/components/ui/Button.tsx']);
      assert.isOk(files['/src/components/ui/Input.tsx']);
      assert.isOk(files['/src/components/ui/Card.tsx']);
      assert.isOk(files['/src/components/ui/index.ts']);
    });

    it('data-studio template can disable shadcn', () => {
      const result = vfs.createApp('test-app', 'data-studio', false);
      const files = result.files;

      // Should have data studio files
      assert.isOk(files['/src/App.tsx']);

      // Should NOT have shadcn files
      assert.isUndefined(files['/src/components/ui/Button.tsx']);
    });

    it('data-studio template has correct entry point', () => {
      const result = vfs.createApp('test-app', 'data-studio');

      assert.strictEqual(result.entry, '/src/index.tsx');
    });

    it('data-studio files are readable after creation', () => {
      vfs.createApp('test-app', 'data-studio');

      const appSource = vfs.readFile('test-app', '/src/App.tsx');
      assert.isOk(appSource);
      assert.include(appSource!, 'export function App');

      const storeSource = vfs.readFile('test-app', '/src/store.ts');
      assert.isOk(storeSource);
      assert.include(storeSource!, 'signal');
    });

    it('data-studio files appear in listFiles', () => {
      vfs.createApp('test-app', 'data-studio');

      const fileList = vfs.listFiles('test-app');
      const paths = fileList.map(f => f.path);

      assert.include(paths, '/src/index.tsx');
      assert.include(paths, '/src/App.tsx');
      assert.include(paths, '/src/components/Header.tsx');
      assert.include(paths, '/src/components/DataTable.tsx');
    });

    it('data-studio files can be modified', () => {
      vfs.createApp('test-app', 'data-studio');

      const customApp = 'export function App() { return <div>Custom</div>; }';
      vfs.writeFile('test-app', '/src/App.tsx', customApp);

      const content = vfs.readFile('test-app', '/src/App.tsx');
      assert.strictEqual(content, customApp);
    });

    it('data-studio template file count is correct', () => {
      const result = vfs.createApp('test-app', 'data-studio');
      const files = result.files;

      // 17 data studio files + 9 shadcn files = 26 total
      assert.strictEqual(Object.keys(files).length, 26);
    });
  });

  // ==========================================================================
  // Component Structure Tests
  // ==========================================================================

  describe('component structure', () => {
    it('App component has proper lifecycle', () => {
      assert.include(APP_SOURCE, 'useEffect');
      assert.include(APP_SOURCE, 'initBridge');
    });

    it('components use shadcn UI imports', () => {
      assert.include(HEADER_SOURCE, "from '@/components/ui'");
      assert.include(SELECTOR_VIEW_SOURCE, "from '@/components/ui'");
      assert.include(TABLE_VIEW_SOURCE, "from '@/components/ui'");
    });

    it('components use Preact properly', () => {
      assert.include(APP_SOURCE, "import { h } from 'preact'");
      assert.include(HEADER_SOURCE, "import { h } from 'preact'");
      assert.include(DATA_TABLE_SOURCE, "import { h } from 'preact'");
    });

    it('store uses Preact signals for reactivity', () => {
      assert.include(STORE_SOURCE, 'signal<DataStudioState>');
      assert.include(STORE_SOURCE, 'computed');
    });

    it('bridge declares global types', () => {
      assert.include(BRIDGE_SOURCE, 'declare global');
      assert.include(BRIDGE_SOURCE, 'interface Window');
      assert.include(BRIDGE_SOURCE, '__sandbox');
    });
  });

  // ==========================================================================
  // Action Types Tests
  // ==========================================================================

  describe('action types', () => {
    it('bridge sends ready action', () => {
      assert.include(BRIDGE_SOURCE, "type: 'ready'");
    });

    it('bridge sends get-state action', () => {
      assert.include(BRIDGE_SOURCE, "type: 'get-state'");
    });

    it('selector view sends table actions', () => {
      assert.include(SELECTOR_VIEW_SOURCE, "type: 'load-table'");
      assert.include(SELECTOR_VIEW_SOURCE, "type: 'delete-table'");
      assert.include(SELECTOR_VIEW_SOURCE, "type: 'use-template'");
    });

    it('header sends save and navigation actions', () => {
      assert.include(HEADER_SOURCE, "type: 'save-table'");
      assert.include(HEADER_SOURCE, "type: 'close-table'");
      assert.include(HEADER_SOURCE, "type: 'close'");
    });

    it('table view sends execution actions', () => {
      assert.include(TABLE_VIEW_SOURCE, "type: 'run-all'");
      assert.include(TABLE_VIEW_SOURCE, "type: 'pause-execution'");
    });

    it('data table sends row and cell actions', () => {
      assert.include(DATA_TABLE_SOURCE, "type: 'run-agent-group'");
      assert.include(DATA_TABLE_SOURCE, "type: 'run-row'");
      assert.include(DATA_TABLE_SOURCE, "type: 'remove-entity'");
      assert.include(DATA_TABLE_SOURCE, "type: 'remove-agent-group'");
    });

    it('modals send create/add actions', () => {
      assert.include(CREATE_TABLE_MODAL_SOURCE, "type: 'create-table'");
      assert.include(ADD_ENTITY_MODAL_SOURCE, "type: 'add-entity'");
      assert.include(ADD_AGENT_MODAL_SOURCE, "type: 'add-agent-group'");
    });
  });

  // ==========================================================================
  // Bug Fix Verification Tests
  // ==========================================================================

  describe('bug fix: notification memory leak prevention', () => {
    it('NOTIFICATION_SOURCE imports useEffect for cleanup', () => {
      assert.include(NOTIFICATION_SOURCE, "import { useEffect } from 'preact/hooks'");
    });

    it('NOTIFICATION_SOURCE has cleanup effect in component', () => {
      assert.include(NOTIFICATION_SOURCE, 'useEffect(() => {');
      assert.include(NOTIFICATION_SOURCE, 'clearNotificationTimeout');
    });

    it('NOTIFICATION_SOURCE exports clearNotificationTimeout function', () => {
      assert.include(NOTIFICATION_SOURCE, 'export function clearNotificationTimeout');
    });

    it('NOTIFICATION_SOURCE clears timeout in cleanup', () => {
      assert.include(NOTIFICATION_SOURCE, 'clearTimeout(timeoutId)');
    });

    it('NOTIFICATION_SOURCE nullifies timeoutId after timeout fires', () => {
      assert.include(NOTIFICATION_SOURCE, 'timeoutId = null');
    });
  });

  describe('bug fix: OutputColumn ID generation', () => {
    it('ADD_AGENT_MODAL_SOURCE has generateId function', () => {
      assert.include(ADD_AGENT_MODAL_SOURCE, 'function generateId()');
    });

    it('ADD_AGENT_MODAL_SOURCE uses crypto.randomUUID with fallback', () => {
      assert.include(ADD_AGENT_MODAL_SOURCE, 'crypto.randomUUID');
      assert.include(ADD_AGENT_MODAL_SOURCE, 'Date.now().toString(36)');
    });

    it('ADD_AGENT_MODAL_SOURCE generates id for outputColumns', () => {
      assert.include(ADD_AGENT_MODAL_SOURCE, 'id: generateId()');
    });
  });

  describe('bug fix: URL.revokeObjectURL timing', () => {
    it('TABLE_VIEW_SOURCE delays URL.revokeObjectURL with setTimeout', () => {
      assert.include(TABLE_VIEW_SOURCE, 'setTimeout(() => URL.revokeObjectURL');
    });

    it('TABLE_VIEW_SOURCE has appropriate delay for download initiation', () => {
      // The delay should be at least 100ms to ensure download starts
      assert.include(TABLE_VIEW_SOURCE, 'revokeObjectURL(url), 100)');
    });
  });
});
