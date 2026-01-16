import { setState, setCurrentTable, updateCellResult, addEntity, removeEntity, addAgentGroup, removeAgentGroup } from './store';
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
    // Unified state-update message format (canonical)
    case 'state-update': {
      if (message.payload) {
        const payload = message.payload as {
          type: 'init' | 'set-state' | 'saved';
          view?: string;
          currentTable?: unknown;
          tables?: unknown;
          templates?: unknown;
          availableAgents?: unknown;
          isRunning?: boolean;
        };
        // Extract state from payload, excluding the inner 'type'
        const { type: innerType, ...stateData } = payload;
        console.log('[DataStudio] State update:', innerType, stateData);
        setState(stateData as Parameters<typeof setState>[0]);
      }
      break;
    }

    // Legacy message formats (for backwards compatibility)
    case 'init': {
      // Handle init message - same structure as set-state
      const { type: _, ...stateData } = message as Record<string, unknown>;
      setState(stateData as Parameters<typeof setState>[0]);
      break;
    }

    case 'set-state': {
      // The message itself contains the state data (view, currentTable, tables, etc.)
      const { type: _, ...stateData } = message as Record<string, unknown>;
      setState(stateData as Parameters<typeof setState>[0]);
      break;
    }

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
    sendAction({ action: action, ...args });
  };

  // Signal ready to DevTools
  sendAction({ action: 'ready' });

  // Request initial state
  sendAction({ action: 'get-state' });
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
