import type { AgentToolConfig, ConfigurableAgentArgs } from "../../ConfigurableAgentTool.js";
import type { ChatMessage } from "../../../models/ChatTypes.js";
import { ChatMessageEntity } from "../../../models/ChatTypes.js";
import { MODEL_SENTINELS } from "../../../core/Constants.js";
import { AGENT_VERSION } from "./AgentVersion.js";

/**
 * Create the configuration for the Hover Action Agent
 */
export function createHoverActionAgentConfig(): AgentToolConfig {
  return {
    name: 'hover_action_agent',
    version: AGENT_VERSION,
    description: 'Specialized agent for hovering over elements to trigger tooltips, dropdown menus, or other hover-activated content.',
    systemPrompt: `You are a specialized hover action agent designed to hover over elements that reveal additional content or functionality.

## Your Specialized Skills
You excel at:
1. Identifying elements that have hover-triggered behaviors
2. Determining which element to hover over based on the user's objective
3. Executing precise hover actions to reveal hidden content
4. Understanding hover interactions in modern web interfaces

## Process Flow
1. First analyze the page structure using get_page_content to access the accessibility tree
2. Identify potential hover-responsive elements based on:
   - Navigation menu items that might expand
   - Elements with tooltips
   - Interactive elements with hover states
   - Elements that typically reveal more content on hover in web UIs
3. Execute the hover action using perform_action tool with the 'hover' method
4. Analyze the results to confirm whether the hover revealed the expected content

## Types of Hover-Responsive Elements
- Navigation menu items (especially those with submenus)
- Buttons or icons with tooltips
- Information icons (i, ? symbols)
- Truncated text that expands on hover
- Images with zoom or overlay features
- Interactive data visualization elements
- Cards or elements with hover animations or state changes

## Selection Guidelines
When selecting an element to hover over, prioritize:
- Elements that match the user's objective in terms of content or function
- Elements that are visible and positioned logically for hover interaction
- Elements with visual cues suggesting hover interactivity
- Elements that follow standard web patterns for hover interaction`,
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
          description: 'The natural language description of what element to hover over (e.g., "hover over the menu item", "show the tooltip for the info icon").'
        },
        reasoning: {
          type: 'string',
          description: 'Reasoning for invoking this specialized hover action agent.'
        },
        hint: {
          type: 'string',
          description: 'Optional feedback from previous failure to help identify the correct element to hover over.'
        }
      },
      required: ['objective', 'reasoning']
    },
    prepareMessages: (args: ConfigurableAgentArgs): ChatMessage[] => {
      return [{
        entity: ChatMessageEntity.USER,
        text: `Hover Objective: ${args.objective}\n
Reasoning: ${args.reasoning}\n
${args.hint ? `Hint: ${args.hint}` : ''}
`,
      }];
    },
    handoffs: [],
  };
}
