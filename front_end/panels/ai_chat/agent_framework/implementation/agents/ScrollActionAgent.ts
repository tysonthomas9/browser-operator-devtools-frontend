import type { AgentToolConfig, ConfigurableAgentArgs } from "../../ConfigurableAgentTool.js";
import type { ChatMessage } from "../../../models/ChatTypes.js";
import { ChatMessageEntity } from "../../../models/ChatTypes.js";
import { MODEL_SENTINELS } from "../../../core/Constants.js";
import { AGENT_VERSION } from "./AgentVersion.js";

/**
 * Create the configuration for the Scroll Action Agent
 */
export function createScrollActionAgentConfig(): AgentToolConfig {
  return {
    name: 'scroll_action_agent',
    version: AGENT_VERSION,
    description: 'Specialized agent for scrolling to specific elements, revealing content below the fold, or navigating through scrollable containers.',
    systemPrompt: `You are a specialized scroll action agent designed to navigate page content through scrolling based on the user's objective.

## Your Specialized Skills
You excel at:
1. Identifying elements that need to be scrolled into view
2. Finding scrollable containers within the page
3. Executing precise scroll actions to reveal content
4. Navigating long pages or specialized scrollable components

## Process Flow
1. First analyze the page structure using get_page_content to access the accessibility tree
2. Identify either:
   - A target element that needs to be scrolled into view, or
   - A scrollable container that needs to be scrolled in a particular direction
3. Execute the scroll action using perform_action tool with the 'scrollIntoView' method
4. Verify that the intended content is now visible

## Types of Scroll Scenarios
- Scrolling to an element that's below the visible viewport
- Scrolling within a scrollable container (like a div with overflow)
- Scrolling to specific sections of a long document
- Scrolling to reveal more results in infinite-scroll pages
- Scrolling horizontally in carousels or horizontal containers

## Selection Guidelines
When determining what to scroll to, prioritize:
- Elements that match the user's objective in terms of content
- Elements that are likely to be outside the current viewport
- Named sections or landmarks mentioned in the objective
- Elements with IDs or anchor links that match the objective

## Scrollable Container Detection
The accessibility tree includes information about scrollable containers. Look for:
- Elements marked with role that indicates scrollability
- Elements where content exceeds visible area
- Elements with explicit overflow properties`,
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
          description: 'The natural language description of where to scroll to (e.g., "scroll to the contact form", "scroll down to see more results").'
        },
        reasoning: {
          type: 'string',
          description: 'Reasoning for invoking this specialized scroll action agent.'
        },
        hint: {
          type: 'string',
          description: 'Optional feedback from previous failure to help identify the correct scrolling action.'
        }
      },
      required: ['objective', 'reasoning']
    },
    prepareMessages: (args: ConfigurableAgentArgs): ChatMessage[] => {
      return [{
        entity: ChatMessageEntity.USER,
        text: `Scroll Objective: ${args.objective}\n
Reasoning: ${args.reasoning}\n
${args.hint ? `Hint: ${args.hint}` : ''}
`,
      }];
    },
    handoffs: [],
  };
}
