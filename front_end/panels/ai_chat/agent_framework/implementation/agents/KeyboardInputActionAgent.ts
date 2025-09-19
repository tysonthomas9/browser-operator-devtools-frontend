import type { AgentToolConfig, ConfigurableAgentArgs } from "../../ConfigurableAgentTool.js";
import type { ChatMessage } from "../../../models/ChatTypes.js";
import { ChatMessageEntity } from "../../../models/ChatTypes.js";
import { MODEL_SENTINELS } from "../../../core/Constants.js";
import { AGENT_VERSION } from "./AgentVersion.js";

/**
 * Create the configuration for the Keyboard Input Action Agent
 */
export function createKeyboardInputActionAgentConfig(): AgentToolConfig {
  return {
    name: 'keyboard_input_action_agent',
    version: AGENT_VERSION,
    description: 'Specialized agent for sending keyboard inputs like Enter, Tab, arrow keys, and other special keys to navigate or interact with the page.',
    systemPrompt: `You are a specialized keyboard input action agent designed to send keyboard inputs to appropriate elements based on the user's objective.

## Your Specialized Skills
You excel at:
1. Determining which keyboard inputs will achieve the user's goal
2. Identifying the right element to focus before sending keyboard input
3. Executing precise keyboard actions for navigation and interaction
4. Understanding the context where keyboard shortcuts are most appropriate

## Process Flow
1. First analyze the page structure using get_page_content to access the accessibility tree
2. Determine which element should receive the keyboard input
3. Identify the appropriate keyboard key to send (Enter, Tab, Arrow keys, etc.)
4. Execute the keyboard action using perform_action tool with the 'press' method
5. If a keyboard action fails, analyze why and try alternative approaches

## Common Keyboard Uses
- Enter key: Submit forms, activate buttons, trigger default actions
- Tab key: Navigate between focusable elements
- Arrow keys: Navigate within components like dropdowns, menus, sliders
- Escape key: Close dialogs, cancel operations
- Space key: Toggle checkboxes, activate buttons
- Modifier combinations: Specialized functions (not all supported in this context)

## Selection Guidelines
When selecting an element for keyboard input, prioritize:
- Elements that are interactive and keyboard-accessible
- Elements that are currently visible and enabled
- Elements that have keyboard event listeners
- Elements that are logical recipients based on the user's objective`,
    tools: [
      'get_page_content',
      'perform_action',
      'extract_data',
    ],
    maxIterations: 5,
    modelName: MODEL_SENTINELS.USE_MINI,
    temperature: 0.7,
    schema: {
      type: 'object',
      properties: {
        objective: {
          type: 'string',
          description: 'The natural language description of what keyboard input to send and to which element (e.g., "press Enter in the search box", "use arrow keys to navigate the menu").'
        },
        key: {
          type: 'string',
          description: 'The specific key to press (e.g., "Enter", "Tab", "ArrowDown").'
        },
        reasoning: {
          type: 'string',
          description: 'Reasoning for invoking this specialized keyboard input agent.'
        },
        hint: {
          type: 'string',
          description: 'Optional feedback from previous failure to help identify the correct element or key to use.'
        }
      },
      required: ['objective', 'reasoning']
    },
    prepareMessages: (args: ConfigurableAgentArgs): ChatMessage[] => {
      return [{
        entity: ChatMessageEntity.USER,
        text: `Keyboard Input Objective: ${args.objective}\n
${args.key ? `Key to Press: ${args.key}\n` : ''}
Reasoning: ${args.reasoning}\n
${args.hint ? `Hint: ${args.hint}` : ''}
`,
      }];
    },
    handoffs: [],
  };
}
