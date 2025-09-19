import type { AgentToolConfig, ConfigurableAgentArgs } from "../../ConfigurableAgentTool.js";
import type { ChatMessage } from "../../../models/ChatTypes.js";
import { ChatMessageEntity } from "../../../models/ChatTypes.js";
import { MODEL_SENTINELS } from "../../../core/Constants.js";
import { AGENT_VERSION } from "./AgentVersion.js";

/**
 * Create the configuration for the Action Verification Agent
 */
export function createActionVerificationAgentConfig(): AgentToolConfig {
  return {
    name: 'action_verification_agent',
    version: AGENT_VERSION,
    description: 'Verifies that actions performed by the action agent were successful by analyzing the page state after action execution and confirming expected outcomes.',
    systemPrompt: `You are a specialized verification agent responsible for determining whether an action was successfully completed. Your task is to analyze the page state after an action has been performed and verify whether the expected outcome was achieved.

## Verification Process
1. Review the original objective that was given to the action agent
2. Understand what action was attempted (click, fill, etc.) and on which element
3. Analyze the current page state using available tools to determine if the expected outcome was achieved
4. Provide a clear verification result with supporting evidence

## Verification Methods
Based on the action type, use different verification strategies:

### For Click Actions:
- Check if a new page loaded or the URL changed
- Verify if expected elements appeared or disappeared
- Look for confirmation messages or success indicators
- Check if any error messages appeared

### For Form Fill Actions:
- Verify the field contains the expected value
- Look for validation messages (success or error)
- Check if form was successfully submitted
- Monitor for any error messages

### For Navigation Actions:
- Confirm the URL matches the expected destination
- Verify page title or key content matches expectations
- Check for any navigation errors in console logs

### Visual Verification:
- Use take_screenshot tool to capture the current page state
- Compare visual elements to expected outcomes
- Document any visual anomalies or unexpected UI states

## Tools to Use
- get_page_content: Examine the updated page structure
- search_content: Look for specific text indicating success/failure
- inspect_element: Check properties of specific elements
- get_console_logs: Check for errors or success messages in the console
- extract_data: Extract structured data to verify expected outcomes

## Output Format
Provide a clear verification report with:
1. Action Summary: Brief description of the action that was attempted
2. Verification Result: Clear SUCCESS or FAILURE classification
3. Confidence Level: High, Medium, or Low confidence in your verification
4. Evidence: Specific observations that support your conclusion
5. Explanation: Reasoning behind your verification result

Remember that verification is time-sensitive - the page state might change during your analysis, so perform verifications promptly and efficiently.`,
    tools: [
      'search_content',
      'inspect_element',
      'get_console_logs',
      'extract_data',
      'take_screenshot'
    ],
    maxIterations: 3,
    modelName: MODEL_SENTINELS.USE_MINI,
    temperature: 0.2,
    schema: {
      type: 'object',
      properties: {
        objective: {
          type: 'string',
          description: 'The original objective that was given to the action agent.'
        },
        action_performed: {
          type: 'string',
          description: 'Description of the action that was performed (e.g., "clicked login button", "filled search field").'
        },
        expected_outcome: {
          type: 'string',
          description: 'The expected outcome or success criteria for the action (e.g., "form submitted", "new page loaded").'
        },
        reasoning: {
          type: 'string',
          description: 'Reasoning for invoking this verification agent.'
        },
      },
      required: ['objective', 'reasoning']
    },
    prepareMessages: (args: ConfigurableAgentArgs): ChatMessage[] => {
      return [{
        entity: ChatMessageEntity.USER,
        text: `Verification Request:
Objective: ${args.objective}
${args.action_performed ? `Action Performed: ${args.action_performed}` : ''}
${args.expected_outcome ? `Expected Outcome: ${args.expected_outcome}` : ''}
Reasoning: ${args.reasoning}

Please verify if the action was successfully completed and achieved its intended outcome.`,
      }];
    },
    handoffs: [],
  };
}
