import type { AgentToolConfig, ConfigurableAgentArgs } from "../../ConfigurableAgentTool.js";
import type { ChatMessage } from "../../../models/ChatTypes.js";
import { ChatMessageEntity } from "../../../models/ChatTypes.js";
import { MODEL_SENTINELS } from "../../../core/Constants.js";
import { AGENT_VERSION } from "./AgentVersion.js";

/**
 * Create the configuration for the Click Action Agent
 */
export function createClickActionAgentConfig(): AgentToolConfig {
  return {
    name: 'click_action_agent',
    version: AGENT_VERSION,
    description: 'Specialized agent for clicking buttons, links, and other clickable elements on a webpage. Note: For checkboxes, prefer using check/uncheck methods for better reliability.',
    systemPrompt: `You are a specialized click action agent designed to find and click on the most appropriate element based on the user's objective.

## Your Specialized Skills
You excel at:
1. Finding clickable elements such as buttons, links, and interactive controls
2. Determining which element best matches the user's intention
3. Executing precise click actions to trigger the intended interaction

## Important: When NOT to Use Click
- For checkboxes: Use 'check'/'uncheck' methods instead for better reliability
- For dropdown/select elements: Use 'selectOption' method instead

## Process Flow
1. First analyze the page structure using get_page_content to access the accessibility tree
2. Carefully examine the tree to identify clickable elements that match the user's objective
3. Pay special attention to:
   - Button elements with matching text
   - Link elements with relevant text
   - Radio buttons (for checkboxes, prefer check/uncheck methods)
   - Elements with click-related ARIA roles
   - Elements with descriptive text nearby that matches the objective
4. Execute the click action using perform_action tool with the 'click' method
5. If a click fails, try alternative elements that might fulfill the same function

## Selection Guidelines
When selecting an element to click, prioritize:
- Elements with exact text matches to the user's request
- Elements with clear interactive roles (button, link)
- Elements positioned logically in the page context
- Elements with appropriate ARIA labels or descriptions
- Elements that are currently visible and enabled`,
    tools: [
      'get_page_content',
      'perform_action',
      'extract_data',
      'node_ids_to_urls',
    ],
    maxIterations: 5,
    modelName: MODEL_SENTINELS.USE_MINI,
    temperature: 0.7,
    schema: {
      type: 'object',
      properties: {
        objective: {
          type: 'string',
          description: 'The natural language description of what to click (e.g., "click the login button", "select the checkbox").'
        },
        reasoning: {
          type: 'string',
          description: 'Reasoning for invoking this specialized click agent.'
        },
        hint: {
          type: 'string',
          description: 'Optional feedback from previous failure to help identify the correct element to click.'
        }
      },
      required: ['objective', 'reasoning']
    },
    prepareMessages: (args: ConfigurableAgentArgs): ChatMessage[] => {
      return [{
        entity: ChatMessageEntity.USER,
        text: `Click Objective: ${args.objective}\n
Reasoning: ${args.reasoning}\n
${args.hint ? `Hint: ${args.hint}` : ''}
`,
      }];
    },
    handoffs: [],
  };
}
