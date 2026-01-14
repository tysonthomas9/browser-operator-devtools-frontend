// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Data Studio v2 - Sandbox App Template
 *
 * A fully functional data studio app built with React 18 and Zustand
 * using the sandbox_apps architecture. Features:
 * - Table-based data management with entities and agent columns
 * - Template system for quick starts
 * - Agent execution with result tracking
 * - Export functionality
 *
 * Communication with DevTools:
 * - App -> DevTools: window.__sandbox.sendAction(action)
 * - DevTools -> App: window.__sandbox_onMessage(message)
 */

import type {VirtualFileMap} from '../../types/SandboxTypes.js';

// =============================================================================
// Entry Point
// =============================================================================

export const INDEX_SOURCE = `import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
`;

// =============================================================================
// Types
// =============================================================================

export const TYPES_SOURCE = `// Data Studio Types

export interface DataTable {
  id: string;
  name: string;
  entityType: string;
  entityNameLabel: string;
  entities: Entity[];
  agentGroups: AgentGroup[];
  results: Record<string, Record<string, CellResult>>;
  createdAt: string;
  modifiedAt: string;
}

export interface Entity {
  id: string;
  name: string;
  context?: string;
}

export interface AgentGroup {
  id: string;
  agentName: string;
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
}

export interface Template {
  id: string;
  name: string;
  description: string;
  entityType: string;
  entityNameLabel: string;
  defaultEntities?: string[];
  defaultAgents?: Array<{
    agentName: string;
    queryTemplate: string;
    outputColumns: OutputColumn[];
  }>;
}

export interface DataStudioState {
  view: 'selector' | 'table';
  tables: Array<{ id: string; name: string; entityType: string }>;
  templates: Template[];
  currentTable: DataTable | null;
  availableAgents: Array<{ name: string; description: string }>;
  isRunning: boolean;
}
`;

// =============================================================================
// State Store
// =============================================================================

export const STORE_SOURCE = `import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { DataStudioState, DataTable, Entity, AgentGroup, CellResult, Template } from './types';

// Templates
const TEMPLATES: Template[] = [
  {
    id: 'competitor_analysis',
    name: 'Competitor Analysis',
    description: 'Analyze competitors in your market',
    entityType: 'Competitor',
    entityNameLabel: 'Company Name',
    defaultEntities: ['OpenAI', 'Google DeepMind', 'Anthropic'],
    defaultAgents: [
      {
        agentName: 'search_agent',
        queryTemplate: 'Research {entity} and analyze their market position, key strengths, weaknesses, and recent news',
        outputColumns: [
          { key: 'summary', label: 'Summary' },
          { key: 'strengths', label: 'Strengths' },
          { key: 'weaknesses', label: 'Weaknesses' },
        ],
      },
    ],
  },
  {
    id: 'product_research',
    name: 'Product Research',
    description: 'Research and compare products',
    entityType: 'Product',
    entityNameLabel: 'Product Name',
    defaultEntities: ['iPhone 17 Pro', 'Samsung Galaxy S25', 'Google Pixel 10'],
    defaultAgents: [
      {
        agentName: 'search_agent',
        queryTemplate: 'Research {entity} and list key features, specifications, price, and user reviews',
        outputColumns: [
          { key: 'features', label: 'Key Features' },
          { key: 'price', label: 'Price' },
          { key: 'verdict', label: 'Verdict' },
        ],
      },
    ],
  },
  {
    id: 'lead_qualification',
    name: 'Lead Qualification',
    description: 'Qualify and score sales leads',
    entityType: 'Lead',
    entityNameLabel: 'Company/Contact',
    defaultEntities: ['Acme Corp', 'StartupXYZ', 'MegaTech Inc'],
    defaultAgents: [
      {
        agentName: 'search_agent',
        queryTemplate: 'Research {entity} and provide a lead qualification score based on company size, industry, and potential fit',
        outputColumns: [
          { key: 'score', label: 'Lead Score' },
          { key: 'company_size', label: 'Company Size' },
          { key: 'decision_maker', label: 'Decision Maker' },
        ],
      },
    ],
  },
];

// Store interface with actions
interface DataStudioStore extends DataStudioState {
  // Actions
  setState: (partial: Partial<DataStudioState>) => void;
  setCurrentTable: (table: DataTable | null) => void;
  updateCellResult: (entityId: string, agentGroupId: string, result: CellResult) => void;
  addEntity: (entity: Entity) => void;
  removeEntity: (entityId: string) => void;
  addAgentGroup: (agentGroup: AgentGroup) => void;
  removeAgentGroup: (agentGroupId: string) => void;
  createTable: (name: string, entityType: string, entityNameLabel: string) => void;
  useTemplate: (templateId: string, tableName: string) => void;
  goBack: () => void;
}

// Create Zustand store
export const useDataStudioStore = create<DataStudioStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      view: 'selector',
      tables: [],
      templates: TEMPLATES,
      currentTable: null,
      availableAgents: [],
      isRunning: false,

      // Actions
      setState: (partial) => set(partial, false, 'setState'),

      setCurrentTable: (table) => set(
        { currentTable: table, view: table ? 'table' : 'selector' },
        false, 'setCurrentTable'
      ),

      updateCellResult: (entityId, agentGroupId, result) => {
        const { currentTable } = get();
        if (!currentTable) return;

        const newResults = { ...currentTable.results };
        if (!newResults[entityId]) {
          newResults[entityId] = {};
        }
        newResults[entityId] = { ...newResults[entityId], [agentGroupId]: result };

        set(
          { currentTable: { ...currentTable, results: newResults } },
          false, 'updateCellResult'
        );
      },

      addEntity: (entity) => {
        const { currentTable } = get();
        if (!currentTable) return;

        set(
          { currentTable: { ...currentTable, entities: [...currentTable.entities, entity] } },
          false, 'addEntity'
        );
      },

      removeEntity: (entityId) => {
        const { currentTable } = get();
        if (!currentTable) return;

        const newResults = { ...currentTable.results };
        delete newResults[entityId];

        set(
          {
            currentTable: {
              ...currentTable,
              entities: currentTable.entities.filter(e => e.id !== entityId),
              results: newResults,
            }
          },
          false, 'removeEntity'
        );
      },

      addAgentGroup: (agentGroup) => {
        const { currentTable } = get();
        if (!currentTable) return;

        set(
          { currentTable: { ...currentTable, agentGroups: [...currentTable.agentGroups, agentGroup] } },
          false, 'addAgentGroup'
        );
      },

      removeAgentGroup: (agentGroupId) => {
        const { currentTable } = get();
        if (!currentTable) return;

        // Remove results for this agent group
        const newResults: Record<string, Record<string, CellResult>> = {};
        for (const [entityId, agentResults] of Object.entries(currentTable.results)) {
          const filtered = { ...agentResults };
          delete filtered[agentGroupId];
          if (Object.keys(filtered).length > 0) {
            newResults[entityId] = filtered;
          }
        }

        set(
          {
            currentTable: {
              ...currentTable,
              agentGroups: currentTable.agentGroups.filter(ag => ag.id !== agentGroupId),
              results: newResults,
            }
          },
          false, 'removeAgentGroup'
        );
      },

      createTable: (name, entityType, entityNameLabel) => {
        const { tables } = get();
        const newTable: DataTable = {
          id: 'table-' + Date.now(),
          name,
          entityType,
          entityNameLabel,
          entities: [],
          agentGroups: [],
          results: {},
        };

        set(
          {
            tables: [...tables, { id: newTable.id, name, entityType }],
            currentTable: newTable,
            view: 'table',
          },
          false, 'createTable'
        );
      },

      useTemplate: (templateId, tableName) => {
        const { tables, templates } = get();
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        const newTable: DataTable = {
          id: 'table-' + Date.now(),
          name: tableName,
          entityType: template.entityType,
          entityNameLabel: template.entityNameLabel,
          entities: (template.defaultEntities || []).map((name, i) => ({
            id: 'entity-' + i,
            name,
            context: '',
          })),
          agentGroups: (template.defaultAgents || []).map((ag, i) => ({
            id: 'ag-' + i,
            agentName: ag.agentName,
            queryTemplate: ag.queryTemplate,
            outputColumns: ag.outputColumns,
          })),
          results: {},
        };

        set(
          {
            tables: [...tables, { id: newTable.id, name: tableName, entityType: template.entityType }],
            currentTable: newTable,
            view: 'table',
          },
          false, 'useTemplate'
        );
      },

      goBack: () => set({ currentTable: null, view: 'selector' }, false, 'goBack'),
    }),
    { name: 'DataStudio' }
  )
);

// Selectors for computed values (use with shallow comparison)
export const selectCurrentTable = (state: DataStudioStore) => state.currentTable;
export const selectIsTableView = (state: DataStudioStore) => state.view === 'table' && state.currentTable !== null;

// Legacy exports for backward compatibility (used by bridge)
export const state = { get value() { return useDataStudioStore.getState(); } };
export const currentTable = { get value() { return useDataStudioStore.getState().currentTable; } };
export const isTableView = { get value() { return selectIsTableView(useDataStudioStore.getState()); } };

// Action exports for bridge
export const setState = (partial: Partial<DataStudioState>) => useDataStudioStore.getState().setState(partial);
export const setCurrentTable = (table: DataTable | null) => useDataStudioStore.getState().setCurrentTable(table);
export const updateCellResult = (entityId: string, agentGroupId: string, result: CellResult) =>
  useDataStudioStore.getState().updateCellResult(entityId, agentGroupId, result);
export const addEntity = (entity: Entity) => useDataStudioStore.getState().addEntity(entity);
export const removeEntity = (entityId: string) => useDataStudioStore.getState().removeEntity(entityId);
export const addAgentGroup = (agentGroup: AgentGroup) => useDataStudioStore.getState().addAgentGroup(agentGroup);
export const removeAgentGroup = (agentGroupId: string) => useDataStudioStore.getState().removeAgentGroup(agentGroupId);
export const createTable = (name: string, entityType: string, entityNameLabel: string) =>
  useDataStudioStore.getState().createTable(name, entityType, entityNameLabel);
export const useTemplate = (templateId: string, tableName: string) =>
  useDataStudioStore.getState().useTemplate(templateId, tableName);
export const goBack = () => useDataStudioStore.getState().goBack();
`;

// =============================================================================
// Bridge - Communication with DevTools
// =============================================================================

export const BRIDGE_SOURCE = `import { setState, setCurrentTable, updateCellResult, addEntity, removeEntity, addAgentGroup, removeAgentGroup } from './store';
import type { DataTable, Entity, AgentGroup, CellResult } from './types';

// Send action to DevTools
export function sendAction(action: Record<string, unknown>) {
  console.log('[DataStudio] Sending action:', action);
  if (window.__sandbox?.sendAction) {
    window.__sandbox.sendAction(action);
  } else {
    console.warn('[DataStudio] Sandbox bridge not available');
  }
}

// Handle messages from DevTools
export function handleMessage(message: { type: string; payload?: unknown }) {
  console.log('[DataStudio] Received message:', message);

  switch (message.type) {
    case 'init':
      // Handle init message from SandboxProtocol.sendInit()
      if (message.payload) {
        const payload = message.payload as { state?: Record<string, unknown> };
        if (payload.state) {
          setState(payload.state as Parameters<typeof setState>[0]);
        }
      }
      break;

    case 'set-state':
      if (message.payload) {
        setState(message.payload as Parameters<typeof setState>[0]);
      }
      break;

    case 'data-update':
      // Handle data update at path from SandboxProtocol.sendDataUpdate()
      if (message.payload) {
        const { path, value } = message.payload as { path: string; value: unknown };
        // Parse path like "results/entityId/agentGroupId"
        const parts = path.split('/');
        if (parts[0] === 'results' && parts.length === 3) {
          updateCellResult(parts[1], parts[2], value as CellResult);
        }
      }
      break;

    case 'set-table':
      setCurrentTable(message.payload as DataTable | null);
      break;

    case 'update-cell':
      if (message.payload) {
        const { entityId, agentGroupId, result } = message.payload as {
          entityId: string;
          agentGroupId: string;
          result: CellResult;
        };
        updateCellResult(entityId, agentGroupId, result);
      }
      break;

    case 'entity-added':
      if (message.payload) {
        addEntity(message.payload as Entity);
      }
      break;

    case 'entity-removed':
      if (message.payload) {
        const { entityId } = message.payload as { entityId: string };
        removeEntity(entityId);
      }
      break;

    case 'agent-group-added':
      if (message.payload) {
        addAgentGroup(message.payload as AgentGroup);
      }
      break;

    case 'agent-group-removed':
      if (message.payload) {
        const { agentGroupId } = message.payload as { agentGroupId: string };
        removeAgentGroup(agentGroupId);
      }
      break;

    default:
      console.warn('[DataStudio] Unknown message type:', message.type);
  }
}

// Initialize bridge
export function initBridge() {
  // Set up message handler
  window.__sandbox_onMessage = handleMessage;

  // Set up execute callback (called by runtime for 'execute' messages from DevTools)
  // This is CRITICAL for agent execution to work:
  // 1. User clicks "Run" → SPA sends action to DevTools
  // 2. Controller sends 'execute' message back to SPA
  // 3. Runtime calls this callback
  // 4. We forward the action back to DevTools → Executor runs the agent
  window.__sandbox_onExecute = (action: string, args: Record<string, unknown>) => {
    console.log('[DataStudio] Executing:', action, args);
    sendAction({ type: action, ...args });
  };

  // Signal ready to DevTools
  sendAction({ type: 'ready' });

  // Request initial state
  sendAction({ type: 'get-state' });
}

// Type declarations for sandbox globals
declare global {
  interface Window {
    __sandbox?: {
      sendAction: (action: Record<string, unknown>) => void;
    };
    __sandbox_onMessage?: (message: { type: string; payload?: unknown }) => void;
    __sandbox_onExecute?: (action: string, args: Record<string, unknown>) => void;
  }
}
`;

// =============================================================================
// Main App Component
// =============================================================================

export const APP_SOURCE = `import { useEffect } from 'react';
import { useDataStudioStore, selectIsTableView } from './store';
import { initBridge } from './bridge';
import { Header } from './components/Header';
import { SelectorView } from './components/SelectorView';
import { TableView } from './components/TableView';
import { CreateTableModal } from './components/CreateTableModal';
import { AddEntityModal } from './components/AddEntityModal';
import { AddAgentModal } from './components/AddAgentModal';
import { CellDetailModal } from './components/CellDetailModal';
import { Notification } from './components/Notification';

export function App() {
  const showTable = useDataStudioStore(selectIsTableView);

  useEffect(() => {
    initBridge();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />

      <main className="flex-1 overflow-hidden">
        {showTable ? <TableView /> : <SelectorView />}
      </main>

      {/* Modals */}
      <CreateTableModal />
      <AddEntityModal />
      <AddAgentModal />
      <CellDetailModal />

      {/* Notifications */}
      <Notification />
    </div>
  );
}
`;

// =============================================================================
// Header Component
// =============================================================================

export const HEADER_SOURCE = `import { useDataStudioStore } from '../store';
import { sendAction } from '../bridge';
import { Button } from '@/components/ui';
import { TableIcon, SaveIcon, ArrowLeftIcon, XIcon } from './Icons';

export function Header() {
  const table = useDataStudioStore(state => state.currentTable);
  const view = useDataStudioStore(state => state.view);
  const goBack = useDataStudioStore(state => state.goBack);
  const isTableView = view === 'table';

  const handleSave = () => {
    sendAction({ type: 'save-table' });
  };

  const handleBack = () => {
    goBack();
  };

  const handleClose = () => {
    sendAction({ type: 'close' });
  };

  return (
    <header className="flex items-center justify-between px-5 py-3 bg-card border-b border-border">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-lg text-primary">
          <TableIcon className="w-5 h-5" />
        </div>
        <h1 className="text-base font-semibold">Data Studio</h1>
        {table && (
          <span className="text-sm text-muted-foreground pl-3 border-l border-border">
            {table.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isTableView && (
          <>
            <Button variant="outline" size="sm" onClick={handleSave}>
              <SaveIcon className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              Back
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" onClick={handleClose} title="Close">
          <XIcon className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
`;

// =============================================================================
// Selector View Component
// =============================================================================

export const SELECTOR_VIEW_SOURCE = `import { useDataStudioStore } from '../store';
import { sendAction } from '../bridge';
import { openModal } from './modals';
import { Button } from '@/components/ui';
import { FolderIcon, FileTextIcon, PlusIcon, TrashIcon } from './Icons';

export function SelectorView() {
  const tables = useDataStudioStore(state => state.tables);
  const templates = useDataStudioStore(state => state.templates);
  const useTemplateAction = useDataStudioStore(state => state.useTemplate);

  const handleLoadTable = (tableId: string) => {
    sendAction({ type: 'load-table', tableId });
  };

  const handleDeleteTable = (tableId: string) => {
    if (confirm('Delete this table?')) {
      sendAction({ type: 'delete-table', tableId });
    }
  };

  const handleUseTemplate = (templateId: string, templateName: string) => {
    const name = prompt('Enter a name for this table:', templateName + ' - ' + new Date().toLocaleDateString());
    if (name) {
      useTemplateAction(templateId, name);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Saved Tables */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FolderIcon className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Your Tables</h2>
          </div>

          {tables.length === 0 ? (
            <div className="text-center py-8 bg-muted/50 rounded-lg border border-dashed border-border text-muted-foreground">
              No saved tables yet. Create one to get started!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tables.map(table => (
                <div
                  key={table.id}
                  className="p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="font-medium mb-1">{table.name}</div>
                  <div className="text-xs text-muted-foreground mb-3">Entity: {table.entityType}</div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleLoadTable(table.id)}>Open</Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <hr className="border-border" />

        {/* Templates */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FileTextIcon className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Start from Template</h2>
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-8 bg-muted/50 rounded-lg border border-dashed border-border text-muted-foreground">
              No templates available
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => handleUseTemplate(template.id, template.name)}
                >
                  <div className="font-medium mb-1">{template.name}</div>
                  <div className="text-xs text-muted-foreground">{template.description}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Create Custom */}
        <section>
          <h2 className="text-sm font-semibold mb-4">Or Create Custom</h2>
          <Button size="lg" onClick={() => openModal('createTable')}>
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Custom Table
          </Button>
        </section>
      </div>
    </div>
  );
}
`;

// =============================================================================
// Table View Component
// =============================================================================

export const TABLE_VIEW_SOURCE = `import { useDataStudioStore } from '../store';
import { sendAction } from '../bridge';
import { openModal } from './modals';
import { Button } from '@/components/ui';
import { DataTable } from './DataTable';
import { UserPlusIcon, BotIcon, PlayIcon, PauseIcon, DownloadIcon, TableIcon } from './Icons';

export function TableView() {
  const table = useDataStudioStore(state => state.currentTable);
  const isRunning = useDataStudioStore(state => state.isRunning);
  if (!table) return null;
  const hasData = table.entities.length > 0 || table.agentGroups.length > 0;

  const handleRunAll = () => {
    sendAction({ type: 'run-all', currentTable: table });
  };

  const handlePause = () => {
    sendAction({ type: 'pause-execution' });
  };

  const handleExport = () => {
    const data = JSON.stringify(table, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (table.name || 'export') + '.json';
    a.click();
    // Delay revoke to ensure download initiates properly
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Entity Type: <strong className="text-foreground">{table.entityType}</strong>
          </span>
          <Button variant="outline" size="sm" onClick={() => openModal('addEntity')}>
            <UserPlusIcon className="w-4 h-4 mr-1" />
            Add {table.entityType}
          </Button>
          <Button variant="outline" size="sm" onClick={() => openModal('addAgent')}>
            <BotIcon className="w-4 h-4 mr-1" />
            Add Agent
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button variant="secondary" onClick={handlePause}>
              <PauseIcon className="w-4 h-4 mr-1" />
              Pause
            </Button>
          ) : (
            <Button onClick={handleRunAll}>
              <PlayIcon className="w-4 h-4 mr-1" />
              Run All
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <DownloadIcon className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-5 bg-muted/30">
        {hasData ? (
          <DataTable table={table} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 flex items-center justify-center bg-muted rounded-2xl mb-4 text-muted-foreground">
              <TableIcon className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No data yet</h3>
            <p className="text-muted-foreground">Add entities and agents to start analyzing</p>
          </div>
        )}
      </div>
    </div>
  );
}
`;

// =============================================================================
// Data Table Component
// =============================================================================

export const DATA_TABLE_SOURCE = `import { sendAction } from '../bridge';
import { openCellDetail } from './modals';
import type { DataTable as DataTableType, CellResult } from '../types';
import { PlayIcon, XIcon, TrashIcon } from './Icons';

interface DataTableProps {
  table: DataTableType;
}

export function DataTable({ table }: DataTableProps) {
  const handleRunAgentAll = (agentGroupId: string) => {
    for (const entity of table.entities) {
      sendAction({
        type: 'run-agent-group',
        entityId: entity.id,
        agentGroupId,
        currentTable: table,
      });
    }
  };

  const handleRemoveAgent = (agentGroupId: string) => {
    if (confirm('Remove this agent column?')) {
      sendAction({ type: 'remove-agent-group', agentGroupId });
    }
  };

  const handleRunRow = (entityId: string) => {
    sendAction({ type: 'run-row', entityId, currentTable: table });
  };

  const handleRemoveEntity = (entityId: string) => {
    if (confirm('Remove this entity?')) {
      sendAction({ type: 'remove-entity', entityId });
    }
  };

  const handleCellClick = (entityId: string, agentGroupId: string, result: CellResult) => {
    if (result.status === 'pending') {
      sendAction({ type: 'run-agent-group', entityId, agentGroupId, currentTable: table });
    } else {
      openCellDetail(entityId, agentGroupId, result);
    }
  };

  return (
    <div className="overflow-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse">
        <thead>
          {/* Agent group headers */}
          <tr>
            <th rowSpan={2} className="sticky left-0 top-0 z-20 bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-r border-border">
              {table.entityNameLabel}
            </th>
            {table.agentGroups.map(ag => (
              <th
                key={ag.id}
                colSpan={ag.outputColumns.length || 1}
                className="sticky top-0 z-10 bg-primary text-primary-foreground px-4 py-2 text-center text-sm font-medium border-b border-r border-primary-foreground/20"
              >
                <span>{ag.agentName}</span>
                <span className="inline-flex gap-1 ml-2">
                  <button
                    onClick={() => handleRunAgentAll(ag.id)}
                    className="p-1 hover:bg-primary-foreground/20 rounded"
                    title="Run all for this agent"
                  >
                    <PlayIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRemoveAgent(ag.id)}
                    className="p-1 hover:bg-primary-foreground/20 rounded"
                    title="Remove agent"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </span>
              </th>
            ))}
          </tr>

          {/* Column headers */}
          <tr>
            {table.agentGroups.map(ag => (
              ag.outputColumns.length === 0 ? (
                <th key={ag.id} className="sticky top-10 z-10 bg-primary/10 px-4 py-2 text-xs font-medium text-primary border-b border-r border-border">
                  Result
                </th>
              ) : (
                ag.outputColumns.map(col => (
                  <th key={col.id} className="sticky top-10 z-10 bg-primary/10 px-4 py-2 text-xs font-medium text-primary border-b border-r border-border">
                    {col.label}
                  </th>
                ))
              )
            ))}
          </tr>
        </thead>

        <tbody>
          {table.entities.map(entity => (
            <tr key={entity.id} className="hover:bg-muted/50">
              {/* Entity cell */}
              <td className="sticky left-0 z-10 bg-muted/70 px-4 py-3 border-b border-r border-border min-w-[160px]">
                <div className="font-medium text-sm">{entity.name}</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleRunRow(entity.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    <PlayIcon className="w-3 h-3" /> Run
                  </button>
                  <button
                    onClick={() => handleRemoveEntity(entity.id)}
                    className="inline-flex items-center p-1 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>

              {/* Result cells */}
              {table.agentGroups.map(ag => {
                const result = (table.results[entity.id] || {})[ag.id] || { status: 'pending' as const };

                if (ag.outputColumns.length === 0) {
                  return (
                    <ResultCell
                      key={ag.id}
                      result={result}
                      onClick={() => handleCellClick(entity.id, ag.id, result)}
                    />
                  );
                }

                return ag.outputColumns.map(col => (
                  <ResultCell
                    key={col.id}
                    result={result}
                    columnKey={col.key}
                    onClick={() => handleCellClick(entity.id, ag.id, result)}
                  />
                ));
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ResultCellProps {
  result: CellResult;
  columnKey?: string;
  onClick: () => void;
}

function ResultCell({ result, columnKey, onClick }: ResultCellProps) {
  let content: h.JSX.Element | string;
  let className = 'px-4 py-3 border-b border-r border-border text-sm cursor-pointer transition-colors min-w-[140px] max-w-[220px]';

  switch (result.status) {
    case 'pending':
      className += ' bg-muted/30 text-muted-foreground italic';
      content = 'Click to run';
      break;
    case 'running':
      className += ' bg-primary/10';
      content = (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Running...
        </span>
      );
      break;
    case 'error':
      className += ' bg-destructive/10 text-destructive';
      content = result.error || 'Error';
      break;
    case 'completed':
      className += ' hover:bg-primary/5';
      if (result.values) {
        const value = columnKey ? result.values[columnKey] : Object.values(result.values)[0];
        content = (
          <div className="line-clamp-3">{value || ''}</div>
        );
      } else {
        content = '';
      }
      break;
  }

  return (
    <td className={className} onClick={onClick}>
      {content}
    </td>
  );
}
`;

// =============================================================================
// Icons Component
// =============================================================================

export const ICONS_SOURCE = `
interface IconProps {
  className?: string;
}

export function TableIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>
    </svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export function SaveIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
    </svg>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
    </svg>
  );
}

export function FolderIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

export function FileTextIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

export function UserPlusIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  );
}

export function BotIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
    </svg>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}
`;

// =============================================================================
// Modal State Management
// =============================================================================

export const MODALS_SOURCE = `import { create } from 'zustand';
import type { CellResult } from '../types';

export type ModalType = 'createTable' | 'addEntity' | 'addAgent' | 'cellDetail' | null;

interface ModalStore {
  activeModal: ModalType;
  cellDetailData: {
    entityId: string;
    agentGroupId: string;
    result: CellResult;
  } | null;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  openCellDetail: (entityId: string, agentGroupId: string, result: CellResult) => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  activeModal: null,
  cellDetailData: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null, cellDetailData: null }),
  openCellDetail: (entityId, agentGroupId, result) => set({
    cellDetailData: { entityId, agentGroupId, result },
    activeModal: 'cellDetail',
  }),
}));

// Legacy exports for backward compatibility
export const activeModal = { get value() { return useModalStore.getState().activeModal; } };
export const cellDetailData = { get value() { return useModalStore.getState().cellDetailData; } };
export const openModal = (modal: ModalType) => useModalStore.getState().openModal(modal);
export const closeModal = () => useModalStore.getState().closeModal();
export const openCellDetail = (entityId: string, agentGroupId: string, result: CellResult) =>
  useModalStore.getState().openCellDetail(entityId, agentGroupId, result);
`;

// =============================================================================
// Create Table Modal
// =============================================================================

export const CREATE_TABLE_MODAL_SOURCE = `import { useState } from 'react';
import { activeModal, closeModal } from './modals';
import { createTable } from '../store';
import { Button, Input, Card } from '@/components/ui';
import { XIcon } from './Icons';

export function CreateTableModal() {
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityLabel, setEntityLabel] = useState('');

  if (activeModal.value !== 'createTable') return null;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!name.trim() || !entityType.trim() || !entityLabel.trim()) return;

    createTable(name.trim(), entityType.trim(), entityLabel.trim());

    setName('');
    setEntityType('');
    setEntityLabel('');
    closeModal();
  };

  const handleClose = () => {
    setName('');
    setEntityType('');
    setEntityLabel('');
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <Card className="w-full max-w-md mx-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Create New Table</h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Table Name</label>
            <Input
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="e.g., Q4 Competitor Analysis"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Entity Type</label>
            <Input
              value={entityType}
              onInput={(e) => setEntityType((e.target as HTMLInputElement).value)}
              placeholder="e.g., Competitor, Product, Lead"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Entity Name Column Label</label>
            <Input
              value={entityLabel}
              onInput={(e) => setEntityLabel((e.target as HTMLInputElement).value)}
              placeholder="e.g., Company Name, Product Name"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit">Create Table</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
`;

// =============================================================================
// Add Entity Modal
// =============================================================================

export const ADD_ENTITY_MODAL_SOURCE = `import { useState } from 'react';
import { activeModal, closeModal } from './modals';
import { sendAction } from '../bridge';
import { useDataStudioStore } from '../store';
import { Button, Input, Card } from '@/components/ui';
import { XIcon } from './Icons';

export function AddEntityModal() {
  const [name, setName] = useState('');
  const [context, setContext] = useState('');
  const table = useDataStudioStore(state => state.currentTable);

  if (activeModal.value !== 'addEntity' || !table) return null;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!name.trim()) return;

    sendAction({
      type: 'add-entity',
      name: name.trim(),
      context: context.trim() || undefined,
    });

    setName('');
    setContext('');
    closeModal();
  };

  const handleClose = () => {
    setName('');
    setContext('');
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <Card className="w-full max-w-md mx-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Add {table.entityType}</h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <Input
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="Enter name"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Additional Context (optional)</label>
            <textarea
              value={context}
              onInput={(e) => setContext((e.target as HTMLTextAreaElement).value)}
              placeholder="Any additional context for the AI agents..."
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
`;

// =============================================================================
// Add Agent Modal
// =============================================================================

export const ADD_AGENT_MODAL_SOURCE = `import { useState } from 'react';
import { activeModal, closeModal } from './modals';
import { sendAction } from '../bridge';
import { useDataStudioStore } from '../store';
import { Button, Input, Card } from '@/components/ui';
import { XIcon, PlusIcon } from './Icons';

interface OutputColumn {
  key: string;
  label: string;
}

function generateId(): string {
  return crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function AddAgentModal() {
  const [agentName, setAgentName] = useState('');
  const [queryTemplate, setQueryTemplate] = useState('');
  const [columns, setColumns] = useState<OutputColumn[]>([{ key: '', label: '' }]);
  const availableAgents = useDataStudioStore(state => state.availableAgents);

  if (activeModal.value !== 'addAgent') return null;

  const handleAddColumn = () => {
    setColumns([...columns, { key: '', label: '' }]);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== index));
  };

  const handleColumnChange = (index: number, field: 'key' | 'label', value: string) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    setColumns(newColumns);
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!agentName || !queryTemplate.trim()) return;

    const validColumns = columns.filter(c => c.key.trim() && c.label.trim());
    if (validColumns.length === 0) return;

    sendAction({
      type: 'add-agent-group',
      agentName,
      queryTemplate: queryTemplate.trim(),
      outputColumns: validColumns.map(c => ({
        id: generateId(),
        key: c.key.trim(),
        label: c.label.trim(),
      })),
    });

    handleClose();
  };

  const handleClose = () => {
    setAgentName('');
    setQueryTemplate('');
    setColumns([{ key: '', label: '' }]);
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-auto animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">Add Agent Column</h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Agent</label>
            <select
              value={agentName}
              onChange={(e) => setAgentName((e.target as HTMLSelectElement).value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">-- Select an agent --</option>
              {availableAgents.map(agent => (
                <option key={agent.name} value={agent.name}>{agent.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Query Template</label>
            <textarea
              value={queryTemplate}
              onInput={(e) => setQueryTemplate((e.target as HTMLTextAreaElement).value)}
              placeholder="e.g., Analyze {entity}'s market position and key features"
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">Use {'{entity}'} as a placeholder for the entity name</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Output Columns</label>
            <div className="space-y-2">
              {columns.map((col, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    value={col.key}
                    onInput={(e) => handleColumnChange(i, 'key', (e.target as HTMLInputElement).value)}
                    placeholder="Key (e.g., market_target)"
                    className="flex-1"
                  />
                  <Input
                    value={col.label}
                    onInput={(e) => handleColumnChange(i, 'label', (e.target as HTMLInputElement).value)}
                    placeholder="Label (e.g., Market Target)"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveColumn(i)}
                    disabled={columns.length <= 1}
                    className={columns.length <= 1 ? 'invisible' : ''}
                  >
                    <XIcon className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddColumn} className="mt-2">
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Column
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit">Add Agent</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
`;

// =============================================================================
// Cell Detail Modal
// =============================================================================

export const CELL_DETAIL_MODAL_SOURCE = `import { activeModal, closeModal, cellDetailData } from './modals';
import { Button, Card } from '@/components/ui';
import { XIcon, CopyIcon } from './Icons';

export function CellDetailModal() {
  if (activeModal.value !== 'cellDetail' || !cellDetailData.value) return null;

  const { result } = cellDetailData.value;

  let content = '';
  if (result.status === 'error') {
    content = 'Error: ' + (result.error || 'Unknown error');
  } else if (result.status === 'completed' && result.values) {
    content = Object.entries(result.values)
      .map(([k, v]) => k + ': ' + v)
      .join('\\n\\n');
  } else {
    content = 'Status: ' + result.status;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={closeModal}>
      <Card className="w-full max-w-lg mx-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Cell Detail</h2>
          <Button variant="ghost" size="icon" onClick={closeModal}>
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4">
          <pre className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap break-words max-h-80 overflow-auto font-mono">
            {content}
          </pre>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/50">
          <Button variant="outline" onClick={handleCopy}>
            <CopyIcon className="w-4 h-4 mr-1" />
            Copy
          </Button>
          <Button onClick={closeModal}>Close</Button>
        </div>
      </Card>
    </div>
  );
}
`;

// =============================================================================
// Notification Component
// =============================================================================

export const NOTIFICATION_SOURCE = `import { useEffect } from 'react';
import { create } from 'zustand';

interface NotificationData {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface NotificationStore {
  notification: NotificationData | null;
  setNotification: (data: NotificationData | null) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notification: null,
  setNotification: (data) => set({ notification: data }),
}));

let timeoutId: number | null = null;

export function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  useNotificationStore.getState().setNotification({ message, type });

  timeoutId = window.setTimeout(() => {
    useNotificationStore.getState().setNotification(null);
    timeoutId = null;
  }, 3000);
}

// Clear timeout on cleanup (prevents memory leak)
export function clearNotificationTimeout() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}

// Legacy export for backward compatibility
export const notification = { get value() { return useNotificationStore.getState().notification; } };

export function Notification() {
  const data = useNotificationStore(state => state.notification);

  // Cleanup timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      clearNotificationTimeout();
    };
  }, []);

  if (!data) return null;

  const bgColor = data.type === 'success'
    ? 'bg-green-600'
    : data.type === 'error'
      ? 'bg-red-600'
      : 'bg-gray-800';

  return (
    <div className={\`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-white font-medium shadow-lg z-50 animate-in fade-in slide-in-from-bottom-4 \${bgColor}\`}>
      {data.message}
    </div>
  );
}
`;

// =============================================================================
// Styles
// =============================================================================

export const STYLES_SOURCE = `/* Tailwind-compatible custom styles for Data Studio */

@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom animations */
@keyframes spin {
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Line clamp utility */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}
`;

// =============================================================================
// Get all Data Studio template files
// =============================================================================

export function getDataStudioFiles(): VirtualFileMap {
  return {
    '/src/index.tsx': INDEX_SOURCE,
    '/src/types.ts': TYPES_SOURCE,
    '/src/store.ts': STORE_SOURCE,
    '/src/bridge.ts': BRIDGE_SOURCE,
    '/src/App.tsx': APP_SOURCE,
    '/src/components/Header.tsx': HEADER_SOURCE,
    '/src/components/SelectorView.tsx': SELECTOR_VIEW_SOURCE,
    '/src/components/TableView.tsx': TABLE_VIEW_SOURCE,
    '/src/components/DataTable.tsx': DATA_TABLE_SOURCE,
    '/src/components/Icons.tsx': ICONS_SOURCE,
    '/src/components/modals.ts': MODALS_SOURCE,
    '/src/components/CreateTableModal.tsx': CREATE_TABLE_MODAL_SOURCE,
    '/src/components/AddEntityModal.tsx': ADD_ENTITY_MODAL_SOURCE,
    '/src/components/AddAgentModal.tsx': ADD_AGENT_MODAL_SOURCE,
    '/src/components/CellDetailModal.tsx': CELL_DETAIL_MODAL_SOURCE,
    '/src/components/Notification.tsx': NOTIFICATION_SOURCE,
    '/src/styles.css': STYLES_SOURCE,
  };
}
