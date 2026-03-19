# Dynamic Agent Management Implementation Plan

## Overview

This document outlines the implementation plan for allowing users to dynamically add, update, and delete base agents in the AI Chat UI.

## Current Architecture Analysis

The system currently has:
- **Hard-coded agents** in `AGENT_CONFIGS` (BaseOrchestratorAgent.ts:288-336)
- **Custom prompts** stored in localStorage (`ai_chat_custom_prompts`)
- **UI components** that reference `AGENT_CONFIGS` object
- **Agent dropdown selector** with basic add/edit/delete callbacks (AgentDropdownSelector.ts)

## Implementation Plan

### 1. Create Agent Storage Manager (`core/AgentConfigManager.ts`)

Manage both built-in and custom agents with localStorage persistence.

**Key Features:**
- LocalStorage key: `ai_chat_custom_agents`
- Merge built-in and custom agent configurations
- Validate agent configurations before saving
- Handle agent lifecycle (create, read, update, delete)
- Register/unregister agents with AgentDescriptorRegistry for tracing and evaluation
- Cross-tab synchronization via storage events

**Functions:**
```typescript
export class AgentConfigManager {
  // Get all custom agents from localStorage
  static getCustomAgents(): {[key: string]: CustomAgentConfig}

  // Get all agents (built-in + custom merged)
  static getAllAgents(): {[key: string]: AgentConfig}

  // Save or update a custom agent
  static saveCustomAgent(config: AgentConfig): void

  // Delete a custom agent
  static deleteCustomAgent(agentType: string): void

  // Validate agent configuration
  static validateAgentConfig(config: AgentConfig): ValidationResult

  // Check if agent is built-in
  static isBuiltInAgent(agentType: string): boolean

  // Clone a built-in agent as custom
  static cloneAgent(sourceType: string, newType: string): AgentConfig

  // Register agent descriptor for tracing/evaluation
  private static registerAgentDescriptor(config: AgentConfig): void

  // Unregister agent descriptor when deleted
  private static unregisterAgentDescriptor(agentType: string): void

  // Initialize storage event listener for cross-tab sync
  static initializeStorageSync(callback: () => void): void
}
```

### 2. Create Agent Editor Dialog (`ui/AgentEditorDialog.ts`)

New modal dialog component for creating and editing agents.

**Form Fields:**
- **Basic Information**
  - Agent Type (ID): Text input (read-only when editing)
  - Label: Text input
  - Description: Text input

- **Configuration**
  - System Prompt: Large textarea with markdown preview
  - Available Tools: Multi-select checklist from ToolRegistry

- **Actions**
  - Save: Validate and save agent
  - Cancel: Close without saving
  - Reset to Default: Only for built-in agents (restore default prompt)
  - Delete: Only for custom agents (with confirmation)
  - Clone as Custom: For built-in agents (save as new custom agent)

**UI Implementation:**
```typescript
export class AgentEditorDialog extends HTMLElement {
  private mode: 'create' | 'edit';
  private agentType: string | null;
  private config: AgentConfig | null;

  show(mode: 'create' | 'edit', agentType?: string): void
  close(): void

  private renderForm(): TemplateResult
  private handleSave(): void
  private handleDelete(): void
  private handleClone(): void
  private validateForm(): boolean
}
```

### 3. Update BaseOrchestratorAgent.ts

Modify to support dynamic agent loading.

**Changes:**
```typescript
// Change AGENT_CONFIGS from const to function
export function getAgentConfigs(): {[key: string]: AgentConfig} {
  const builtInConfigs = {
    [BaseOrchestratorAgentType.SEARCH]: { /* ... */ },
    [BaseOrchestratorAgentType.DEEP_RESEARCH]: { /* ... */ },
    // ... other built-in agents
  };

  // Merge with custom agents from AgentConfigManager
  const customAgents = AgentConfigManager.getCustomAgents();
  return { ...builtInConfigs, ...customAgents };
}

// Export built-in configs separately for reference
export const BUILT_IN_AGENT_CONFIGS = {
  [BaseOrchestratorAgentType.SEARCH]: { /* ... */ },
  [BaseOrchestratorAgentType.DEEP_RESEARCH]: { /* ... */ },
};

// Helper functions
export function isBuiltInAgent(agentType: string): boolean
export function createCustomAgent(config: AgentConfig): void
export function updateAgentConfig(agentType: string, config: AgentConfig): void
export function deleteAgentConfig(agentType: string): void
```

**Update `renderAgentTypeButtons()`:**
```typescript
export function renderAgentTypeButtons(
  selectedAgentType: string | null | undefined,
  handleClick: (event: Event) => void,
  showLabels = false
): Lit.TemplateResult {
  // Use getAgentConfigs() instead of AGENT_CONFIGS
  const allConfigs = getAgentConfigs();

  return html`
    <div class="prompt-buttons-container">
      ${Object.values(allConfigs).map(config => {
        // ... existing rendering logic
      })}
    </div>
  `;
}
```

### 4. Update AgentDropdownSelector.ts

Wire up existing callbacks to agent management functions.

**Changes:**
```typescript
private handleDropdownItemClick = (e: Event): void => {
  // ... existing code ...

  switch (action) {
    case 'select':
      if (agentType) {
        this.handleAgentSelect(agentType);
        this.closeDropdown();
      }
      break;
    case 'add':
      // Open agent editor dialog in create mode
      this.onAddAgent?.();
      this.closeDropdown();
      break;
    case 'delete':
      if (agentType) {
        // Confirm and delete via callback
        this.onDeleteAgent?.(agentType);
      }
      break;
  }
};

private handleEditAgent(agentType: string): void {
  // Open agent editor dialog in edit mode
  this.onEditAgent?.(agentType);
}
```

### 5. Update AIChatPanel.ts

Implement agent management handlers.

**Changes:**
```typescript
// Add imports
import { AgentConfigManager } from '../core/AgentConfigManager.js';
import { AgentEditorDialog } from './AgentEditorDialog.js';

export class AIChatPanel {
  private agentEditorDialog: AgentEditorDialog | null = null;

  // Initialize agent editor dialog
  private initializeAgentEditor(): void {
    this.agentEditorDialog = new AgentEditorDialog();
    this.agentEditorDialog.addEventListener('agent-saved', () => {
      this.refreshAgentList();
    });
    this.agentEditorDialog.addEventListener('agent-deleted', () => {
      this.refreshAgentList();
    });
  }

  // Handler for adding new agent
  private handleAddAgent = (): void => {
    this.agentEditorDialog?.show('create');
  };

  // Handler for editing existing agent
  private handleEditAgent = (agentType: string): void => {
    this.agentEditorDialog?.show('edit', agentType);
  };

  // Handler for deleting agent
  private handleDeleteAgent = (agentType: string): void => {
    if (!AgentConfigManager.isBuiltInAgent(agentType)) {
      const confirmed = confirm(`Delete agent "${agentType}"? This cannot be undone.`);
      if (confirmed) {
        AgentConfigManager.deleteCustomAgent(agentType);
        this.refreshAgentList();

        // If deleted agent was selected, reset to null
        if (this.selectedAgentType === agentType) {
          this.selectedAgentType = null;
        }
      }
    }
  };

  // Refresh agent list after changes
  private refreshAgentList(): void {
    // Re-render agent selector with updated configs
    this.requestUpdate();
  }

  // Pass callbacks to agent dropdown selector
  private renderAgentSelector(): TemplateResult {
    return renderAgentDropdownSelector({
      selectedAgentType: this.selectedAgentType,
      agentConfigs: getAgentConfigs(), // Use dynamic configs
      onAgentSelect: this.handleAgentTypeSelection,
      onAddAgent: this.handleAddAgent,
      onDeleteAgent: this.handleDeleteAgent,
      onEditAgent: this.handleEditAgent,
      showLabels: true
    });
  }
}
```

### 6. Settings Dialog Integration (Optional Enhancement)

Add "Agent Management" section in SettingsDialog.ts.

**Features:**
- List all agents (built-in + custom)
- Quick edit/delete buttons per agent
- Import/export agent configs (JSON)
- Bulk operations (delete all custom agents)

**UI Mockup:**
```
┌─────────────────────────────────────────┐
│ Agent Management                        │
├─────────────────────────────────────────┤
│ Built-in Agents:                        │
│  🔎 Search                      [Edit]  │
│  📚 Deep Research               [Edit]  │
│                                         │
│ Custom Agents:                          │
│  🤖 My Agent            [Edit] [Delete] │
│  🎯 Task Agent          [Edit] [Delete] │
│                                         │
│ [+ Add Agent]  [Import]  [Export All]  │
└─────────────────────────────────────────┘
```

### 7. Tool Selection UI Component (`ui/ToolSelectorDialog.ts`)

Reusable component for selecting tools in agent editor.

**Features:**
- Categorized tool list (Navigation, Data Extraction, Actions, Agents, etc.)
- Search/filter tools by name or description
- Multi-select with checkboxes
- Show tool descriptions on hover
- Visual feedback for selected tools

**UI Mockup:**
```
┌─────────────────────────────────────────┐
│ Select Tools                            │
├─────────────────────────────────────────┤
│ Search: [____________] 🔍               │
│                                         │
│ ☑ Navigation Tools                     │
│   ☑ navigate_url - Navigate to URL     │
│   ☑ navigate_back - Go back            │
│   ☐ scroll_page - Scroll page          │
│                                         │
│ ☑ Data Extraction                      │
│   ☑ extract_data - Extract structured  │
│   ☐ html_to_markdown - Convert HTML    │
│                                         │
│ ☑ Agent Tools                          │
│   ☑ research_agent - Research agent    │
│   ☑ web_task_agent - Web task agent    │
│                                         │
│         [Select All]  [Clear]  [Done]  │
└─────────────────────────────────────────┘
```

## File Changes Summary

### New Files

1. **`front_end/panels/ai_chat/core/AgentConfigManager.ts`**
   - Agent storage and validation logic
   - LocalStorage management
   - Built-in vs custom agent differentiation
   - AgentDescriptorRegistry integration (register/unregister)
   - Cross-tab synchronization via storage events

2. **`front_end/panels/ai_chat/ui/AgentEditorDialog.ts`**
   - Modal dialog for creating/editing agents
   - Form validation
   - Agent lifecycle management

3. **`front_end/panels/ai_chat/ui/ToolSelectorDialog.ts`**
   - Tool selection component
   - Categorized tool display
   - Search and filter functionality

### Modified Files

1. **`front_end/panels/ai_chat/core/BaseOrchestratorAgent.ts`**
   - Convert `AGENT_CONFIGS` to dynamic function
   - Add helper functions for agent management
   - Update `renderAgentTypeButtons()` to use dynamic configs

2. **`front_end/panels/ai_chat/core/AgentDescriptorRegistry.ts`**
   - Add `removeSource(name: string)` method for descriptor cleanup
   - Enable dynamic agent unregistration

3. **`front_end/panels/ai_chat/ui/AgentDropdownSelector.ts`**
   - Wire up `onAddAgent`, `onEditAgent`, `onDeleteAgent` callbacks
   - Update rendering to distinguish custom vs built-in agents

4. **`front_end/panels/ai_chat/ui/AIChatPanel.ts`**
   - Add agent management handlers
   - Initialize AgentEditorDialog
   - Initialize storage sync listener (cross-tab consistency)
   - Refresh UI after agent changes
   - Pass callbacks to dropdown selector
   - Cleanup storage listener on disconnect

5. **`front_end/panels/ai_chat/ui/SettingsDialog.ts`** (Optional)
   - Add "Agent Management" section
   - Import/export functionality
   - Bulk operations

## Data Schema

### CustomAgentConfig Interface

```typescript
interface CustomAgentConfig extends AgentConfig {
  isCustom: boolean;
  createdAt?: string;
  modifiedAt?: string;
}
```

### LocalStorage Structure

```json
{
  "ai_chat_custom_agents": {
    "my-custom-agent": {
      "type": "my-custom-agent",
      "icon": "🤖",
      "label": "My Agent",
      "description": "Custom agent for specific tasks",
      "systemPrompt": "You are a specialized agent that...",
      "availableTools": [
        {
          "name": "navigate_url",
          "description": "Navigate to URL",
          "schema": { /* ... */ },
          "execute": null
        }
      ],
      "version": "1.0.0",
      "isCustom": true,
      "createdAt": "2025-10-02T12:00:00.000Z",
      "modifiedAt": "2025-10-02T13:30:00.000Z"
    }
  }
}
```

### Validation Rules

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateAgentConfig(config: AgentConfig): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!config.type) errors.push("Agent type is required");
  if (!config.label) errors.push("Agent label is required");
  if (!config.systemPrompt) errors.push("System prompt is required");
  if (!config.availableTools || config.availableTools.length === 0) {
    errors.push("At least one tool must be selected");
  }

  // Type format validation
  if (config.type && !/^[a-z0-9-_]+$/.test(config.type)) {
    errors.push("Agent type must contain only lowercase letters, numbers, hyphens, and underscores");
  }

  // Reserved type names
  const reservedTypes = ['search', 'deep-research', 'shopping', 'default'];
  if (config.type && reservedTypes.includes(config.type)) {
    errors.push("Cannot use reserved agent type name");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

## User Workflows

### 1. Add New Agent

```
User clicks "Add Agent" button
  ↓
AgentEditorDialog opens in "create" mode
  ↓
User fills form:
  - Type: "customer-support"
  - Label: "Customer Support"
  - Description: "Handles customer inquiries"
  - System Prompt: "You are a helpful customer support agent..."
  - Tools: [research_agent, web_task_agent, finalize_with_critique]
  ↓
User clicks "Save"
  ↓
Form validates → AgentConfigManager.saveCustomAgent(config)
  ↓
localStorage updated → Event fired → UI refreshes
  ↓
New agent appears in dropdown selector
```

### 2. Edit Existing Agent

```
User double-clicks agent button OR selects "Edit" from menu
  ↓
AgentEditorDialog opens in "edit" mode with pre-filled values
  ↓
User modifies fields (e.g., updates system prompt)
  ↓
User clicks "Save"
  ↓
Form validates → AgentConfigManager.saveCustomAgent(config)
  ↓
localStorage updated → Event fired → UI refreshes
  ↓
Agent updated in dropdown selector
```

### 3. Delete Custom Agent

```
User clicks "X" on custom agent in dropdown OR clicks "Delete" in editor
  ↓
Confirmation dialog: "Delete agent 'Customer Support'? This cannot be undone."
  ↓
User confirms
  ↓
AgentConfigManager.deleteCustomAgent(agentType)
  ↓
localStorage updated → Event fired → UI refreshes
  ↓
Agent removed from dropdown selector
  ↓
If deleted agent was selected → reset to null (no agent selected)
```

### 4. Clone Built-in Agent

```
User edits a built-in agent (e.g., "Deep Research")
  ↓
AgentEditorDialog shows "Clone as Custom" button
  ↓
User modifies system prompt or tools
  ↓
User clicks "Clone as Custom"
  ↓
Dialog prompts for new agent type and label
  ↓
User enters:
  - Type: "my-research"
  - Label: "My Research Agent"
  ↓
AgentConfigManager.cloneAgent('deep-research', 'my-research')
  ↓
localStorage updated → Event fired → UI refreshes
  ↓
New custom agent appears in dropdown with modified configuration
```

### 5. Import/Export Agents (Optional)

```
Export:
  User clicks "Export All" in Settings
    ↓
  Generate JSON file with all custom agents
    ↓
  Download as "custom-agents.json"

Import:
  User clicks "Import" in Settings
    ↓
  File picker opens
    ↓
  User selects "custom-agents.json"
    ↓
  Parse JSON and validate each agent config
    ↓
  Show preview dialog with list of agents to import
    ↓
  User confirms
    ↓
  AgentConfigManager.saveCustomAgent() for each valid agent
    ↓
  localStorage updated → UI refreshes
    ↓
  Imported agents appear in dropdown
```

## Critical Integrations

### 1. AgentDescriptorRegistry Integration

**Purpose:** All agents must register with `AgentDescriptorRegistry` for tracing, evaluation, and telemetry support.

**Reference:** `BaseOrchestratorAgent.ts:339-356` shows how built-in agents register at module load.

**Implementation in AgentConfigManager:**

```typescript
import { AgentDescriptorRegistry } from './AgentDescriptorRegistry.js';

export class AgentConfigManager {
  // Register agent descriptor when saving
  private static registerAgentDescriptor(config: AgentConfig): void {
    AgentDescriptorRegistry.registerSource({
      name: `orchestrator:${config.type}`,
      type: config.type,
      version: config.version ?? '1.0.0',
      promptProvider: () => config.systemPrompt,
      toolNamesProvider: () => config.availableTools.map(tool => tool.name),
      metadataProvider: () => ({
        isCustom: true,
        icon: config.icon,
        label: config.label,
        description: config.description
      })
    });

    logger.debug('Registered agent descriptor', { agentType: config.type });
  }

  // Unregister agent descriptor when deleting (if API supports it)
  private static unregisterAgentDescriptor(agentType: string): void {
    // Note: AgentDescriptorRegistry currently doesn't expose removeSource()
    // This should be added to AgentDescriptorRegistry.ts:
    // static removeSource(name: string): void {
    //   descriptorSources.delete(name);
    //   invalidateCache(name);
    // }

    // For now, log the issue
    logger.warn('Agent descriptor unregistration not yet supported', { agentType });
    // TODO: Add AgentDescriptorRegistry.removeSource() method
  }

  // Call registerAgentDescriptor after saving
  static saveCustomAgent(config: AgentConfig): void {
    try {
      const validated = this.validateAgentConfig(config);
      if (!validated.valid) {
        throw new Error(`Invalid agent config: ${validated.errors.join(', ')}`);
      }

      const customAgents = this.getCustomAgents();
      const customConfig: CustomAgentConfig = {
        ...config,
        isCustom: true,
        modifiedAt: new Date().toISOString(),
        createdAt: customAgents[config.type]?.createdAt || new Date().toISOString()
      };

      customAgents[config.type] = customConfig;
      localStorage.setItem(CUSTOM_AGENTS_STORAGE_KEY, JSON.stringify(customAgents));

      // Register with AgentDescriptorRegistry
      this.registerAgentDescriptor(customConfig);

      logger.info('Custom agent saved', { agentType: config.type });
    } catch (error) {
      logger.error('Failed to save custom agent', error);
      throw error;
    }
  }

  // Call unregisterAgentDescriptor when deleting
  static deleteCustomAgent(agentType: string): void {
    if (this.isBuiltInAgent(agentType)) {
      throw new Error('Cannot delete built-in agent');
    }

    try {
      const customAgents = this.getCustomAgents();
      delete customAgents[agentType];
      localStorage.setItem(CUSTOM_AGENTS_STORAGE_KEY, JSON.stringify(customAgents));

      // Unregister from AgentDescriptorRegistry
      this.unregisterAgentDescriptor(agentType);

      logger.info('Custom agent deleted', { agentType });
    } catch (error) {
      logger.error('Failed to delete custom agent', error);
      throw error;
    }
  }
}
```

**Required Addition to AgentDescriptorRegistry.ts:**

```typescript
// Add this method to AgentDescriptorRegistry class
static removeSource(name: string): void {
  descriptorSources.delete(name);
  invalidateCache(name);
  logger.debug('Removed agent descriptor source', { name });
}
```

### 2. Cross-Tab Synchronization

**Purpose:** Synchronize agent changes across multiple DevTools windows/tabs using localStorage events.

**Implementation in AgentConfigManager:**

```typescript
const CUSTOM_AGENTS_STORAGE_KEY = 'ai_chat_custom_agents';

export class AgentConfigManager {
  private static storageListeners: Set<() => void> = new Set();

  // Initialize storage event listener for cross-tab sync
  static initializeStorageSync(callback: () => void): void {
    // Store callback for cleanup
    this.storageListeners.add(callback);

    // Listen for storage events from other tabs
    const storageHandler = (event: StorageEvent) => {
      // Only react to changes to our custom agents key
      if (event.key === CUSTOM_AGENTS_STORAGE_KEY) {
        logger.debug('Storage event detected for custom agents', {
          oldValue: event.oldValue?.substring(0, 50),
          newValue: event.newValue?.substring(0, 50),
          url: event.url
        });

        // Re-register all descriptors from updated storage
        this.syncDescriptorsFromStorage();

        // Notify all registered callbacks
        this.storageListeners.forEach(cb => {
          try {
            cb();
          } catch (error) {
            logger.error('Error in storage sync callback', error);
          }
        });
      }
    };

    window.addEventListener('storage', storageHandler);

    logger.debug('Storage sync initialized');

    // Return cleanup function
    return () => {
      window.removeEventListener('storage', storageHandler);
      this.storageListeners.delete(callback);
    };
  }

  // Re-register all custom agent descriptors after cross-tab update
  private static syncDescriptorsFromStorage(): void {
    const customAgents = this.getCustomAgents();

    Object.values(customAgents).forEach(config => {
      this.registerAgentDescriptor(config);
    });

    logger.debug('Synced agent descriptors from storage', {
      count: Object.keys(customAgents).length
    });
  }

  // Initialize all custom agent descriptors on module load
  static initializeDescriptors(): void {
    this.syncDescriptorsFromStorage();
  }
}

// Auto-initialize descriptors when module loads
AgentConfigManager.initializeDescriptors();
```

**Implementation in AIChatPanel.ts:**

```typescript
export class AIChatPanel {
  private storageCleanup: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback?.();

    // Initialize cross-tab storage sync
    this.storageCleanup = AgentConfigManager.initializeStorageSync(() => {
      logger.debug('Agent changes detected from another tab');
      this.refreshAgentList();
      this.showToast('Agent list updated from another window');
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback?.();

    // Clean up storage listener
    if (this.storageCleanup) {
      this.storageCleanup();
      this.storageCleanup = null;
    }
  }
}
```

### 3. Complete AgentConfigManager Implementation

```typescript
import { AgentDescriptorRegistry } from './AgentDescriptorRegistry.js';
import { createLogger } from './Logger.js';
import type { AgentConfig } from './BaseOrchestratorAgent.js';

const logger = createLogger('AgentConfigManager');
const CUSTOM_AGENTS_STORAGE_KEY = 'ai_chat_custom_agents';

export interface CustomAgentConfig extends AgentConfig {
  isCustom: boolean;
  createdAt: string;
  modifiedAt: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class AgentConfigManager {
  private static storageListeners: Set<() => void> = new Set();

  static getCustomAgents(): {[key: string]: CustomAgentConfig} {
    try {
      const stored = localStorage.getItem(CUSTOM_AGENTS_STORAGE_KEY);
      if (!stored) return {};

      const parsed = JSON.parse(stored);
      return typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      logger.error('Error loading custom agents', error);
      return {};
    }
  }

  static getAllAgents(): {[key: string]: AgentConfig} {
    const { BUILT_IN_AGENT_CONFIGS } = await import('./BaseOrchestratorAgent.js');
    const customAgents = this.getCustomAgents();
    return { ...BUILT_IN_AGENT_CONFIGS, ...customAgents };
  }

  static saveCustomAgent(config: AgentConfig): void {
    // ... (implementation shown above)
  }

  static deleteCustomAgent(agentType: string): void {
    // ... (implementation shown above)
  }

  static validateAgentConfig(config: AgentConfig): ValidationResult {
    const errors: string[] = [];

    if (!config.type) errors.push("Agent type is required");
    if (!config.label) errors.push("Agent label is required");
    if (!config.systemPrompt) errors.push("System prompt is required");
    if (!config.availableTools || config.availableTools.length === 0) {
      errors.push("At least one tool must be selected");
    }

    if (config.type && !/^[a-z0-9-_]+$/.test(config.type)) {
      errors.push("Agent type must contain only lowercase letters, numbers, hyphens, and underscores");
    }

    const reservedTypes = ['search', 'deep-research', 'shopping', 'default'];
    if (config.type && reservedTypes.includes(config.type)) {
      errors.push("Cannot use reserved agent type name");
    }

    return { valid: errors.length === 0, errors };
  }

  static isBuiltInAgent(agentType: string): boolean {
    const { BUILT_IN_AGENT_CONFIGS } = await import('./BaseOrchestratorAgent.js');
    return agentType in BUILT_IN_AGENT_CONFIGS;
  }

  static cloneAgent(sourceType: string, newType: string): AgentConfig {
    const allAgents = this.getAllAgents();
    const source = allAgents[sourceType];

    if (!source) {
      throw new Error(`Source agent "${sourceType}" not found`);
    }

    return {
      ...source,
      type: newType,
      version: '1.0.0',
      label: `${source.label} (Copy)`
    };
  }

  private static registerAgentDescriptor(config: AgentConfig): void {
    // ... (implementation shown above)
  }

  private static unregisterAgentDescriptor(agentType: string): void {
    // ... (implementation shown above)
  }

  static initializeStorageSync(callback: () => void): (() => void) {
    // ... (implementation shown above)
  }

  private static syncDescriptorsFromStorage(): void {
    // ... (implementation shown above)
  }

  static initializeDescriptors(): void {
    this.syncDescriptorsFromStorage();
  }
}

// Auto-initialize descriptors when module loads
AgentConfigManager.initializeDescriptors();
```

## Tool Registry Integration

Agents need to reference tools from the ToolRegistry. The tool selector should dynamically fetch available tools:

```typescript
// In ToolSelectorDialog.ts
import { ToolRegistry } from '../agent_framework/ConfigurableAgentTool.js';

class ToolSelectorDialog {
  private getAvailableTools(): Tool[] {
    // Get all registered tools from ToolRegistry
    return ToolRegistry.getAllTools();
  }

  private categorizeTools(tools: Tool[]): Map<string, Tool[]> {
    const categories = new Map<string, Tool[]>();

    for (const tool of tools) {
      const category = this.getToolCategory(tool.name);
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)?.push(tool);
    }

    return categories;
  }

  private getToolCategory(toolName: string): string {
    // Categorize based on tool name patterns
    if (toolName.includes('navigate')) return 'Navigation';
    if (toolName.includes('extract') || toolName.includes('search')) return 'Data Extraction';
    if (toolName.includes('action') || toolName.includes('click')) return 'Actions';
    if (toolName.includes('agent')) return 'Agent Tools';
    return 'Other';
  }
}
```

## Event System

Custom events for agent lifecycle:

```typescript
// Event definitions
export class AgentSavedEvent extends Event {
  static readonly eventName = 'agent-saved';
  constructor(public agentType: string, public config: AgentConfig) {
    super(AgentSavedEvent.eventName, { bubbles: true, composed: true });
  }
}

export class AgentDeletedEvent extends Event {
  static readonly eventName = 'agent-deleted';
  constructor(public agentType: string) {
    super(AgentDeletedEvent.eventName, { bubbles: true, composed: true });
  }
}

// Usage in AgentEditorDialog
private handleSave(): void {
  const config = this.buildConfigFromForm();
  AgentConfigManager.saveCustomAgent(config);
  this.dispatchEvent(new AgentSavedEvent(config.type, config));
  this.close();
}

// Usage in AIChatPanel
private initializeAgentEditor(): void {
  this.agentEditorDialog = new AgentEditorDialog();
  this.agentEditorDialog.addEventListener('agent-saved', (e: AgentSavedEvent) => {
    this.refreshAgentList();
    this.showToast(`Agent "${e.config.label}" saved successfully`);
  });
  this.agentEditorDialog.addEventListener('agent-deleted', (e: AgentDeletedEvent) => {
    this.refreshAgentList();
    this.showToast(`Agent deleted successfully`);
  });
}
```

## CSS Styling Guidelines

### Agent Editor Dialog

```css
.agent-editor-dialog {
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
}

.agent-editor-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-details-hairline);
}

.agent-editor-field {
  margin-bottom: 16px;
}

.agent-editor-label {
  display: block;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--color-text-primary);
}

.agent-editor-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-input-outline);
  border-radius: 4px;
  font-family: inherit;
}

.agent-editor-textarea {
  min-height: 200px;
  font-family: monospace;
  resize: vertical;
}

.agent-editor-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 24px;
}

.agent-editor-delete-zone {
  border-top: 1px solid var(--color-error-text);
  padding-top: 16px;
  margin-top: 16px;
}
```

### Tool Selector

```css
.tool-selector-dialog {
  max-width: 600px;
  max-height: 80vh;
}

.tool-selector-search {
  margin-bottom: 16px;
}

.tool-category {
  margin-bottom: 16px;
}

.tool-category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  margin-bottom: 8px;
  cursor: pointer;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  cursor: pointer;
}

.tool-item:hover {
  background-color: var(--color-background-hover);
}

.tool-item-checkbox {
  flex-shrink: 0;
}

.tool-item-label {
  flex: 1;
}

.tool-item-description {
  font-size: 0.9em;
  color: var(--color-text-secondary);
}
```

## Testing Strategy

### Unit Tests

1. **AgentConfigManager.test.ts**
   - Test saveCustomAgent()
   - Test deleteCustomAgent()
   - Test getAllAgents() merges built-in + custom
   - Test validateAgentConfig()
   - Test localStorage persistence
   - Test AgentDescriptorRegistry registration on save
   - Test AgentDescriptorRegistry unregistration on delete
   - Test cross-tab storage sync callback invocation

2. **AgentEditorDialog.test.ts**
   - Test form validation
   - Test save/cancel actions
   - Test clone functionality
   - Test event dispatching

3. **ToolSelectorDialog.test.ts**
   - Test tool categorization
   - Test search/filter
   - Test multi-select behavior

### Integration Tests

1. **Agent Lifecycle**
   - Create agent → appears in dropdown
   - Edit agent → changes persist
   - Delete agent → removed from UI

2. **UI Interactions**
   - Double-click to edit
   - Dropdown add/delete buttons
   - Settings panel management

### E2E Tests

1. **Complete Workflow**
   - User creates custom agent
   - Selects custom agent
   - Sends message using custom agent
   - Edits agent configuration
   - Deletes agent

## Migration Strategy

### Phase 1: Core Infrastructure (Week 1)
- Add `removeSource()` method to AgentDescriptorRegistry
- Implement AgentConfigManager
  - localStorage persistence
  - Validation logic
  - AgentDescriptorRegistry integration
  - Cross-tab storage sync
- Create localStorage schema
- Test descriptor registration/unregistration

### Phase 2: UI Components (Week 2)
- Build AgentEditorDialog
- Build ToolSelectorDialog
- Add basic styling

### Phase 3: Integration (Week 3)
- Update BaseOrchestratorAgent
- Wire up AgentDropdownSelector
- Update AIChatPanel
  - Initialize storage sync
  - Proper cleanup on disconnect
- Test cross-tab synchronization
- Verify tracing/evaluation integration

### Phase 4: Polish (Week 4)
- Add Settings panel integration
- Implement import/export
- Add comprehensive tests
- Documentation and examples

## Future Enhancements

1. **Agent Templates**
   - Pre-built agent templates for common use cases
   - Template marketplace/gallery

2. **Agent Versioning**
   - Track version history
   - Rollback to previous versions
   - Compare versions

3. **Agent Sharing**
   - Export single agent as shareable JSON
   - Import from URL/GitHub gist
   - Community agent repository

4. **Advanced Configuration**
   - Custom temperature/top_p settings per agent
   - Model selection per agent
   - Custom stop sequences

5. **Agent Analytics**
   - Track agent usage
   - Performance metrics
   - Tool usage statistics

## Key Design Decisions

### 1. AgentDescriptorRegistry Integration

**Why it matters:** AgentDescriptorRegistry is used by tracing, evaluation, and telemetry systems to track agent usage and performance. Without registration:
- Custom agents won't appear in trace/span metadata
- Evaluation systems won't recognize custom agents
- Stale descriptors may persist after deletion

**Solution:**
- Call `AgentDescriptorRegistry.registerSource()` when saving agents
- Add `removeSource()` method to support cleanup on deletion
- Re-register all descriptors on cross-tab sync

### 2. Cross-Tab Synchronization

**Why it matters:** Users often have multiple DevTools windows open. Without storage event handling:
- Changes in one tab won't propagate to others
- UI becomes stale and inconsistent
- Users must manually refresh to see updates

**Solution:**
- Use `window.addEventListener('storage', ...)` to watch for changes
- Re-register descriptors and refresh UI when storage updates
- Proper cleanup in `disconnectedCallback()`

**Limitations:**
- Storage events don't fire in the tab that made the change (only other tabs)
- Same-origin policy applies (only works within same DevTools instance)

## References

- BaseOrchestratorAgent.ts:288-336 (Current AGENT_CONFIGS)
- BaseOrchestratorAgent.ts:339-356 (AgentDescriptorRegistry registration pattern)
- AgentDescriptorRegistry.ts:78-121 (Registry API and interfaces)
- AgentDropdownSelector.ts:16-17 (Callback interfaces)
- ConfigurableAgentTool.ts:97-150 (AgentToolConfig interface)
- ToolRegistry pattern in ConfiguredAgents.ts:33-117
