/**
 * Tool Setup for Eval Runner
 *
 * Registers DevTools tools and agents needed for eval tests.
 * This is a lighter version of initializeConfiguredAgents that
 * skips browser-specific initializations.
 */

import { ConfigurableAgentTool, ToolRegistry } from '../../../front_end/panels/ai_chat/agent_framework/ConfigurableAgentTool.ts';

// Import tools
import {
  NavigateURLTool,
  PerformActionTool,
  GetAccessibilityTreeTool,
  GetVisibleAccessibilityTreeTool,
  SearchContentTool,
  NavigateBackTool,
  TakeScreenshotTool,
  ScrollPageTool,
  WaitTool,
  ExecuteJavaScriptTool,
  ClickElementTool,
} from '../../../front_end/panels/ai_chat/tools/Tools.ts';

// Import agent configs
import { createActionAgentConfig } from '../../../front_end/panels/ai_chat/agent_framework/implementation/agents/ActionAgent.ts';
import { createWebTaskAgentConfig } from '../../../front_end/panels/ai_chat/agent_framework/implementation/agents/WebTaskAgent.ts';
import { createResearchAgentConfig } from '../../../front_end/panels/ai_chat/agent_framework/implementation/agents/ResearchAgent.ts';

// DOM tools registration is lazy-loaded since it requires SDK (browser-only)

/**
 * Setup tools and agents for eval runner context.
 * Only registers tools needed for eval tests, skipping browser-specific features.
 */
export async function setupToolsForEval(): Promise<void> {
  console.log('[ToolSetup] Registering tools for eval runner...');

  // Skip DOM tools in Node.js - they require browser SDK
  // DOM tools (hybrid accessibility tree, EncodedId resolver) will be available in browser only

  // Register core tools
  ToolRegistry.registerToolFactory('navigate_url', () => new NavigateURLTool());
  ToolRegistry.registerToolFactory('navigate_back', () => new NavigateBackTool());
  ToolRegistry.registerToolFactory('perform_action', () => new PerformActionTool());
  ToolRegistry.registerToolFactory('get_page_content', () => new GetAccessibilityTreeTool());
  ToolRegistry.registerToolFactory('get_visible_content', () => new GetVisibleAccessibilityTreeTool());
  ToolRegistry.registerToolFactory('search_content', () => new SearchContentTool());
  ToolRegistry.registerToolFactory('take_screenshot', () => new TakeScreenshotTool());
  ToolRegistry.registerToolFactory('scroll_page', () => new ScrollPageTool());
  ToolRegistry.registerToolFactory('wait_for_page_load', () => new WaitTool());
  ToolRegistry.registerToolFactory('execute_javascript', () => new ExecuteJavaScriptTool());
  ToolRegistry.registerToolFactory('click_element', () => new ClickElementTool());

  // Register Action Agent
  const actionAgentConfig = createActionAgentConfig();
  const actionAgent = new ConfigurableAgentTool(actionAgentConfig);
  ToolRegistry.registerToolFactory('action_agent', () => actionAgent);

  // Register Web Task Agent
  const webTaskAgentConfig = createWebTaskAgentConfig();
  const webTaskAgent = new ConfigurableAgentTool(webTaskAgentConfig);
  ToolRegistry.registerToolFactory('web_task_agent', () => webTaskAgent);

  // Register Research Agent
  const researchAgentConfig = createResearchAgentConfig();
  const researchAgent = new ConfigurableAgentTool(researchAgentConfig);
  ToolRegistry.registerToolFactory('research_agent', () => researchAgent);

  // Verify key agents are available
  const registeredActionAgent = ToolRegistry.getRegisteredTool('action_agent');
  const registeredWebTaskAgent = ToolRegistry.getRegisteredTool('web_task_agent');

  if (!registeredActionAgent || !registeredWebTaskAgent) {
    throw new Error('Failed to initialize required agents');
  }

  console.log('[ToolSetup] Tools registered successfully');
  console.log(`[ToolSetup] Available tools: ${ToolRegistry.getRegisteredToolNames().join(', ')}`);
}
