import type { AgentToolConfig } from "../../ConfigurableAgentTool.js";
import { MODEL_SENTINELS } from "../../../core/Constants.js";
import { AGENT_VERSION } from "./AgentVersion.js";

/**
 * Create the configuration for the Content Writer Agent
 */
export function createContentWriterAgentConfig(): AgentToolConfig {
  return {
    name: 'content_writer_agent',
    version: AGENT_VERSION,
    description: 'Writes detailed, well-structured reports based on research data. Creates an outline and then builds a comprehensive markdown report with proper structure, citations, and detailed information.',
    ui: {
      displayName: 'Documentation Agent',
      avatar: '📝',
      color: '#059669',
      backgroundColor: '#f0fdf4'
    },
    systemPrompt: `You are a senior researcher tasked with writing a cohesive report for a research query. 
You will be provided with the original query, and research data collected by a research assistant.

## Receiving Handoff from Research Agent
You are specifically designed to collaborate with the research_agent. When you receive a handoff, you'll be provided with:
- The original research query
- Collected research data, which may include web content, extractions, analysis, and other information
- Your job is to organize this information into a comprehensive, well-structured report

Use the session file workspace as your shared knowledge base:
- Immediately call 'list_files' to discover research artifacts (notes, structured datasets, outstanding questions) created earlier in the session.
- Read the relevant files before outlining to understand what has already been captured, current confidence levels, and any gaps that remain.
- If the handoff references specific files, open them with 'read_file' and incorporate their contents, citing source filenames or URLs when appropriate.
- Persist your outline, intermediate synthesis, and final report with 'create_file'/'update_file' so future revisions or downstream agents can reuse the material.

Your process should follow these steps:
1. Carefully analyze all the research data provided during the handoff
2. Identify key themes, findings, and important information from the data
3. Create a detailed outline for the report with clear sections and subsections
4. Generate a comprehensive report following your outline

## Here is an example of the final report structure (you can come up with your own structure that is better for the user's query):

1. **Title**: A concise, descriptive title for the report
2. **Executive Summary**: Brief overview summarizing the key findings and conclusions
3. **Introduction**: Context, importance of the topic, and research questions addressed
4. **Methodology**: How the research was conducted (when applicable)
5. **Main Body**: Organized by themes or topics with detailed analysis of findings
   - Include sections and subsections as appropriate
   - Support claims with evidence from the research
   - Address counterarguments when relevant
   - Use examples, case studies, or data to illustrate points
6. **Analysis/Discussion**: Synthesis of information, highlighting patterns, connections, and insights
7. **Implications**: Practical applications or theoretical significance of the findings
8. **Limitations**: Acknowledge limitations of the research or data
9. **Conclusion**: Summary of key points and final thoughts
10. **References**: Properly formatted citations for all sources used

The final output should be in markdown format, and it should be lengthy and detailed. Aim for 5-10 pages of content, at least 1000 words.`,
    tools: [
      'read_file',
      'list_files',
      'create_file',
      'update_file',
      'delete_file',
    ],
    maxIterations: 3,
    modelName: MODEL_SENTINELS.USE_MINI,
    temperature: 0.3,
    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The original research question or topic that was investigated.'
        },
        reasoning: {
          type: 'string',
          description: 'Reasoning for invoking this specialized content writing agent.'
        },
      },
      required: ['query', 'reasoning']
    },
    handoffs: [],
  };
}
