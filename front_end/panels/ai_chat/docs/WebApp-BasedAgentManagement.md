# WebApp-Based Agent Management Implementation

## Document Version
- **Version**: 1.0
- **Date**: 2025-10-04
- **Status**: Implementation Ready

## Executive Summary

This document describes the implementation of dynamic agent management using the existing WebApp rendering infrastructure (`RenderWebAppTool`, `GetWebAppDataTool`, `RemoveWebAppTool`). The key innovation is **AI-generated system prompts** - users describe what they want an agent to do in natural language, and the system generates appropriate prompts and tool recommendations automatically.

## Architecture Overview

### Core Principle
Instead of building native DevTools UI components, we render agent management forms as full-screen iframes and let AI agents orchestrate the CRUD workflow.

### Key Innovation: GenerateAgentPromptTool
This tool uses LLM to generate intelligent system prompts based on user descriptions:
- **Input**: "Create an agent that monitors competitor websites"
- **Output**: Complete system prompt + recommended tools + metadata

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interaction                        │
│  "I need an agent that researches legal cases"              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              AgentManagementAgent                           │
│  (Orchestrates the entire workflow)                         │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬──────────────┐
        ▼                         ▼              ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐
│ Generate         │  │ Render           │  │ Save/Delete  │
│ AgentPromptTool  │  │ AgentEditorTool  │  │ ConfigTools  │
└────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘
         │                     │                    │
         │                     ▼                    │
         │         ┌──────────────────┐            │
         │         │  Full-Screen     │            │
         │         │  Iframe Form     │            │
         │         └────────┬─────────┘            │
         │                  │                       │
         │                  ▼                       │
         │         ┌──────────────────┐            │
         │         │ GetWebAppDataTool│            │
         │         └────────┬─────────┘            │
         │                  │                       │
         └──────────────────┴───────────────────────┘
                            │
                            ▼
                ┌──────────────────────┐
                │ AgentConfigManager   │
                │ (localStorage)       │
                └──────────────────────┘
```

## Data Model

### Storage Schema (localStorage)

**Key**: `ai_chat_custom_agents`

```json
{
  "my-legal-research": {
    "type": "my-legal-research",
    "label": "Legal Research",
    "icon": "⚖️",
    "description": "Researches legal cases and precedents",
    "systemPrompt": "You are an expert legal researcher...",
    "toolNames": [
      "research_agent",
      "document_search",
      "bookmark_store"
    ],
    "version": "1.0.0",
    "isCustom": true,
    "createdAt": "2025-10-04T12:00:00.000Z",
    "modifiedAt": "2025-10-04T12:30:00.000Z"
  }
}
```

### AgentConfig Interface (Extended)

```typescript
export interface AgentConfig {
  type: string;                        // Unique kebab-case ID
  icon: string;                        // Emoji or URL
  label: string;                       // Human-readable name
  description?: string;                // Brief description
  systemPrompt: string;                // Agent's system prompt
  availableTools: Array<Tool<any, any>>; // Runtime: Tool instances
  toolNames?: string[];                // Storage: Tool name strings
  version?: string;                    // Semantic version
  isCustom?: boolean;                  // Built-in vs custom
  createdAt?: string;                  // ISO timestamp
  modifiedAt?: string;                 // ISO timestamp
}
```

### Critical Design Decision: Tool Storage

**Problem**: Tool instances cannot be serialized to JSON (they contain functions)

**Solution**: Two-field approach
- `toolNames: string[]` - Stored in localStorage
- `availableTools: Tool[]` - Resolved at runtime via ToolRegistry

**Conversion Logic**:
```typescript
// Storage → Runtime
config.availableTools = config.toolNames.map(name =>
  ToolRegistry.getRegisteredTool(name)
).filter(Boolean);

// Runtime → Storage
config.toolNames = config.availableTools.map(tool => tool.name);
```

## File Structure

### New Files to Create

#### 1. Core Infrastructure
```
front_end/panels/ai_chat/core/AgentConfigManager.ts
```
- localStorage CRUD operations
- Validation logic
- AgentDescriptorRegistry integration
- Cross-tab synchronization
- Tool name ↔ Tool instance conversion

#### 2. Agent Management Tools
```
front_end/panels/ai_chat/tools/GenerateAgentPromptTool.ts
front_end/panels/ai_chat/tools/RenderAgentEditorTool.ts
front_end/panels/ai_chat/tools/GetAgentConfigDataTool.ts
front_end/panels/ai_chat/tools/SaveAgentConfigTool.ts
front_end/panels/ai_chat/tools/DeleteAgentConfigTool.ts
front_end/panels/ai_chat/tools/ListAvailableToolsTool.ts
```

### Files to Modify

#### 1. Agent Descriptor System
```
front_end/panels/ai_chat/core/AgentDescriptorRegistry.ts
```
- ✅ COMPLETED: Added `removeSource()` method

#### 2. Orchestrator Configuration
```
front_end/panels/ai_chat/core/BaseOrchestratorAgent.ts
```
- Convert `AGENT_CONFIGS` const → `getAgentConfigs()` function
- Export `BUILT_IN_AGENT_CONFIGS` separately
- Add tool name resolution logic

#### 3. UI Integration
```
front_end/panels/ai_chat/ui/AIChatPanel.ts
```
- Add "Create Agent" button
- Initialize storage sync listener
- Refresh dropdown on agent changes
- Cleanup listeners on disconnect

```
front_end/panels/ai_chat/ui/AgentDropdownSelector.ts
```
- Visual distinction for custom agents
- Context menu for edit/delete
- "+" button for creation

#### 4. Tool Registration
```
front_end/panels/ai_chat/agent_framework/implementation/ConfiguredAgents.ts
```
- Register all new agent management tools

## Implementation Details

### Phase 1: Core Infrastructure (Week 1)

#### 1.1 AgentConfigManager.ts

**Location**: `front_end/panels/ai_chat/core/AgentConfigManager.ts`

**Responsibilities**:
- Manage localStorage persistence
- Validate agent configurations
- Register/unregister agent descriptors
- Cross-tab synchronization
- Tool name resolution

**Key Methods**:

```typescript
export class AgentConfigManager {
  private static readonly STORAGE_KEY = 'ai_chat_custom_agents';
  private static storageListeners: Set<() => void> = new Set();

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

  // Register agent descriptor for tracing/evaluation
  private static registerAgentDescriptor(config: AgentConfig): void

  // Unregister agent descriptor when deleted
  private static unregisterAgentDescriptor(agentType: string): void

  // Initialize storage event listener for cross-tab sync
  static initializeStorageSync(callback: () => void): (() => void)

  // Re-sync descriptors from storage after cross-tab update
  private static syncDescriptorsFromStorage(): void

  // Initialize all custom agent descriptors on module load
  static initializeDescriptors(): void
}

// Auto-initialize descriptors when module loads
AgentConfigManager.initializeDescriptors();
```

**Validation Rules**:
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
  if (!config.toolNames || config.toolNames.length === 0) {
    errors.push("At least one tool must be selected");
  }

  // Type format validation
  if (config.type && !/^[a-z0-9-_]+$/.test(config.type)) {
    errors.push("Agent type must contain only lowercase letters, numbers, hyphens, and underscores");
  }

  // Reserved type names (built-in agents)
  const reservedTypes = ['search', 'deep-research', 'shopping', 'default'];
  if (config.type && reservedTypes.includes(config.type)) {
    errors.push("Cannot use reserved agent type name");
  }

  // Validate tools exist in registry
  if (config.toolNames) {
    config.toolNames.forEach(toolName => {
      if (!ToolRegistry.getRegisteredTool(toolName)) {
        errors.push(`Tool not found in registry: ${toolName}`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
```

**Cross-Tab Synchronization**:
```typescript
static initializeStorageSync(callback: () => void): (() => void) {
  this.storageListeners.add(callback);

  const storageHandler = (event: StorageEvent) => {
    if (event.key === this.STORAGE_KEY) {
      logger.debug('Storage event detected for custom agents');

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

  // Return cleanup function
  return () => {
    window.removeEventListener('storage', storageHandler);
    this.storageListeners.delete(callback);
  };
}
```

#### 1.2 Update BaseOrchestratorAgent.ts

**Changes**:

1. **Add toolNames field to AgentConfig interface**:
```typescript
export interface AgentConfig {
  type: string;
  icon: string;
  label: string;
  description?: string;
  systemPrompt: string;
  availableTools: Array<Tool<any, any>>;  // Runtime
  toolNames?: string[];                   // Storage
  version?: string;
  isCustom?: boolean;
  createdAt?: string;
  modifiedAt?: string;
}
```

2. **Convert AGENT_CONFIGS to function**:
```typescript
// Export built-in configs separately
export const BUILT_IN_AGENT_CONFIGS: {[key: string]: AgentConfig} = {
  [BaseOrchestratorAgentType.SEARCH]: {
    type: BaseOrchestratorAgentType.SEARCH,
    icon: '🔎',
    label: 'Search',
    description: 'Precision fact finding with structured output',
    systemPrompt: SYSTEM_PROMPTS[BaseOrchestratorAgentType.SEARCH],
    version: '2025-09-17',
    availableTools: [ /* ... */ ]
  },
  // ... other built-in agents
};

// Dynamic config loading
export function getAgentConfigs(): {[key: string]: AgentConfig} {
  return AgentConfigManager.getAllAgents();
}
```

3. **Update renderAgentTypeButtons()**:
```typescript
export function renderAgentTypeButtons(...): Lit.TemplateResult {
  const allConfigs = getAgentConfigs();  // Dynamic loading
  return html`
    <div class="prompt-buttons-container">
      ${Object.values(allConfigs).map(config => {
        // ... rendering logic
      })}
    </div>
  `;
}
```

### Phase 2: AI Prompt Generation (Week 2)

#### 2.1 GenerateAgentPromptTool.ts

**Location**: `front_end/panels/ai_chat/tools/GenerateAgentPromptTool.ts`

**Purpose**: Uses LLM to generate intelligent system prompts based on user descriptions

**Schema**:
```typescript
export interface GenerateAgentPromptArgs {
  userDescription: string;  // "Create an agent that monitors competitors"
  reasoning: string;         // Why generating this prompt
}

export interface GenerateAgentPromptResult {
  success: boolean;
  systemPrompt: string;      // Generated detailed system prompt
  recommendedTools: string[]; // ["web_task_agent", "document_search"]
  suggestedName: string;     // "competitor-monitor"
  suggestedLabel: string;    // "Competitor Monitor"
  suggestedIcon: string;     // "📊"
  suggestedDescription: string; // Brief description
  message: string;
}
```

**Implementation Strategy**:

```typescript
async execute(args: GenerateAgentPromptArgs, ctx?: LLMContext): Promise<GenerateAgentPromptResult | ErrorResult> {
  const { userDescription } = args;

  // Get all available tools for context
  const allTools = Array.from(ToolRegistry['registeredTools'].values());
  const toolDescriptions = allTools.map(tool => ({
    name: tool.name,
    description: tool.description
  }));

  // Construct generation prompt
  const generationPrompt = `You are an expert AI agent configuration specialist. Your task is to create a complete agent configuration based on a user's description.

USER DESCRIPTION:
"${userDescription}"

AVAILABLE TOOLS:
${JSON.stringify(toolDescriptions, null, 2)}

TASK:
Generate a comprehensive system prompt and configuration for an AI agent that fulfills the user's requirements.

REQUIREMENTS:
1. **System Prompt**: Write a detailed, specific system prompt (500-1500 characters) that:
   - Clearly defines the agent's role and capabilities
   - Provides specific instructions for using available tools effectively
   - Includes relevant domain knowledge and best practices
   - Sets appropriate tone and communication style
   - Includes examples of how to approach tasks

2. **Tool Selection**: Recommend 3-7 most relevant tools from the available list

3. **Metadata**:
   - Agent type name (kebab-case, e.g., "legal-research")
   - Display label (2-4 words, title case, e.g., "Legal Research")
   - Icon (single emoji that represents the agent's purpose)
   - Brief description (1 sentence, max 100 characters)

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "systemPrompt": "...",
  "recommendedTools": ["tool1", "tool2"],
  "suggestedName": "agent-name",
  "suggestedLabel": "Agent Label",
  "suggestedIcon": "🤖",
  "suggestedDescription": "Brief description"
}`;

  try {
    // Get LLM client from context
    const llmClient = ctx?.llmClient;
    if (!llmClient) {
      return { error: 'No LLM client available' };
    }

    // Generate response
    const response = await llmClient.generateText({
      messages: [{ role: 'user', content: generationPrompt }],
      temperature: 0.7,
      maxTokens: 2000
    });

    // Parse JSON response
    const result = JSON.parse(response);

    // Validate tools exist
    const validTools = result.recommendedTools.filter(toolName =>
      ToolRegistry.getRegisteredTool(toolName) !== null
    );

    if (validTools.length === 0) {
      return { error: 'No valid tools recommended by LLM' };
    }

    return {
      success: true,
      systemPrompt: result.systemPrompt,
      recommendedTools: validTools,
      suggestedName: result.suggestedName,
      suggestedLabel: result.suggestedLabel,
      suggestedIcon: result.suggestedIcon,
      suggestedDescription: result.suggestedDescription || '',
      message: 'Agent prompt generated successfully'
    };

  } catch (error) {
    logger.error('Failed to generate agent prompt', error);
    return { error: `Failed to generate agent prompt: ${error.message}` };
  }
}
```

#### 2.2 ListAvailableToolsTool.ts

**Location**: `front_end/panels/ai_chat/tools/ListAvailableToolsTool.ts`

**Purpose**: Returns list of all registered tools for form population

**Schema**:
```typescript
export interface ListAvailableToolsArgs {
  reasoning: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  category: string;  // Computed from tool name patterns
}

export interface ListAvailableToolsResult {
  success: boolean;
  tools: ToolInfo[];
  message: string;
}
```

**Implementation**:
```typescript
async execute(args: ListAvailableToolsArgs): Promise<ListAvailableToolsResult> {
  try {
    const toolMap = ToolRegistry['registeredTools'];
    const tools: ToolInfo[] = [];

    toolMap.forEach((tool, name) => {
      tools.push({
        name: tool.name,
        description: tool.description || 'No description available',
        category: this.categorize(tool.name)
      });
    });

    // Sort by category, then name
    tools.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    return {
      success: true,
      tools,
      message: `Found ${tools.length} available tools`
    };
  } catch (error) {
    return { error: `Failed to list tools: ${error.message}` };
  }
}

private categorize(toolName: string): string {
  if (toolName.includes('navigate') || toolName.includes('scroll')) return 'Navigation';
  if (toolName.includes('extract') || toolName.includes('search')) return 'Data Extraction';
  if (toolName.includes('click') || toolName.includes('action')) return 'Actions';
  if (toolName.includes('agent')) return 'Agents';
  if (toolName.includes('webapp')) return 'WebApp';
  return 'Other';
}
```

#### 2.3 RenderAgentEditorTool.ts

**Location**: `front_end/panels/ai_chat/tools/RenderAgentEditorTool.ts`

**Purpose**: Renders full-screen agent editor form with prefilled data

**Schema**:
```typescript
export interface AgentEditorPrefillData {
  type?: string;
  label?: string;
  description?: string;
  icon?: string;
  systemPrompt?: string;
  toolNames?: string[];
}

export interface RenderAgentEditorArgs {
  mode: 'create' | 'edit';
  agentType?: string;           // Required for edit mode
  prefill?: AgentEditorPrefillData; // Optional for create mode
  allTools: ToolInfo[];        // From ListAvailableToolsTool
  reasoning: string;
}

export interface RenderAgentEditorResult {
  success: boolean;
  webappId: string;
  message: string;
}
```

**HTML Template** (embedded in execute method):

```typescript
const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
    }
    h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #1a202c;
    }
    .subtitle {
      color: #718096;
      margin-bottom: 32px;
      font-size: 14px;
    }
    .form-section {
      margin-bottom: 28px;
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 8px;
      color: #2d3748;
      font-size: 14px;
    }
    .ai-badge {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 8px;
      letter-spacing: 0.5px;
    }
    input[type="text"], textarea {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      transition: all 0.2s;
    }
    input[type="text"]:focus, textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    input[readonly] {
      background: #f7fafc;
      color: #718096;
      cursor: not-allowed;
    }
    textarea {
      font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
      min-height: 280px;
      resize: vertical;
      line-height: 1.6;
    }
    .hint {
      font-size: 12px;
      color: #718096;
      margin-top: 6px;
    }
    .char-count {
      font-size: 12px;
      color: #a0aec0;
      margin-top: 6px;
      text-align: right;
    }

    /* Tool Grid */
    .tools-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .tool-actions {
      display: flex;
      gap: 8px;
    }
    .tool-actions button {
      font-size: 12px;
      padding: 6px 12px;
      background: #edf2f7;
      color: #4a5568;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    }
    .tool-actions button:hover {
      background: #e2e8f0;
    }
    .tool-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
      max-height: 320px;
      overflow-y: auto;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      background: #f7fafc;
    }
    .tool-grid::-webkit-scrollbar {
      width: 8px;
    }
    .tool-grid::-webkit-scrollbar-track {
      background: #edf2f7;
      border-radius: 4px;
    }
    .tool-grid::-webkit-scrollbar-thumb {
      background: #cbd5e0;
      border-radius: 4px;
    }
    .tool-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px;
      border-radius: 6px;
      transition: background 0.15s;
      cursor: pointer;
    }
    .tool-item:hover {
      background: #edf2f7;
    }
    .tool-item input[type="checkbox"] {
      margin-top: 2px;
      cursor: pointer;
      width: 18px;
      height: 18px;
    }
    .tool-info {
      flex: 1;
      min-width: 0;
    }
    .tool-name {
      font-size: 13px;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 2px;
    }
    .tool-description {
      font-size: 11px;
      color: #718096;
      line-height: 1.4;
    }
    .category-header {
      grid-column: 1 / -1;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #667eea;
      margin-top: 8px;
      padding-bottom: 4px;
      border-bottom: 2px solid #e2e8f0;
    }

    /* Actions */
    .actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 40px;
      padding-top: 32px;
      border-top: 2px solid #e2e8f0;
    }
    button {
      padding: 14px 28px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      font-family: inherit;
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }
    .btn-primary:active {
      transform: translateY(0);
    }
    .btn-secondary {
      background: #edf2f7;
      color: #4a5568;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
    }
    .success-indicator {
      display: none;
      position: fixed;
      top: 20px;
      right: 20px;
      background: #48bb78;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
      font-weight: 600;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${mode === 'create' ? '✨ Create New Agent' : '✏️ Edit Agent'}</h1>
    <p class="subtitle">
      ${mode === 'create' ? 'Design a custom AI agent tailored to your needs' : 'Modify your agent configuration'}
    </p>

    <form id="agent-form">
      <!-- Agent Type -->
      <div class="form-section">
        <label for="type">Agent Type (ID)</label>
        <input
          type="text"
          id="type"
          name="type"
          value="${escapeHtml(prefill?.type || '')}"
          ${mode === 'edit' ? 'readonly' : ''}
          placeholder="e.g., legal-research"
          pattern="[a-z0-9-_]+"
          required
        >
        <div class="hint">Lowercase letters, numbers, hyphens, and underscores only</div>
      </div>

      <!-- Display Label -->
      <div class="form-section">
        <label for="label">Display Label</label>
        <input
          type="text"
          id="label"
          name="label"
          value="${escapeHtml(prefill?.label || '')}"
          placeholder="e.g., Legal Research"
          required
        >
      </div>

      <!-- Icon -->
      <div class="form-section">
        <label for="icon">Icon (Emoji)</label>
        <input
          type="text"
          id="icon"
          name="icon"
          value="${escapeHtml(prefill?.icon || '🤖')}"
          placeholder="e.g., ⚖️"
          maxlength="4"
        >
      </div>

      <!-- Description -->
      <div class="form-section">
        <label for="description">Description (Optional)</label>
        <input
          type="text"
          id="description"
          name="description"
          value="${escapeHtml(prefill?.description || '')}"
          placeholder="Brief description of what this agent does"
        >
      </div>

      <!-- System Prompt -->
      <div class="form-section">
        <label for="systemPrompt">
          System Prompt
          ${prefill?.systemPrompt ? '<span class="ai-badge">✨ AI GENERATED</span>' : ''}
        </label>
        <textarea
          id="systemPrompt"
          name="systemPrompt"
          required
          placeholder="Define your agent's behavior, capabilities, and instructions..."
        >${escapeHtml(prefill?.systemPrompt || '')}</textarea>
        <div class="char-count">
          <span id="prompt-length">0</span> characters
        </div>
      </div>

      <!-- Available Tools -->
      <div class="form-section">
        <div class="tools-header">
          <label style="margin-bottom: 0;">Available Tools (Select at least one)</label>
          <div class="tool-actions">
            <button type="button" id="select-all">Select All</button>
            <button type="button" id="clear-all">Clear All</button>
          </div>
        </div>
        <div class="tool-grid" id="tool-list">
          <!-- Populated by JavaScript -->
        </div>
      </div>

      <!-- Actions -->
      <div class="actions">
        <button type="button" class="btn-secondary" id="cancel-btn">Cancel</button>
        <button type="submit" class="btn-primary">
          ${mode === 'create' ? 'Create Agent' : 'Save Changes'}
        </button>
      </div>
    </form>
  </div>

  <div class="success-indicator" id="success-indicator">
    ✓ Form submitted successfully!
  </div>

  <script>
    // Data from backend
    const allTools = ${JSON.stringify(allTools)};
    const preselectedTools = ${JSON.stringify(prefill?.toolNames || [])};
    const mode = '${mode}';

    // Character counter
    const promptArea = document.getElementById('systemPrompt');
    const lengthDisplay = document.getElementById('prompt-length');
    function updateCharCount() {
      lengthDisplay.textContent = promptArea.value.length;
    }
    promptArea.addEventListener('input', updateCharCount);
    updateCharCount();

    // Populate tool grid by category
    const toolList = document.getElementById('tool-list');
    const categorized = {};

    allTools.forEach(tool => {
      const cat = tool.category || 'Other';
      if (!categorized[cat]) categorized[cat] = [];
      categorized[cat].push(tool);
    });

    const categoryOrder = ['Navigation', 'Data Extraction', 'Actions', 'Agents', 'WebApp', 'Other'];
    categoryOrder.forEach(category => {
      if (!categorized[category]) return;

      // Category header
      const header = document.createElement('div');
      header.className = 'category-header';
      header.textContent = category;
      toolList.appendChild(header);

      // Tools in category
      categorized[category].forEach(tool => {
        const item = document.createElement('div');
        item.className = 'tool-item';
        const checked = preselectedTools.includes(tool.name) ? 'checked' : '';

        item.innerHTML = \`
          <input
            type="checkbox"
            name="tools"
            value="\${tool.name}"
            id="tool-\${tool.name}"
            \${checked}
          >
          <div class="tool-info">
            <div class="tool-name">\${tool.name}</div>
            <div class="tool-description">\${tool.description}</div>
          </div>
        \`;

        // Click entire item to toggle
        item.addEventListener('click', (e) => {
          if (e.target.tagName !== 'INPUT') {
            const checkbox = item.querySelector('input');
            checkbox.checked = !checkbox.checked;
          }
        });

        toolList.appendChild(item);
      });
    });

    // Select all / Clear all
    document.getElementById('select-all').addEventListener('click', () => {
      document.querySelectorAll('input[name="tools"]').forEach(cb => cb.checked = true);
    });
    document.getElementById('clear-all').addEventListener('click', () => {
      document.querySelectorAll('input[name="tools"]').forEach(cb => cb.checked = false);
    });

    // Cancel button
    document.getElementById('cancel-btn').addEventListener('click', () => {
      if (confirm('Discard changes and close editor?')) {
        document.body.setAttribute('data-submitted', 'true');
        document.body.setAttribute('data-cancelled', 'true');
        document.body.setAttribute('data-submit-time', Date.now().toString());
      }
    });

    // Form submission
    document.getElementById('agent-form').addEventListener('submit', (e) => {
      e.preventDefault();

      // Validate at least one tool selected
      const selectedTools = Array.from(document.querySelectorAll('input[name="tools"]:checked'));
      if (selectedTools.length === 0) {
        alert('Please select at least one tool for your agent');
        return;
      }

      // Show success indicator
      const indicator = document.getElementById('success-indicator');
      indicator.style.display = 'block';
      setTimeout(() => indicator.style.display = 'none', 3000);

      // Mark as submitted
      document.body.setAttribute('data-submitted', 'true');
      document.body.setAttribute('data-submit-time', Date.now().toString());
    });

    // Prevent accidental navigation
    window.addEventListener('beforeunload', (e) => {
      if (!document.body.getAttribute('data-submitted')) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    });
  </script>
</body>
</html>
`;
```

#### 2.4 GetAgentConfigDataTool.ts

**Location**: `front_end/panels/ai_chat/tools/GetAgentConfigDataTool.ts`

**Purpose**: Extract and validate form data from rendered agent editor

**Implementation**:
```typescript
async execute(args: GetAgentConfigDataArgs): Promise<GetAgentConfigDataResult | ErrorResult> {
  const { webappId, waitForSubmit = true, timeout = 60000 } = args;

  // Reuse GetWebAppDataTool logic
  const webappDataTool = new GetWebAppDataTool();
  const result = await webappDataTool.execute({
    webappId,
    reasoning: 'Extracting agent configuration from editor form',
    waitForSubmit,
    timeout
  });

  if ('error' in result) {
    return result;
  }

  // Check if cancelled
  const cancelledCheck = await this.checkCancelled(webappId);
  if (cancelledCheck) {
    return {
      success: false,
      cancelled: true,
      message: 'User cancelled agent creation'
    };
  }

  // Transform form data to AgentConfig
  const formData = result.formData;
  const toolNames = Array.isArray(formData.tools)
    ? formData.tools
    : [formData.tools].filter(Boolean);

  const agentConfig: AgentConfig = {
    type: formData.type,
    label: formData.label,
    icon: formData.icon || '🤖',
    description: formData.description || '',
    systemPrompt: formData.systemPrompt,
    toolNames: toolNames,
    availableTools: [], // Will be resolved later
    isCustom: true,
    version: '1.0.0'
  };

  // Validate
  const validation = AgentConfigManager.validateAgentConfig(agentConfig);
  if (!validation.valid) {
    return { error: `Invalid agent configuration: ${validation.errors.join(', ')}` };
  }

  return {
    success: true,
    agentConfig,
    message: 'Agent configuration extracted successfully'
  };
}

private async checkCancelled(webappId: string): Promise<boolean> {
  const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
  if (!target) return false;

  const result = await target.runtimeAgent().invoke_evaluate({
    expression: `
      (() => {
        const iframe = document.getElementById(${JSON.stringify(webappId)});
        if (!iframe) return false;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        return iframeDoc.body.getAttribute('data-cancelled') === 'true';
      })()
    `,
    returnByValue: true
  });

  return Boolean(result.result.value);
}
```

#### 2.5 SaveAgentConfigTool.ts

**Location**: `front_end/panels/ai_chat/tools/SaveAgentConfigTool.ts`

**Purpose**: Persist agent configuration to localStorage

**Implementation**:
```typescript
async execute(args: SaveAgentConfigArgs): Promise<SaveAgentConfigResult | ErrorResult> {
  const { agentConfig, reasoning } = args;

  try {
    // Validate before saving
    const validation = AgentConfigManager.validateAgentConfig(agentConfig);
    if (!validation.valid) {
      return { error: `Validation failed: ${validation.errors.join(', ')}` };
    }

    // Save via AgentConfigManager
    AgentConfigManager.saveCustomAgent(agentConfig);

    logger.info('Agent configuration saved successfully', {
      agentType: agentConfig.type,
      label: agentConfig.label,
      toolCount: agentConfig.toolNames?.length || 0
    });

    return {
      success: true,
      agentType: agentConfig.type,
      message: `Agent "${agentConfig.label}" saved successfully`
    };

  } catch (error) {
    logger.error('Failed to save agent configuration', error);
    return { error: `Failed to save agent: ${error.message}` };
  }
}
```

#### 2.6 DeleteAgentConfigTool.ts

**Location**: `front_end/panels/ai_chat/tools/DeleteAgentConfigTool.ts`

**Purpose**: Remove agent configuration from localStorage

**Implementation**:
```typescript
async execute(args: DeleteAgentConfigArgs): Promise<DeleteAgentConfigResult | ErrorResult> {
  const { agentType, reasoning, confirm = true } = args;

  try {
    // Check if built-in
    if (AgentConfigManager.isBuiltInAgent(agentType)) {
      return { error: 'Cannot delete built-in agent' };
    }

    // Require confirmation for safety
    if (confirm) {
      // In real implementation, this would trigger a confirmation dialog
      logger.info('Agent deletion requires confirmation', { agentType });
    }

    // Delete via AgentConfigManager
    AgentConfigManager.deleteCustomAgent(agentType);

    logger.info('Agent configuration deleted successfully', { agentType });

    return {
      success: true,
      agentType,
      message: `Agent "${agentType}" deleted successfully`
    };

  } catch (error) {
    logger.error('Failed to delete agent configuration', error);
    return { error: `Failed to delete agent: ${error.message}` };
  }
}
```

### Phase 3: Workflow Orchestration (Week 3)

#### 3.1 AgentManagementAgent Configuration

**Location**: Add to `ConfiguredAgents.ts`

**System Prompt**:
```typescript
const AGENT_MANAGEMENT_SYSTEM_PROMPT = `You are an expert AI agent configuration manager. You help users create, edit, and delete custom AI agents through an intuitive workflow.

## Creating New Agents

When a user wants to create a new agent:

1. **Understand Requirements**: Ask clarifying questions if the user's description is vague
   - What tasks should the agent perform?
   - What data sources or websites will it interact with?
   - What should the output format be?

2. **Generate Configuration**: Use \`generate_agent_prompt\` to create:
   - Intelligent system prompt tailored to user's needs
   - Recommended tools based on requirements
   - Suggested metadata (name, label, icon)

3. **Get Available Tools**: Use \`list_available_tools\` to get the complete tool list

4. **Render Editor**: Use \`render_agent_editor\` with mode='create' and prefill data from step 2
   - Pass the complete tools list
   - Include AI-generated suggestions

5. **Extract Configuration**: Use \`get_agent_config_data\` with waitForSubmit=true
   - Wait up to 60 seconds for user to review and submit
   - Handle cancellation gracefully

6. **Save Configuration**: Use \`save_agent_config\` to persist the agent

7. **Cleanup**: Use \`remove_webapp\` to remove the editor iframe

8. **Confirm**: Provide clear success message with agent details

## Editing Existing Agents

When a user wants to edit an agent:

1. Get available tools list
2. Use \`render_agent_editor\` with mode='edit' and agentType
   - Form will auto-load existing configuration
3. Wait for submission with \`get_agent_config_data\`
4. Save with \`save_agent_config\`
5. Cleanup with \`remove_webapp\`
6. Confirm success

## Deleting Agents

When a user wants to delete an agent:

1. Confirm the user really wants to delete (built-in agents cannot be deleted)
2. Use \`delete_agent_config\` with the agent type
3. Confirm deletion

## Best Practices

- **Always generate suggestions**: Even if user provides details, use AI to enhance their prompt
- **Explain choices**: Tell users why certain tools were recommended
- **Validate thoroughly**: Check that configurations make sense before saving
- **Handle errors gracefully**: If generation fails, ask user to provide details manually
- **Preserve user edits**: Never overwrite user modifications without confirmation

## Tool Usage Examples

### Creating a Legal Research Agent:
User: "I need an agent that researches legal cases"

1. generate_agent_prompt({ userDescription: "researches legal cases and precedents" })
2. list_available_tools({})
3. render_agent_editor({
     mode: 'create',
     prefill: <result from step 1>,
     allTools: <result from step 2>
   })
4. get_agent_config_data({ webappId: <from step 3>, waitForSubmit: true, timeout: 60000 })
5. save_agent_config({ agentConfig: <from step 4> })
6. remove_webapp({ webappId: <from step 3> })

### Editing an Existing Agent:
User: "Edit the Legal Research agent"

1. list_available_tools({})
2. render_agent_editor({ mode: 'edit', agentType: 'legal-research', allTools: <from step 1> })
3. get_agent_config_data({ webappId: <from step 2>, waitForSubmit: true })
4. save_agent_config({ agentConfig: <from step 3> })
5. remove_webapp({ webappId: <from step 2> })

Be helpful, clear, and patient. Creating good agents takes thoughtful configuration.`;

// Agent configuration
function createAgentManagementAgentConfig(): AgentToolConfig {
  return {
    name: 'agent_management_agent',
    description: 'Manages creation, editing, and deletion of custom AI agents',
    systemPrompt: AGENT_MANAGEMENT_SYSTEM_PROMPT,
    tools: [
      'generate_agent_prompt',
      'list_available_tools',
      'render_agent_editor',
      'get_agent_config_data',
      'save_agent_config',
      'delete_agent_config',
      'remove_webapp'
    ],
    schema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The agent management task to perform (e.g., "create new agent", "edit agent", "delete agent")'
        }
      },
      required: ['task']
    },
    maxIterations: 15,
    version: '1.0.0'
  };
}
```

### Phase 4: UI Integration (Week 3-4)

#### 4.1 Update AIChatPanel.ts

**Add Storage Sync**:
```typescript
export class AIChatPanel extends HTMLElement {
  private storageCleanup: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback?.();

    // Initialize cross-tab storage sync
    this.storageCleanup = AgentConfigManager.initializeStorageSync(() => {
      logger.debug('Agent configuration changed in another tab');
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

  private refreshAgentList(): void {
    // Trigger re-render of agent selector
    this.requestUpdate();
  }

  private showToast(message: string): void {
    // Implementation for toast notification
  }
}
```

**Add Create Agent Button**:
```typescript
private renderAgentManagementButton(): TemplateResult {
  return html`
    <button
      class="agent-management-btn"
      @click=${this.handleCreateAgent}
      title="Create custom agent"
    >
      <span class="icon">➕</span>
      <span class="label">Create Agent</span>
    </button>
  `;
}

private handleCreateAgent = async (): void => {
  // Launch agent management agent with creation task
  const agent = ToolRegistry.getRegisteredTool('agent_management_agent');
  if (!agent) {
    logger.error('Agent management agent not found');
    return;
  }

  // Execute agent with creation task
  try {
    const result = await agent.execute({
      task: 'Create a new custom agent based on user requirements'
    });

    if ('error' in result) {
      this.showToast(`Error: ${result.error}`);
    } else {
      this.showToast('Agent created successfully!');
      this.refreshAgentList();
    }
  } catch (error) {
    logger.error('Failed to launch agent management', error);
    this.showToast('Failed to create agent');
  }
};
```

#### 4.2 Update AgentDropdownSelector.ts

**Add Visual Distinction for Custom Agents**:
```typescript
private renderAgentButton(config: AgentConfig): TemplateResult {
  const isCustom = config.isCustom === true;

  return html`
    <div class="agent-button ${isCustom ? 'custom-agent' : 'builtin-agent'}">
      <span class="agent-icon">${config.icon}</span>
      <span class="agent-label">${config.label}</span>
      ${isCustom ? html`<span class="custom-badge">CUSTOM</span>` : ''}
      ${isCustom ? this.renderContextMenu(config) : ''}
    </div>
  `;
}

private renderContextMenu(config: AgentConfig): TemplateResult {
  return html`
    <div class="context-menu">
      <button @click=${() => this.handleEdit(config.type)}>Edit</button>
      <button @click=${() => this.handleDelete(config.type)}>Delete</button>
    </div>
  `;
}
```

**Add CSS for Custom Agents**:
```css
.custom-agent {
  border: 2px dashed #667eea;
  background: linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%);
}

.custom-badge {
  display: inline-block;
  background: #667eea;
  color: white;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 8px;
  margin-left: 4px;
  letter-spacing: 0.5px;
}
```

## Testing Strategy

### Unit Tests

#### AgentConfigManager.test.ts
```typescript
describe('AgentConfigManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should save custom agent to localStorage', () => {
    const config = createTestAgentConfig();
    AgentConfigManager.saveCustomAgent(config);

    const stored = localStorage.getItem('ai_chat_custom_agents');
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored);
    expect(parsed[config.type]).toBeDefined();
  });

  it('should validate agent configuration', () => {
    const invalidConfig = { type: '', label: '', systemPrompt: '' };
    const result = AgentConfigManager.validateAgentConfig(invalidConfig);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should register descriptor when saving agent', () => {
    const config = createTestAgentConfig();
    AgentConfigManager.saveCustomAgent(config);

    expect(AgentDescriptorRegistry.hasDescriptor(`orchestrator:${config.type}`)).toBe(true);
  });

  it('should remove descriptor when deleting agent', () => {
    const config = createTestAgentConfig();
    AgentConfigManager.saveCustomAgent(config);
    AgentConfigManager.deleteCustomAgent(config.type);

    expect(AgentDescriptorRegistry.hasDescriptor(`orchestrator:${config.type}`)).toBe(false);
  });

  it('should resolve tool names to tool instances', () => {
    const config = {
      ...createTestAgentConfig(),
      toolNames: ['navigate_url', 'extract_data']
    };

    AgentConfigManager.saveCustomAgent(config);
    const loaded = AgentConfigManager.getAllAgents()[config.type];

    expect(loaded.availableTools).toHaveLength(2);
    expect(loaded.availableTools[0].name).toBe('navigate_url');
  });
});
```

#### GenerateAgentPromptTool.test.ts
```typescript
describe('GenerateAgentPromptTool', () => {
  it('should generate system prompt from description', async () => {
    const tool = new GenerateAgentPromptTool();
    const result = await tool.execute({
      userDescription: 'Research legal cases',
      reasoning: 'Testing'
    }, mockLLMContext);

    expect(result.success).toBe(true);
    expect(result.systemPrompt).toBeDefined();
    expect(result.recommendedTools.length).toBeGreaterThan(0);
  });

  it('should suggest appropriate metadata', async () => {
    const tool = new GenerateAgentPromptTool();
    const result = await tool.execute({
      userDescription: 'Monitor competitor websites',
      reasoning: 'Testing'
    }, mockLLMContext);

    expect(result.suggestedName).toMatch(/^[a-z0-9-_]+$/);
    expect(result.suggestedLabel).toBeDefined();
    expect(result.suggestedIcon).toBeDefined();
  });
});
```

### Integration Tests

#### AgentCreationWorkflow.test.ts
```typescript
describe('Agent Creation Workflow', () => {
  it('should complete full creation workflow', async () => {
    // 1. Generate prompt
    const generateTool = new GenerateAgentPromptTool();
    const generated = await generateTool.execute({
      userDescription: 'Research products',
      reasoning: 'Test'
    });

    // 2. List tools
    const listTool = new ListAvailableToolsTool();
    const toolList = await listTool.execute({ reasoning: 'Test' });

    // 3. Render editor
    const renderTool = new RenderAgentEditorTool();
    const rendered = await renderTool.execute({
      mode: 'create',
      prefill: generated,
      allTools: toolList.tools,
      reasoning: 'Test'
    });

    expect(rendered.success).toBe(true);
    expect(rendered.webappId).toBeDefined();

    // 4. Simulate form submission
    // ... test continues
  });
});
```

### E2E Tests

#### e2e/AgentManagement.test.ts
```typescript
describe('Agent Management E2E', () => {
  it('should create, use, and delete custom agent', async () => {
    // Launch DevTools
    const page = await launchDevTools();

    // Click create agent button
    await page.click('.agent-management-btn');

    // Wait for agent management agent to start
    await page.waitForSelector('iframe[data-devtools-webapp="true"]');

    // Fill form
    await page.type('#type', 'test-agent');
    await page.type('#label', 'Test Agent');
    await page.type('#systemPrompt', 'You are a test agent');

    // Select tools
    await page.click('#tool-navigate_url');

    // Submit
    await page.click('button[type="submit"]');

    // Wait for agent to appear in dropdown
    await page.waitForSelector('[data-agent-type="test-agent"]');

    // Use agent in conversation
    await page.click('[data-agent-type="test-agent"]');
    await page.type('.chat-input', 'Test message');
    await page.click('.send-button');

    // Verify agent responds
    await page.waitForSelector('.agent-response');

    // Delete agent
    await page.click('[data-agent-type="test-agent"] .context-menu');
    await page.click('.delete-button');
    await page.click('.confirm-delete');

    // Verify agent removed
    await page.waitForSelector('[data-agent-type="test-agent"]', {
      hidden: true
    });
  });
});
```

## Deployment Checklist

- [ ] All new files created
- [ ] All existing files updated
- [ ] Tools registered in ConfiguredAgents.ts
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Cross-tab sync tested
- [ ] localStorage persistence verified
- [ ] AgentDescriptorRegistry integration confirmed
- [ ] UI responsive and accessible
- [ ] Error handling comprehensive
- [ ] Logging instrumented
- [ ] Documentation updated

## Future Enhancements

### Phase 5: Advanced Features

1. **Agent Templates Library**
   - Pre-built templates for common use cases
   - Community-shared templates
   - Template marketplace

2. **Import/Export**
   - Export agents as JSON files
   - Import from files or URLs
   - Bulk export/import

3. **Agent Versioning**
   - Track version history
   - Rollback to previous versions
   - Compare versions side-by-side

4. **Agent Analytics**
   - Usage statistics
   - Performance metrics
   - Tool usage patterns

5. **Collaborative Features**
   - Share agents with team
   - Agent permissions
   - Collaborative editing

## Conclusion

This implementation provides a comprehensive, production-ready system for dynamic agent management using the webapp rendering approach. The key innovations are:

1. **AI-Generated Prompts**: Reduces friction in agent creation
2. **WebApp-Based UI**: Leverages existing infrastructure
3. **Tool Name Storage**: Elegant solution to serialization problem
4. **Cross-Tab Sync**: Ensures consistency across windows
5. **Comprehensive Validation**: Prevents invalid configurations

The system is extensible, testable, and follows DevTools best practices.
