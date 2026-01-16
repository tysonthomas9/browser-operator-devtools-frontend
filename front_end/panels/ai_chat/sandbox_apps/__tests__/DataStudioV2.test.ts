// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for Data Studio v2 sandbox app template
 */

import {VFSManager} from '../vfs/VFSManager.js';
import {getDataStudioFiles} from '../apps/data-studio/sources.js';

describe('ai_chat: Data Studio v2', () => {
  let vfs: VFSManager;

  // Get source files from getDataStudioFiles()
  const files = getDataStudioFiles();
  const INDEX_TSX_SOURCE = files['/src/index.tsx'];
  const TYPES_TS_SOURCE = files['/src/types.ts'];
  const STORE_TS_SOURCE = files['/src/store.ts'];
  const BRIDGE_TS_SOURCE = files['/src/bridge.ts'];
  const APP_TSX_SOURCE = files['/src/App.tsx'];
  const COMPONENTS_HEADER_TSX_SOURCE = files['/src/components/Header.tsx'];
  const COMPONENTS_SELECTORVIEW_TSX_SOURCE = files['/src/components/SelectorView.tsx'];
  const COMPONENTS_TABLEVIEW_TSX_SOURCE = files['/src/components/TableView.tsx'];
  const COMPONENTS_DATATABLE_TSX_SOURCE = files['/src/components/DataTable.tsx'];
  const COMPONENTS_ICONS_TSX_SOURCE = files['/src/components/Icons.tsx'];
  const COMPONENTS_MODALS_TS_SOURCE = files['/src/components/modals.ts'];
  const COMPONENTS_CREATETABLEMODAL_TSX_SOURCE = files['/src/components/CreateTableModal.tsx'];
  const COMPONENTS_ADDENTITYMODAL_TSX_SOURCE = files['/src/components/AddEntityModal.tsx'];
  const COMPONENTS_ADDAGENTMODAL_TSX_SOURCE = files['/src/components/AddAgentModal.tsx'];
  const COMPONENTS_CELLDETAILMODAL_TSX_SOURCE = files['/src/components/CellDetailModal.tsx'];
  const COMPONENTS_NOTIFICATION_TSX_SOURCE = files['/src/components/Notification.tsx'];
  const STYLES_CSS_SOURCE = files['/src/styles.css'];

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
    it('INDEX_TSX_SOURCE contains React 18 render', () => {
      assert.include(INDEX_TSX_SOURCE, 'createRoot');
      assert.include(INDEX_TSX_SOURCE, 'react-dom/client');
      assert.include(INDEX_TSX_SOURCE, '<App />');
    });

    it('TYPES_TS_SOURCE contains DataTable interface', () => {
      assert.include(TYPES_TS_SOURCE, 'interface DataTable');
      assert.include(TYPES_TS_SOURCE, 'entities:');
      assert.include(TYPES_TS_SOURCE, 'agentGroups:');
      assert.include(TYPES_TS_SOURCE, 'results:');
    });

    it('TYPES_TS_SOURCE contains Entity interface', () => {
      assert.include(TYPES_TS_SOURCE, 'interface Entity');
      assert.include(TYPES_TS_SOURCE, 'id: string');
      assert.include(TYPES_TS_SOURCE, 'name: string');
    });

    it('TYPES_TS_SOURCE contains AgentGroup interface', () => {
      assert.include(TYPES_TS_SOURCE, 'interface AgentGroup');
      assert.include(TYPES_TS_SOURCE, 'agentName');
      assert.include(TYPES_TS_SOURCE, 'queryTemplate:');
      assert.include(TYPES_TS_SOURCE, 'outputColumns:');
    });

    it('TYPES_TS_SOURCE contains CellResult interface', () => {
      assert.include(TYPES_TS_SOURCE, 'interface CellResult');
      assert.include(TYPES_TS_SOURCE, 'pending');
      assert.include(TYPES_TS_SOURCE, 'running');
      assert.include(TYPES_TS_SOURCE, 'completed');
      assert.include(TYPES_TS_SOURCE, 'error');
    });

    it('STORE_TS_SOURCE uses Zustand for state management', () => {
      assert.include(STORE_TS_SOURCE, 'import { create }');
      assert.include(STORE_TS_SOURCE, 'zustand');
    });

    it('STORE_TS_SOURCE exports state management functions', () => {
      assert.include(STORE_TS_SOURCE, 'export const');
      assert.include(STORE_TS_SOURCE, 'setState');
      assert.include(STORE_TS_SOURCE, 'setCurrentTable');
      assert.include(STORE_TS_SOURCE, 'updateCellResult');
      assert.include(STORE_TS_SOURCE, 'addEntity');
      assert.include(STORE_TS_SOURCE, 'removeEntity');
      assert.include(STORE_TS_SOURCE, 'addAgentGroup');
      assert.include(STORE_TS_SOURCE, 'removeAgentGroup');
    });

    it('BRIDGE_TS_SOURCE handles sandbox communication', () => {
      assert.include(BRIDGE_TS_SOURCE, '__sandbox');
      assert.include(BRIDGE_TS_SOURCE, 'sendAction');
      assert.include(BRIDGE_TS_SOURCE, 'handleMessage');
      assert.include(BRIDGE_TS_SOURCE, 'initBridge');
    });

    it('BRIDGE_TS_SOURCE handles message types', () => {
      assert.include(BRIDGE_TS_SOURCE, 'state-update');
      assert.include(BRIDGE_TS_SOURCE, 'set-table');
      assert.include(BRIDGE_TS_SOURCE, 'update-cell');
      assert.include(BRIDGE_TS_SOURCE, 'entity-added');
      assert.include(BRIDGE_TS_SOURCE, 'agent-group-added');
    });

    it('APP_TSX_SOURCE imports all major components', () => {
      assert.include(APP_TSX_SOURCE, 'import { Header }');
      assert.include(APP_TSX_SOURCE, 'import { SelectorView }');
      assert.include(APP_TSX_SOURCE, 'import { TableView }');
      assert.include(APP_TSX_SOURCE, 'CreateTableModal');
      assert.include(APP_TSX_SOURCE, 'AddEntityModal');
      assert.include(APP_TSX_SOURCE, 'AddAgentModal');
    });

    it('COMPONENTS_HEADER_TSX_SOURCE contains navigation elements', () => {
      assert.include(COMPONENTS_HEADER_TSX_SOURCE, 'Data Studio');
      assert.include(COMPONENTS_HEADER_TSX_SOURCE, 'handleSave');
      assert.include(COMPONENTS_HEADER_TSX_SOURCE, 'handleBack');
      assert.include(COMPONENTS_HEADER_TSX_SOURCE, 'handleClose');
    });

    it('COMPONENTS_SELECTORVIEW_TSX_SOURCE contains table and template lists', () => {
      assert.include(COMPONENTS_SELECTORVIEW_TSX_SOURCE, 'Your Tables');
      assert.include(COMPONENTS_SELECTORVIEW_TSX_SOURCE, 'Start from Template');
      assert.include(COMPONENTS_SELECTORVIEW_TSX_SOURCE, 'Create Custom Table');
      assert.include(COMPONENTS_SELECTORVIEW_TSX_SOURCE, 'handleLoadTable');
      assert.include(COMPONENTS_SELECTORVIEW_TSX_SOURCE, 'handleDeleteTable');
    });

    it('COMPONENTS_TABLEVIEW_TSX_SOURCE contains action bar elements', () => {
      assert.include(COMPONENTS_TABLEVIEW_TSX_SOURCE, 'Entity Type');
      assert.include(COMPONENTS_TABLEVIEW_TSX_SOURCE, 'Add Agent');
      assert.include(COMPONENTS_TABLEVIEW_TSX_SOURCE, 'Run All');
      assert.include(COMPONENTS_TABLEVIEW_TSX_SOURCE, 'Export');
    });

    it('COMPONENTS_DATATABLE_TSX_SOURCE renders table structure', () => {
      assert.include(COMPONENTS_DATATABLE_TSX_SOURCE, '<table');
      assert.include(COMPONENTS_DATATABLE_TSX_SOURCE, '<thead>');
      assert.include(COMPONENTS_DATATABLE_TSX_SOURCE, '<tbody>');
      assert.include(COMPONENTS_DATATABLE_TSX_SOURCE, 'ResultCell');
    });

    it('COMPONENTS_ICONS_TSX_SOURCE exports icon components', () => {
      assert.include(COMPONENTS_ICONS_TSX_SOURCE, 'export function TableIcon');
      assert.include(COMPONENTS_ICONS_TSX_SOURCE, 'export function PlayIcon');
      assert.include(COMPONENTS_ICONS_TSX_SOURCE, 'export function PauseIcon');
      assert.include(COMPONENTS_ICONS_TSX_SOURCE, 'export function SaveIcon');
      assert.include(COMPONENTS_ICONS_TSX_SOURCE, 'export function TrashIcon');
    });

    it('COMPONENTS_MODALS_TS_SOURCE manages modal state', () => {
      assert.include(COMPONENTS_MODALS_TS_SOURCE, 'activeModal');
      assert.include(COMPONENTS_MODALS_TS_SOURCE, 'openModal');
      assert.include(COMPONENTS_MODALS_TS_SOURCE, 'closeModal');
      assert.include(COMPONENTS_MODALS_TS_SOURCE, 'cellDetailData');
    });

    it('COMPONENTS_CREATETABLEMODAL_TSX_SOURCE has form fields', () => {
      assert.include(COMPONENTS_CREATETABLEMODAL_TSX_SOURCE, 'Table Name');
      assert.include(COMPONENTS_CREATETABLEMODAL_TSX_SOURCE, 'Entity Type');
      assert.include(COMPONENTS_CREATETABLEMODAL_TSX_SOURCE, 'Entity Name Column');
    });

    it('COMPONENTS_ADDENTITYMODAL_TSX_SOURCE has entity form', () => {
      assert.include(COMPONENTS_ADDENTITYMODAL_TSX_SOURCE, 'Name');
      assert.include(COMPONENTS_ADDENTITYMODAL_TSX_SOURCE, 'Additional Context');
      assert.include(COMPONENTS_ADDENTITYMODAL_TSX_SOURCE, 'addEntity');
    });

    it('COMPONENTS_ADDAGENTMODAL_TSX_SOURCE has agent configuration', () => {
      assert.include(COMPONENTS_ADDAGENTMODAL_TSX_SOURCE, 'Select Agent');
      assert.include(COMPONENTS_ADDAGENTMODAL_TSX_SOURCE, 'Query Template');
      assert.include(COMPONENTS_ADDAGENTMODAL_TSX_SOURCE, 'Output Columns');
      assert.include(COMPONENTS_ADDAGENTMODAL_TSX_SOURCE, '{entity}');
    });

    it('COMPONENTS_CELLDETAILMODAL_TSX_SOURCE shows cell content', () => {
      assert.include(COMPONENTS_CELLDETAILMODAL_TSX_SOURCE, 'Cell Detail');
      assert.include(COMPONENTS_CELLDETAILMODAL_TSX_SOURCE, 'Copy');
      assert.include(COMPONENTS_CELLDETAILMODAL_TSX_SOURCE, 'clipboard');
    });

    it('COMPONENTS_NOTIFICATION_TSX_SOURCE provides toast notifications', () => {
      assert.include(COMPONENTS_NOTIFICATION_TSX_SOURCE, 'showNotification');
      assert.include(COMPONENTS_NOTIFICATION_TSX_SOURCE, 'success');
      assert.include(COMPONENTS_NOTIFICATION_TSX_SOURCE, 'error');
    });

    it('STYLES_CSS_SOURCE contains Tailwind directives', () => {
      assert.include(STYLES_CSS_SOURCE, '@tailwind');
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
      assert.include(storeSource!, 'zustand');
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
      assert.include(APP_TSX_SOURCE, 'useEffect');
      assert.include(APP_TSX_SOURCE, 'initBridge');
    });

    it('components use shadcn UI imports', () => {
      assert.include(COMPONENTS_HEADER_TSX_SOURCE, "from '@/components/ui'");
      assert.include(COMPONENTS_SELECTORVIEW_TSX_SOURCE, "from '@/components/ui'");
      assert.include(COMPONENTS_TABLEVIEW_TSX_SOURCE, "from '@/components/ui'");
    });

    it('components use React hooks properly', () => {
      assert.include(APP_TSX_SOURCE, "from 'react'");
      assert.include(COMPONENTS_ADDAGENTMODAL_TSX_SOURCE, 'useState');
    });

    it('store uses Zustand for reactivity', () => {
      assert.include(STORE_TS_SOURCE, 'useDataStudioStore');
      assert.include(STORE_TS_SOURCE, 'devtools');
    });

    it('bridge declares global types', () => {
      assert.include(BRIDGE_TS_SOURCE, 'declare global');
      assert.include(BRIDGE_TS_SOURCE, 'interface Window');
      assert.include(BRIDGE_TS_SOURCE, '__sandbox');
    });
  });

  // ==========================================================================
  // Action Types Tests
  // ==========================================================================

  describe('action types', () => {
    it('bridge sends ready action', () => {
      assert.include(BRIDGE_TS_SOURCE, "'ready'");
    });

    it('bridge sends get-state action', () => {
      assert.include(BRIDGE_TS_SOURCE, "'get-state'");
    });

    it('selector view sends table actions', () => {
      assert.include(COMPONENTS_SELECTORVIEW_TSX_SOURCE, 'requestLoadTable');
      assert.include(COMPONENTS_SELECTORVIEW_TSX_SOURCE, 'requestDeleteTable');
      assert.include(COMPONENTS_SELECTORVIEW_TSX_SOURCE, 'requestUseTemplate');
    });

    it('header sends save and navigation actions', () => {
      assert.include(COMPONENTS_HEADER_TSX_SOURCE, 'requestSaveTable');
      assert.include(COMPONENTS_HEADER_TSX_SOURCE, 'requestGoBack');
    });

    it('table view sends execution actions', () => {
      assert.include(COMPONENTS_TABLEVIEW_TSX_SOURCE, 'requestRunAll');
      assert.include(COMPONENTS_TABLEVIEW_TSX_SOURCE, 'requestPauseExecution');
    });

    it('data table sends row and cell actions', () => {
      assert.include(COMPONENTS_DATATABLE_TSX_SOURCE, 'requestRunAgentGroup');
      assert.include(COMPONENTS_DATATABLE_TSX_SOURCE, 'requestRunRow');
      assert.include(COMPONENTS_DATATABLE_TSX_SOURCE, 'requestRemoveEntity');
      assert.include(COMPONENTS_DATATABLE_TSX_SOURCE, 'requestRemoveAgentGroup');
    });

    it('modals send create/add actions', () => {
      assert.include(COMPONENTS_CREATETABLEMODAL_TSX_SOURCE, 'requestCreateTable');
      assert.include(COMPONENTS_ADDENTITYMODAL_TSX_SOURCE, 'requestAddEntity');
      assert.include(COMPONENTS_ADDAGENTMODAL_TSX_SOURCE, 'requestAddAgentGroup');
    });
  });

  // ==========================================================================
  // Bug Fix Verification Tests
  // ==========================================================================

  describe('bug fix: notification memory leak prevention', () => {
    it('COMPONENTS_NOTIFICATION_TSX_SOURCE imports useEffect for cleanup', () => {
      assert.include(COMPONENTS_NOTIFICATION_TSX_SOURCE, "import { useEffect }");
    });

    it('COMPONENTS_NOTIFICATION_TSX_SOURCE has cleanup effect in component', () => {
      assert.include(COMPONENTS_NOTIFICATION_TSX_SOURCE, 'useEffect(() => {');
      assert.include(COMPONENTS_NOTIFICATION_TSX_SOURCE, 'clearNotificationTimeout');
    });

    it('COMPONENTS_NOTIFICATION_TSX_SOURCE exports clearNotificationTimeout function', () => {
      assert.include(COMPONENTS_NOTIFICATION_TSX_SOURCE, 'export function clearNotificationTimeout');
    });

    it('COMPONENTS_NOTIFICATION_TSX_SOURCE clears timeout in cleanup', () => {
      assert.include(COMPONENTS_NOTIFICATION_TSX_SOURCE, 'clearTimeout(timeoutId)');
    });

    it('COMPONENTS_NOTIFICATION_TSX_SOURCE nullifies timeoutId after timeout fires', () => {
      assert.include(COMPONENTS_NOTIFICATION_TSX_SOURCE, 'timeoutId = null');
    });
  });

  describe('bug fix: OutputColumn ID generation', () => {
    it('COMPONENTS_ADDAGENTMODAL_TSX_SOURCE has generateId function', () => {
      assert.include(COMPONENTS_ADDAGENTMODAL_TSX_SOURCE, 'function generateId()');
    });

    it('COMPONENTS_ADDAGENTMODAL_TSX_SOURCE uses crypto.randomUUID with fallback', () => {
      assert.include(COMPONENTS_ADDAGENTMODAL_TSX_SOURCE, 'crypto.randomUUID');
      assert.include(COMPONENTS_ADDAGENTMODAL_TSX_SOURCE, 'Date.now().toString(36)');
    });

    it('COMPONENTS_ADDAGENTMODAL_TSX_SOURCE generates id for outputColumns', () => {
      assert.include(COMPONENTS_ADDAGENTMODAL_TSX_SOURCE, 'id: generateId()');
    });
  });

  describe('bug fix: URL.revokeObjectURL timing', () => {
    it('COMPONENTS_TABLEVIEW_TSX_SOURCE delays URL.revokeObjectURL with setTimeout', () => {
      assert.include(COMPONENTS_TABLEVIEW_TSX_SOURCE, 'setTimeout(() => URL.revokeObjectURL');
    });

    it('COMPONENTS_TABLEVIEW_TSX_SOURCE has appropriate delay for download initiation', () => {
      // The delay should be at least 100ms to ensure download starts
      assert.include(COMPONENTS_TABLEVIEW_TSX_SOURCE, 'revokeObjectURL(url), 100)');
    });
  });
});
