import type { AgentToolConfig, ConfigurableAgentArgs, ConfigurableAgentResult, CallCtx } from "../../ConfigurableAgentTool.js";
import type { ChatMessage } from "../../../models/ChatTypes.js";
import type { AgentSession } from "../../AgentSessionTypes.js";
import { ChatMessageEntity } from "../../../models/ChatTypes.js";
import { MODEL_SENTINELS } from "../../../core/Constants.js";
import { AGENT_VERSION } from "./AgentVersion.js";
import { createLogger } from "../../../core/Logger.js";
import { FileStorageManager } from "../../../tools/FileStorageManager.js";
import type { FetcherToolResult } from "../../../tools/FetcherTool.js";

const logger = createLogger('ResearchAgent');

/**
 * Create the configuration for the Research Agent
 */
export function createResearchAgentConfig(): AgentToolConfig {
  return {
    name: 'research_agent',
    version: AGENT_VERSION,
    description: 'Performs in-depth research on a specific query autonomously using multiple steps and internal tool calls (navigation, fetching, extraction). Returns comprehensive research findings with proper citations and structured data.',
    ui: {
      displayName: 'Research Agent',
      avatar: '🔍',
      color: '#3b82f6',
      backgroundColor: '#f8fafc'
    },
    systemPrompt: `You are a research agent. Execute systematic research using your tools autonomously.

## Task Inputs & Scope
- **query**: Research objective
- **context**: Constraints/focus areas (optional)
- **scope**: focused (5-10 tool calls), comprehensive (10-15), exploratory (15-30)

## CRITICAL REQUIREMENT
**YOU MUST CREATE FILES BEFORE COMPLETING**: Never return a final answer until you have successfully created both required files ([topic]_research.md and [topic]_sources.json). The files are the PRIMARY deliverable - your final answer is just a confirmation that files exist.

## Core Research Workflow
1. Navigate to search engines (navigate_url)
2. Extract URLs from results (extract_data - provide JSON schema)
3. **CRITICAL**: Batch fetch all URLs at once (fetcher_tool with array: {urls: [url1, url2, ...]} - NEVER fetch individually)
4. Analyze content and iterate with different queries
5. Target 10+ sources minimum, max 30 tool calls total
6. **MANDATORY**: Create both required files before returning final answer

## Key Tools
- **navigate_url + fetcher_tool**: Primary research loop
- **extract_data**: Structured data extraction with JSON schema
- **html_to_markdown**: Clean page text extraction
- **create_file/update_file/read_file/list_files**: Persist and track findings across iterations

## Quality Standards
- Prioritize reputable, recent sources over aggregators
- Distinguish facts from speculation ("could", "may" indicate speculation)
- Use moderately broad queries (under 5 words)
- Cite URLs, publication dates, authors for all findings
- Extract specific quotes, statistics, concrete data

## File Output (MANDATORY - DO NOT SKIP)
**CRITICAL**: You MUST create files BEFORE returning your final answer. Files are the PRIMARY deliverable.

Create descriptive file names based on your research topic. Use format: topic-slug_type.ext

**REQUIRED FILES (Both must be created)**:

1. **[topic]_research.md** (5000+ words) - REQUIRED
   - Executive summary (2-3 paragraphs)
   - Detailed findings organized by theme
   - Source citations with quotes, statistics, analysis
   - Data quality assessment and limitations
   - Comprehensive conclusions
   - Methodology section: search strategy, tools used, confidence level, suggested follow-up

2. **[topic]_sources.json** - REQUIRED
   - Structured metadata: url, title, author, publishDate, credibilityScore, keyFindings, quotes
   - Include totalSources, searchStrategy, completedAt

Example for "AI trends in 2025": ai-trends-2025_research.md, ai-trends-2025_sources.json

**VERIFICATION CHECKLIST** (Complete before final answer):
- [ ] Created [topic]_research.md with 5000+ words of detailed findings
- [ ] Created [topic]_sources.json with structured source metadata
- [ ] Both files use descriptive, topic-based names
- [ ] Files contain all research data gathered

## Final Answer Format
**ONLY AFTER FILES ARE CREATED**, return BRIEF confirmation (2-3 sentences):
"Research completed on [topic]. Created 'filename_research.md' with [N] sources in 'filename_sources.json'. Key finding: [one sentence summary]."

**IMPORTANT**:
- DO NOT return final answer until BOTH files are created
- Use descriptive, unique file names based on topic
- All detailed content goes in FILES, not in final answer
- Your final answer should reference the actual file names you created`,
    tools: [
      'navigate_url',
      'navigate_back',
      'fetcher_tool',
      'extract_data',
      'node_ids_to_urls',
      'html_to_markdown',
      'create_file',
      'update_file',
      'read_file',
      'list_files',
    ],
    maxIterations: 30,
    modelName: MODEL_SENTINELS.USE_MINI,
    temperature: 0,
    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The specific research task to accomplish, including clear requirements and expected deliverables.'
        },
        reasoning: {
          type: 'string',
          description: 'Clear explanation for the user about why this research is being conducted and what to expect.'
        },
        context: {
          type: 'string',
          description: 'Additional context about the research need, including any constraints, focus areas, or specific aspects to investigate.'
        },
        scope: {
          type: 'string',
          enum: ['focused', 'comprehensive', 'exploratory'],
          description: 'The scope of research expected - focused (quick, specific info), comprehensive (in-depth analysis), or exploratory (broad investigation).',
          default: 'comprehensive'
        },
      },
      required: ['query', 'reasoning']
    },
    prepareMessages: (args: ConfigurableAgentArgs): ChatMessage[] => {
      // For the action agent, we use the objective as the primary input, not the query field
      return [{
        entity: ChatMessageEntity.USER,
        text: `Task: ${args.query? `${args.query}` : ''} 
        ${args.task? `${args.task}` : ''} 
        ${args.objective? `${args.objective}` : ''} 
${args.context ? `Context: ${args.context}` : ''}
${args.scope ? `The scope of research expected: ${args.scope}` : ''}
`,
      }];
    },
    handoffs: [],
    afterExecute: async (result: ConfigurableAgentResult, agentSession: AgentSession, _callCtx: CallCtx): Promise<void> => {
      logger.info('===== ResearchAgent afterExecute hook started =====');
      logger.info(`Agent session has ${agentSession.messages.length} messages`);

      try {
        const fileManager = FileStorageManager.getInstance();
        let savedCount = 0;
        let fetcherToolCount = 0;

        // Iterate through all messages in the session to find fetcher_tool results
        for (const message of agentSession.messages) {
          // Type narrow to ToolResultMessage
          if (message.type !== 'tool_result') {
            continue;
          }

          const toolResult = message.content as { type: 'tool_result'; toolName: string; result?: any };

          // Check if this is a fetcher_tool result
          if (toolResult.toolName === 'fetcher_tool' && toolResult.result) {
            fetcherToolCount++;
            logger.info(`Found fetcher_tool result #${fetcherToolCount}`);
            const fetcherResult = toolResult.result as FetcherToolResult;

            // Process each source in the fetcher result
            if (fetcherResult.sources && Array.isArray(fetcherResult.sources)) {
              for (const source of fetcherResult.sources) {
                // Only save successful fetches with content
                if (source.success && source.markdownContent && source.markdownContent.trim().length > 0) {
                  try {
                    // Create a sanitized filename from the URL
                    const filename = sanitizeUrlToFilename(source.url);

                    // Create file content with metadata header
                    const fileContent = `# ${source.title || 'Untitled'}

**Source URL:** ${source.url}
**Fetched:** ${new Date().toISOString()}

---

${source.markdownContent}`;

                    // Save to the research/ subdirectory
                    try {
                      await fileManager.createFile(`research-${filename}`, fileContent, 'text/markdown');
                      logger.info(`✓ Created file: research-${filename} (${source.url})`);
                    } catch (createError: any) {
                      // If file exists, try to update it instead
                      if (createError.message?.includes('already exists')) {
                        await fileManager.updateFile(`research-${filename}`, fileContent);
                        logger.info(`✓ Updated file: research-${filename} (${source.url})`);
                      } else {
                        throw createError;
                      }
                    }
                    savedCount++;
                  } catch (error) {
                    logger.warn(`Failed to save fetcher result for ${source.url}:`, error);
                  }
                }
              }
            }
          }
        }

        logger.info('===== ResearchAgent afterExecute summary =====');
        logger.info(`Found ${fetcherToolCount} fetcher_tool calls`);
        logger.info(`Successfully saved ${savedCount} files`);

        if (savedCount > 0) {
          logger.info(`✓ ResearchAgent afterExecute: Saved ${savedCount} fetched sources to files`);
        } else {
          if (fetcherToolCount === 0) {
            logger.warn('⚠ No fetcher_tool results found in session messages');
          } else {
            logger.warn('⚠ Found fetcher_tool results but no files were saved (check for errors above)');
          }
        }
      } catch (error: any) {
        logger.error('❌ ResearchAgent afterExecute: Failed to save fetcher results:', error);
        logger.error('Error details:', { message: error.message, stack: error.stack });
        // Don't throw - we don't want to break the agent execution
      }
    },
  };
}

/**
 * Sanitize a URL to create a safe filename
 */
function sanitizeUrlToFilename(url: string): string {
  try {
    const urlObj = new URL(url);

    // Extract domain and path
    let domain = urlObj.hostname.replace(/^www\./, '');
    let path = urlObj.pathname.replace(/^\//, '').replace(/\/$/, '');

    // Create a base name from domain and path
    let baseName = domain;
    if (path) {
      // Take first 2 path segments for readability
      const pathParts = path.split('/').filter(p => p.length > 0);
      if (pathParts.length > 0) {
        baseName += '-' + pathParts.slice(0, 2).join('-');
      }
    }

    // Remove special characters and limit length
    baseName = baseName
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 80);

    // Add a short hash of the full URL to prevent collisions
    const hash = simpleHash(url).substring(0, 8);

    return `${baseName}-${hash}.md`;
  } catch (error) {
    // Fallback for invalid URLs
    const hash = simpleHash(url);
    return `source-${hash}.md`;
  }
}

/**
 * Simple hash function for generating short unique identifiers
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
