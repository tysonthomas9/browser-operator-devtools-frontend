// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as SDK from '../../../core/sdk/sdk.js';
import { createLogger } from '../core/Logger.js';
import { AgentConfigManager } from '../core/AgentConfigManager.js';
import type { Tool, LLMContext, ErrorResult } from './Tools.js';
import type { ToolInfo } from './ListAvailableToolsTool.js';

const logger = createLogger('RenderAgentEditorTool');

/**
 * Prefill data for agent editor form
 */
export interface AgentEditorPrefillData {
  type?: string;
  label?: string;
  description?: string;
  icon?: string;
  systemPrompt?: string;
  toolNames?: string[];
}

/**
 * Arguments for rendering agent editor
 */
export interface RenderAgentEditorArgs {
  mode: 'create' | 'edit';
  agentType?: string;           // Required for edit mode
  prefill?: AgentEditorPrefillData; // Optional for create mode
  allTools: ToolInfo[];        // From ListAvailableToolsTool
  reasoning: string;
}

/**
 * Result of rendering agent editor
 */
export interface RenderAgentEditorResult {
  success: boolean;
  webappId: string;
  message: string;
}

/**
 * Tool for rendering full-screen agent editor as an iframe webapp.
 * Supports both create and edit modes with prefilled data.
 */
export class RenderAgentEditorTool implements Tool<RenderAgentEditorArgs, RenderAgentEditorResult | ErrorResult> {
  name = 'render_agent_editor';
  description = 'Renders a full-screen agent editor form in an isolated iframe. Supports create mode (new agent) and edit mode (modify existing agent). The form includes fields for agent type, label, icon, description, system prompt, and tool selection. Returns a unique webappId for later data retrieval.';

  async execute(args: RenderAgentEditorArgs, _ctx?: LLMContext): Promise<RenderAgentEditorResult | ErrorResult> {
    logger.info('Rendering agent editor', {
      mode: args.mode,
      agentType: args.agentType,
      hasPrefill: !!args.prefill,
      toolCount: args.allTools.length,
      reasoning: args.reasoning
    });

    const { mode, agentType, prefill, allTools, reasoning } = args;

    // Validate required arguments
    if (!mode || (mode !== 'create' && mode !== 'edit')) {
      return { error: 'Mode must be either "create" or "edit"' };
    }

    if (mode === 'edit' && !agentType) {
      return { error: 'agentType is required for edit mode' };
    }

    if (!allTools || !Array.isArray(allTools)) {
      return { error: 'allTools must be an array of ToolInfo objects' };
    }

    if (!reasoning || typeof reasoning !== 'string') {
      return { error: 'Reasoning is required and must be a string' };
    }

    // For edit mode, load existing agent config
    let editConfig: AgentEditorPrefillData | undefined = prefill;
    if (mode === 'edit' && agentType) {
      const allAgents = await AgentConfigManager.getAllAgents();
      const existingAgent = allAgents[agentType];

      if (!existingAgent) {
        return { error: `Agent not found: ${agentType}` };
      }

      editConfig = {
        type: existingAgent.type,
        label: existingAgent.label,
        description: existingAgent.description || '',
        icon: existingAgent.icon,
        systemPrompt: existingAgent.systemPrompt,
        toolNames: existingAgent.toolNames || existingAgent.availableTools.map(t => t.name)
      };
    }

    // Get the primary page target
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (!target) {
      logger.error('No primary page target available');
      return { error: 'No page target available' };
    }

    // Navigate to blank page first for clean canvas
    logger.info('Navigating to blank page before rendering agent editor');
    const pageAgent = target.pageAgent();
    if (pageAgent) {
      try {
        const navResult = await pageAgent.invoke_navigate({ url: 'about:blank' });
        if (navResult.getError()) {
          logger.warn(`Navigation to blank page failed: ${navResult.getError()}, continuing anyway`);
        } else {
          // Wait briefly for blank page to load
          await new Promise(resolve => setTimeout(resolve, 300));
          logger.info('Navigated to blank page successfully');
        }
      } catch (navError) {
        logger.warn('Error navigating to blank page, continuing anyway:', navError);
      }
    }

    try {
      const runtimeAgent = target.runtimeAgent();

      // Build the HTML template
      const html = this.buildHTML(mode, editConfig, allTools);
      const css = this.buildCSS();
      const js = this.buildJavaScript(mode, editConfig, allTools);

      // Execute webapp rendering script in page context
      const result = await runtimeAgent.invoke_evaluate({
        expression: `
          (() => {
            // Generate unique webapp ID
            const webappId = 'devtools-agent-editor-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

            // Create full-screen iframe
            const iframe = document.createElement('iframe');
            iframe.id = webappId;
            iframe.setAttribute('data-devtools-webapp', 'true');
            iframe.setAttribute('data-agent-editor', 'true');
            iframe.setAttribute('data-reasoning', ${JSON.stringify(reasoning)});

            // Style iframe for full-screen coverage
            iframe.style.position = 'fixed';
            iframe.style.top = '0';
            iframe.style.left = '0';
            iframe.style.width = '100vw';
            iframe.style.height = '100vh';
            iframe.style.border = 'none';
            iframe.style.zIndex = '999999';
            iframe.style.backgroundColor = 'white';

            // Build complete HTML document for iframe
            const fullHTML = '<!DOCTYPE html>' +
              '<html>' +
              '<head>' +
              '<meta charset="UTF-8">' +
              '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
              '<style>' + ${JSON.stringify(css)} + '</style>' +
              '</head>' +
              '<body>' +
              ${JSON.stringify(html)} +
              '<script>' + ${JSON.stringify(js)} + '</script>' +
              '</body>' +
              '</html>';

            // Set iframe content using srcdoc
            iframe.srcdoc = fullHTML;

            // Append iframe to body
            document.body.appendChild(iframe);

            return {
              success: true,
              webappId: webappId,
              message: 'Agent editor rendered successfully in full-screen iframe'
            };
          })()
        `,
        returnByValue: true,
      });

      // Check for evaluation errors
      if (result.exceptionDetails) {
        const errorMsg = result.exceptionDetails.text || 'Unknown evaluation error';
        logger.error('Agent editor rendering failed with exception:', errorMsg);
        return { error: `Agent editor rendering failed: ${errorMsg}` };
      }

      // Extract result
      const renderResult = result.result.value as RenderAgentEditorResult;

      if (!renderResult || !renderResult.success) {
        logger.error('Agent editor rendering script returned unsuccessful result');
        return { error: 'Agent editor rendering script failed to execute properly' };
      }

      logger.info('Successfully rendered agent editor', {
        webappId: renderResult.webappId,
        mode
      });

      return renderResult;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to render agent editor:', errorMsg);
      return { error: `Failed to render agent editor: ${errorMsg}` };
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private buildHTML(mode: 'create' | 'edit', prefill: AgentEditorPrefillData | undefined, allTools: ToolInfo[]): string {
    const p = prefill || {};
    const escape = (str: string) => this.escapeHtml(str);

    return `
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
        value="${escape(p.type || '')}"
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
        value="${escape(p.label || '')}"
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
        value="${escape(p.icon || '🤖')}"
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
        value="${escape(p.description || '')}"
        placeholder="Brief description of what this agent does"
      >
    </div>

    <!-- System Prompt -->
    <div class="form-section">
      <label for="systemPrompt">
        System Prompt
        ${p.systemPrompt && mode === 'create' ? '<span class="ai-badge">✨ AI GENERATED</span>' : ''}
      </label>
      <textarea
        id="systemPrompt"
        name="systemPrompt"
        required
        placeholder="Define your agent's behavior, capabilities, and instructions..."
      >${escape(p.systemPrompt || '')}</textarea>
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
`;
  }

  private buildCSS(): string {
    return `
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
`;
  }

  private buildJavaScript(mode: 'create' | 'edit', prefill: AgentEditorPrefillData | undefined, allTools: ToolInfo[]): string {
    const p = prefill || {};
    const preselectedTools = JSON.stringify(p.toolNames || []);
    const toolsData = JSON.stringify(allTools);

    return `
// Data from backend
const allTools = ${toolsData};
const preselectedTools = ${preselectedTools};
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

const categoryOrder = ['Navigation', 'Data Extraction', 'Actions', 'Agents', 'WebApp', 'Meta', 'Storage', 'Other'];
categoryOrder.forEach(category => {
  if (!categorized[category] || categorized[category].length === 0) return;

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

    item.innerHTML =
      '<input type="checkbox" name="tools" value="' + tool.name + '" id="tool-' + tool.name + '" ' + checked + '>' +
      '<div class="tool-info">' +
        '<div class="tool-name">' + tool.name + '</div>' +
        '<div class="tool-description">' + tool.description + '</div>' +
      '</div>';

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
`;
  }

  schema = {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['create', 'edit'],
        description: 'Editor mode: "create" for new agent or "edit" for modifying existing agent',
      },
      agentType: {
        type: 'string',
        description: 'Agent type ID (required for edit mode). The agent configuration will be loaded automatically.',
      },
      prefill: {
        type: 'object',
        description: 'Optional prefill data for the form (useful for create mode with AI-generated suggestions)',
        properties: {
          type: { type: 'string' },
          label: { type: 'string' },
          description: { type: 'string' },
          icon: { type: 'string' },
          systemPrompt: { type: 'string' },
          toolNames: { type: 'array', items: { type: 'string' } }
        }
      },
      allTools: {
        type: 'array',
        description: 'Complete list of available tools from ListAvailableToolsTool. Required for populating tool checkboxes.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' }
          }
        }
      },
      reasoning: {
        type: 'string',
        description: 'Required explanation for why the agent editor is being rendered',
      },
    },
    required: ['mode', 'allTools', 'reasoning'],
  };
}
