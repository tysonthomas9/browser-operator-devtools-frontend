import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { DataStudioState, DataTable, Entity, AgentGroup, CellResult, Template, OutputColumn, InlineAgentConfig } from './types';
import { sendAction } from './bridge';

// Templates (kept for initial display before server connection)
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
        agentName: 'research_agent',
        queryTemplate: 'Research {entity} and analyze their market position, key strengths, weaknesses, and recent news',
        outputColumns: [
          { id: 'col-1', key: 'summary', label: 'Summary' },
          { id: 'col-2', key: 'strengths', label: 'Strengths' },
          { id: 'col-3', key: 'weaknesses', label: 'Weaknesses' },
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
        agentName: 'research_agent',
        queryTemplate: 'Research {entity} and list key features, specifications, price, and user reviews',
        outputColumns: [
          { id: 'col-1', key: 'features', label: 'Key Features' },
          { id: 'col-2', key: 'price', label: 'Price' },
          { id: 'col-3', key: 'verdict', label: 'Verdict' },
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
        agentName: 'research_agent',
        queryTemplate: 'Research {entity} and provide a lead qualification score based on company size, industry, and potential fit',
        outputColumns: [
          { id: 'col-1', key: 'score', label: 'Lead Score' },
          { id: 'col-2', key: 'company_size', label: 'Company Size' },
          { id: 'col-3', key: 'decision_maker', label: 'Decision Maker' },
        ],
      },
    ],
  },
];

// Store interface - Server-First Architecture
// - Setters: Only called by handleMessage() from server
// - Requests: Send actions to server, don't update local state
interface DataStudioStore extends DataStudioState {
  // === SERVER-DRIVEN SETTERS (called by bridge.handleMessage) ===
  setState: (partial: Partial<DataStudioState>) => void;
  setCurrentTable: (table: DataTable | null) => void;
  updateCellResult: (entityId: string, agentGroupId: string, result: CellResult) => void;
  addEntity: (entity: Entity) => void;
  removeEntity: (entityId: string) => void;
  addAgentGroup: (agentGroup: AgentGroup) => void;
  removeAgentGroup: (agentGroupId: string) => void;

  // === REQUEST FUNCTIONS (send to server, server updates state) ===
  requestUseTemplate: (templateId: string, tableName: string) => void;
  requestCreateTable: (tableName: string, entityType: string, entityNameLabel: string) => void;
  requestAddEntity: (name: string, context?: string) => void;
  requestRemoveEntity: (entityId: string) => void;
  requestAddAgentGroup: (agentName: string, queryTemplate: string, outputColumns: OutputColumn[]) => void;
  requestAddInlineAgentGroup: (inlineAgent: InlineAgentConfig, queryTemplate: string, outputColumns: OutputColumn[]) => void;
  requestRemoveAgentGroup: (agentGroupId: string) => void;
  requestGoBack: () => void;
  requestLoadTable: (tableId: string) => void;
  requestDeleteTable: (tableId: string) => void;
  requestSaveTable: () => void;
  requestRunRow: (entityId: string) => void;
  requestRunAll: () => void;
  requestRunAgentGroup: (entityId: string, agentGroupId: string) => void;
  requestPauseExecution: () => void;
}

// Create Zustand store with Server-First Architecture
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

      // === SERVER-DRIVEN SETTERS ===
      // These are called by bridge.handleMessage() when server sends state updates

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

      // === REQUEST FUNCTIONS ===
      // These send actions to the server. Server will respond and trigger setters above.

      requestUseTemplate: (templateId, tableName) => {
        sendAction({ action: 'use-template', templateId, tableName });
      },

      requestCreateTable: (tableName, entityType, entityNameLabel) => {
        sendAction({ action: 'create-table', tableName, entityType, entityNameLabel });
      },

      requestAddEntity: (name, context) => {
        sendAction({ action: 'add-entity', name, context: context || '' });
      },

      requestRemoveEntity: (entityId) => {
        sendAction({ action: 'remove-entity', entityId });
      },

      requestAddAgentGroup: (agentName, queryTemplate, outputColumns) => {
        sendAction({ action: 'add-agent-group', agentName, queryTemplate, outputColumns });
      },

      requestAddInlineAgentGroup: (inlineAgent, queryTemplate, outputColumns) => {
        sendAction({ action: 'add-agent-group', inlineAgent, queryTemplate, outputColumns });
      },

      requestRemoveAgentGroup: (agentGroupId) => {
        sendAction({ action: 'remove-agent-group', agentGroupId });
      },

      requestGoBack: () => {
        sendAction({ action: 'go-back' });
      },

      requestLoadTable: (tableId) => {
        sendAction({ action: 'load-table', tableId });
      },

      requestDeleteTable: (tableId) => {
        sendAction({ action: 'delete-table', tableId });
      },

      requestSaveTable: () => {
        sendAction({ action: 'save-table' });
      },

      requestRunRow: (entityId) => {
        sendAction({ action: 'run-row', entityId });
      },

      requestRunAll: () => {
        sendAction({ action: 'run-all' });
      },

      requestRunAgentGroup: (entityId, agentGroupId) => {
        sendAction({ action: 'run-agent-group', entityId, agentGroupId });
      },

      requestPauseExecution: () => {
        sendAction({ action: 'pause-execution' });
      },
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

// Server-driven setter exports (for bridge.handleMessage)
export const setState = (partial: Partial<DataStudioState>) => useDataStudioStore.getState().setState(partial);
export const setCurrentTable = (table: DataTable | null) => useDataStudioStore.getState().setCurrentTable(table);
export const updateCellResult = (entityId: string, agentGroupId: string, result: CellResult) =>
  useDataStudioStore.getState().updateCellResult(entityId, agentGroupId, result);
export const addEntity = (entity: Entity) => useDataStudioStore.getState().addEntity(entity);
export const removeEntity = (entityId: string) => useDataStudioStore.getState().removeEntity(entityId);
export const addAgentGroup = (agentGroup: AgentGroup) => useDataStudioStore.getState().addAgentGroup(agentGroup);
export const removeAgentGroup = (agentGroupId: string) => useDataStudioStore.getState().removeAgentGroup(agentGroupId);

// Request function exports (for components that can't use hooks)
export const requestUseTemplate = (templateId: string, tableName: string) =>
  useDataStudioStore.getState().requestUseTemplate(templateId, tableName);
export const requestCreateTable = (tableName: string, entityType: string, entityNameLabel: string) =>
  useDataStudioStore.getState().requestCreateTable(tableName, entityType, entityNameLabel);
export const requestGoBack = () => useDataStudioStore.getState().requestGoBack();
