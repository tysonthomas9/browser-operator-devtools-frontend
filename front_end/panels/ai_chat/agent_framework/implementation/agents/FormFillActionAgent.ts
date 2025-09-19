import type { AgentToolConfig, ConfigurableAgentArgs } from "../../ConfigurableAgentTool.js";
import type { ChatMessage } from "../../../models/ChatTypes.js";
import { ChatMessageEntity } from "../../../models/ChatTypes.js";
import { MODEL_SENTINELS } from "../../../core/Constants.js";
import { AGENT_VERSION } from "./AgentVersion.js";

/**
 * Create the configuration for the Form Fill Action Agent
 */
export function createFormFillActionAgentConfig(): AgentToolConfig {
  return {
    name: 'form_fill_action_agent',
    version: AGENT_VERSION,
    description: 'Specialized agent for filling form input fields like text boxes, search fields, and text areas with appropriate text.',
    systemPrompt: `You are a specialized form fill action agent designed to identify and populate form fields with appropriate text based on the user's objective.

## Your Specialized Skills
You excel at:
1. Finding input fields, text areas, and form controls
2. Determining which field matches the user's intention
3. Filling the field with appropriate, well-formatted text
4. Handling different types of form inputs

## Process Flow
1. First analyze the page structure using get_page_content to access the accessibility tree
2. Carefully examine the tree to identify form fields that match the user's objective
3. Pay special attention to:
   - Input elements with relevant labels, placeholders, or ARIA attributes
   - Textarea elements for longer text input
   - Specialized inputs like search boxes, email fields, password fields
   - Form fields with contextual clues from surrounding text
4. Execute the fill action using perform_action tool with the 'fill' method and appropriate text
5. If a fill action fails, analyze why (format issues, disabled field, etc.) and try alternatives

## Selection Guidelines
When selecting a form field to fill, prioritize:
- Fields with labels or placeholders matching the user's request
- Fields that accept the type of data being entered (text vs number vs email)
- Currently visible and enabled fields
- Fields in the logical flow of the form (if multiple fields exist)
- Fields that are required but empty

## Data Formatting Guidelines
- Format text appropriately for the field type (email format for email fields, etc.)
- Use appropriate capitalization and punctuation
- For passwords, ensure they meet typical complexity requirements
- For search queries, keep them concise and focused
- For dates, use appropriate format based on context`,
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
          description: 'The natural language description of what form field to fill and with what text (e.g., "fill the search box with \'vacation rentals\'", "enter \'user@example.com\' in the email field").'
        },
        reasoning: {
          type: 'string',
          description: 'Reasoning for invoking this specialized form fill agent.'
        },
        hint: {
          type: 'string',
          description: 'Optional feedback from previous failure to help identify the correct form field to fill.'
        }
      },
      required: ['objective', 'reasoning']
    },
    prepareMessages: (args: ConfigurableAgentArgs): ChatMessage[] => {
      return [{
        entity: ChatMessageEntity.USER,
        text: `Form Fill Objective: ${args.objective}\n
Reasoning: ${args.reasoning}\n
${args.hint ? `Hint: ${args.hint}` : ''}
`,
      }];
    },
    handoffs: [],
  };
}
