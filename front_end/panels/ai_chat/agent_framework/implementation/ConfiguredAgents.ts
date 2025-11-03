// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { FetcherTool } from '../../tools/FetcherTool.js';
import { FinalizeWithCritiqueTool } from '../../tools/FinalizeWithCritiqueTool.js';
import { SchemaBasedExtractorTool } from '../../tools/SchemaBasedExtractorTool.js';
import { StreamlinedSchemaExtractorTool } from '../../tools/StreamlinedSchemaExtractorTool.js';
import { BookmarkStoreTool } from '../../tools/BookmarkStoreTool.js';
import { DocumentSearchTool } from '../../tools/DocumentSearchTool.js';
import { NavigateURLTool, PerformActionTool, GetAccessibilityTreeTool, SearchContentTool, NavigateBackTool, NodeIDsToURLsTool, TakeScreenshotTool, ScrollPageTool, WaitTool, RenderWebAppTool, GetWebAppDataTool, RemoveWebAppTool, CreateFileTool, UpdateFileTool, DeleteFileTool, ReadFileTool, ListFilesTool } from '../../tools/Tools.js';
import { UpdateTodoTool } from '../../tools/UpdateTodoTool.js';
import { ExecuteCodeTool } from '../../tools/ExecuteCodeTool.js';
import { HTMLToMarkdownTool } from '../../tools/HTMLToMarkdownTool.js';
import { ConfigurableAgentTool, ToolRegistry } from '../ConfigurableAgentTool.js';
import { ThinkingTool } from '../../tools/ThinkingTool.js';
import { registerMCPMetaTools } from '../../mcp/MCPMetaTools.js';
import { createDirectURLNavigatorAgentConfig } from './agents/DirectURLNavigatorAgent.js';
import { createResearchAgentConfig } from './agents/ResearchAgent.js';
import { createContentWriterAgentConfig } from './agents/ContentWriterAgent.js';
import { createActionAgentConfig } from './agents/ActionAgent.js';
import { createActionVerificationAgentConfig } from './agents/ActionVerificationAgent.js';
import { createClickActionAgentConfig } from './agents/ClickActionAgent.js';
import { createFormFillActionAgentConfig } from './agents/FormFillActionAgent.js';
import { createKeyboardInputActionAgentConfig } from './agents/KeyboardInputActionAgent.js';
import { createHoverActionAgentConfig } from './agents/HoverActionAgent.js';
import { createScrollActionAgentConfig } from './agents/ScrollActionAgent.js';
import { createWebTaskAgentConfig } from './agents/WebTaskAgent.js';
import { createEcommerceProductInfoAgentConfig } from './agents/EcommerceProductInfoAgent.js';
import { createSearchAgentConfig } from './agents/SearchAgent.js';

/**
 * Initialize all configured agents
 */
export function initializeConfiguredAgents(): void {
  // Ensure MCP meta-tools are available regardless of mode; selection logic decides if they are surfaced
  registerMCPMetaTools();
  // Register core tools
  ToolRegistry.registerToolFactory('navigate_url', () => new NavigateURLTool());
  ToolRegistry.registerToolFactory('navigate_back', () => new NavigateBackTool());
  ToolRegistry.registerToolFactory('node_ids_to_urls', () => new NodeIDsToURLsTool());
  ToolRegistry.registerToolFactory('fetcher_tool', () => new FetcherTool());
  ToolRegistry.registerToolFactory('extract_data', () => new SchemaBasedExtractorTool());
  ToolRegistry.registerToolFactory('extract_schema_streamlined', () => new StreamlinedSchemaExtractorTool());
  ToolRegistry.registerToolFactory('finalize_with_critique', () => new FinalizeWithCritiqueTool());
  ToolRegistry.registerToolFactory('perform_action', () => new PerformActionTool());
  ToolRegistry.registerToolFactory('get_page_content', () => new GetAccessibilityTreeTool());
  ToolRegistry.registerToolFactory('search_content', () => new SearchContentTool());
  ToolRegistry.registerToolFactory('take_screenshot', () => new TakeScreenshotTool());
  ToolRegistry.registerToolFactory('html_to_markdown', () => new HTMLToMarkdownTool());
  ToolRegistry.registerToolFactory('scroll_page', () => new ScrollPageTool());
  ToolRegistry.registerToolFactory('wait_for_page_load', () => new WaitTool());
  ToolRegistry.registerToolFactory('thinking', () => new ThinkingTool());
  ToolRegistry.registerToolFactory('create_file', () => new CreateFileTool());
  ToolRegistry.registerToolFactory('update_file', () => new UpdateFileTool());
  ToolRegistry.registerToolFactory('delete_file', () => new DeleteFileTool());
  ToolRegistry.registerToolFactory('read_file', () => new ReadFileTool());
  ToolRegistry.registerToolFactory('list_files', () => new ListFilesTool());
  ToolRegistry.registerToolFactory('update_todo', () => new UpdateTodoTool());
  ToolRegistry.registerToolFactory('execute_code', () => new ExecuteCodeTool());

  // Register webapp rendering tools
  ToolRegistry.registerToolFactory('render_webapp', () => new RenderWebAppTool());
  ToolRegistry.registerToolFactory('get_webapp_data', () => new GetWebAppDataTool());
  ToolRegistry.registerToolFactory('remove_webapp', () => new RemoveWebAppTool());

  // Register bookmark and document search tools
  ToolRegistry.registerToolFactory('bookmark_store', () => new BookmarkStoreTool());
  ToolRegistry.registerToolFactory('document_search', () => new DocumentSearchTool());
  
  // Create and register Direct URL Navigator Agent
  const directURLNavigatorAgentConfig = createDirectURLNavigatorAgentConfig();
  const directURLNavigatorAgent = new ConfigurableAgentTool(directURLNavigatorAgentConfig);
  ToolRegistry.registerToolFactory('direct_url_navigator_agent', () => directURLNavigatorAgent);

  // Create and register Research Agent
  const researchAgentConfig = createResearchAgentConfig();
  const researchAgent = new ConfigurableAgentTool(researchAgentConfig);
  ToolRegistry.registerToolFactory('research_agent', () => researchAgent);

  // Create and register Search Agent
  const searchAgentConfig = createSearchAgentConfig();
  const searchAgent = new ConfigurableAgentTool(searchAgentConfig);
  ToolRegistry.registerToolFactory('search_agent', () => searchAgent);

  // Create and register Content Writer Agent
  const contentWriterAgentConfig = createContentWriterAgentConfig();
  const contentWriterAgent = new ConfigurableAgentTool(contentWriterAgentConfig);
  ToolRegistry.registerToolFactory('content_writer_agent', () => contentWriterAgent);

  // Create and register Action Agent
  const actionAgentConfig = createActionAgentConfig();
  const actionAgent = new ConfigurableAgentTool(actionAgentConfig);
  ToolRegistry.registerToolFactory('action_agent', () => actionAgent);

  // Create and register Action Verification Agent
  const actionVerificationAgentConfig = createActionVerificationAgentConfig();
  const actionVerificationAgent = new ConfigurableAgentTool(actionVerificationAgentConfig);
  ToolRegistry.registerToolFactory('action_verification_agent', () => actionVerificationAgent);

  // Create and register specialized action agents
  const clickActionAgentConfig = createClickActionAgentConfig();
  const clickActionAgent = new ConfigurableAgentTool(clickActionAgentConfig);
  ToolRegistry.registerToolFactory('click_action_agent', () => clickActionAgent);

  const formFillActionAgentConfig = createFormFillActionAgentConfig();
  const formFillActionAgent = new ConfigurableAgentTool(formFillActionAgentConfig);
  ToolRegistry.registerToolFactory('form_fill_action_agent', () => formFillActionAgent);

  const keyboardInputActionAgentConfig = createKeyboardInputActionAgentConfig();
  const keyboardInputActionAgent = new ConfigurableAgentTool(keyboardInputActionAgentConfig);
  ToolRegistry.registerToolFactory('keyboard_input_action_agent', () => keyboardInputActionAgent);

  const hoverActionAgentConfig = createHoverActionAgentConfig();
  const hoverActionAgent = new ConfigurableAgentTool(hoverActionAgentConfig);
  ToolRegistry.registerToolFactory('hover_action_agent', () => hoverActionAgent);

  const scrollActionAgentConfig = createScrollActionAgentConfig();
  const scrollActionAgent = new ConfigurableAgentTool(scrollActionAgentConfig);
  ToolRegistry.registerToolFactory('scroll_action_agent', () => scrollActionAgent);

  // Create and register Web Task Agent
  const webTaskAgentConfig = createWebTaskAgentConfig();
  const webTaskAgent = new ConfigurableAgentTool(webTaskAgentConfig);
  ToolRegistry.registerToolFactory('web_task_agent', () => webTaskAgent);

  // Create and register E-commerce Product Information Assistant Agent
  const ecommerceProductInfoAgentConfig = createEcommerceProductInfoAgentConfig();
  const ecommerceProductInfoAgent = new ConfigurableAgentTool(ecommerceProductInfoAgentConfig);
  ToolRegistry.registerToolFactory('ecommerce_product_info_fetcher_tool', () => ecommerceProductInfoAgent);

}
