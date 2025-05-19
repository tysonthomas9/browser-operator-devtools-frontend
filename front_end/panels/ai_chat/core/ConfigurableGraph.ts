// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { type AgentState } from './State.js';
import { type ChatOpenAI } from './ChatOpenAI.js';
import { StateGraph } from './StateGraph.js';
import { createAgentNode, createFinalNode, createToolExecutorNode, routeNextNode } from './Graph.js';
import { NodeType } from './Types.js';
import type { CompiledGraph, Runnable } from './Types.js';
import { ChatPromptFormatter } from './GraphHelpers.js';

/**
 * Defines the structure for the JSON configuration of a StateGraph.
 */
export interface GraphNodeConfig {
  name: string;
  type: string; // e.g., "agent", "toolExecutor", "final"
}

export interface GraphEdgeTargetMap {
  [key: string]: string; // condition outcome key -> target node name
}

export interface GraphEdgeConfig {
  source: string;
  conditionType: string; // e.g., "routeBasedOnLastMessage", "alwaysAgent", "routeOrPrepareToolExecutor"
  targetMap: GraphEdgeTargetMap;
}

export interface GraphConfig {
  name: string;
  entryPoint: string;
  nodes: GraphNodeConfig[];
  edges: GraphEdgeConfig[];
}

/**
 * Creates a compiled agent graph from a configuration object.
 *
 * @param config The graph configuration.
 * @param openAiModel The ChatOpenAI model instance, already initialized.
 * @returns A compiled StateGraph.
 */
export function createAgentGraphFromConfig(
  config: GraphConfig,
  openAiModel: ChatOpenAI,
): CompiledGraph {
  console.log(`[ConfigurableGraph] Creating graph from config: ${config.name}`);

  const graph = new StateGraph<AgentState>({ name: config.name });

  const nodeFactories: Record<string, (model: ChatOpenAI, nodeConfig: GraphNodeConfig, graphInstance?: StateGraph<AgentState>) => Runnable<AgentState, AgentState>> = {
    'agent': (model) => createAgentNode(model, new ChatPromptFormatter()),
    'final': () => createFinalNode(),
    'toolExecutor': (_model, nodeCfg) => {
      return {
        invoke: async (state: AgentState) => {
          console.warn(`[ConfigurableGraph] ToolExecutorNode "${nodeCfg.name}" invoked without being dynamically replaced. This indicates an issue.`);
          return { ...state, error: `ToolExecutor ${nodeCfg.name} not properly initialized.` };
        }
      };
    },
  };

  for (const nodeConfig of config.nodes) {
    const factory = nodeFactories[nodeConfig.type];
    if (factory) {
      const nodeInstance = factory(openAiModel, nodeConfig, graph);
      graph.addNode(nodeConfig.name, nodeInstance);
      console.log(`[ConfigurableGraph] Added node: ${nodeConfig.name} (type: ${nodeConfig.type})`);
    } else {
      console.warn(`[ConfigurableGraph] Unknown node type: ${nodeConfig.type} for node ${nodeConfig.name}. Adding a dummy error node.`);
      graph.addNode(nodeConfig.name, {
        invoke: async (state: AgentState) => {
          console.error(`[ConfigurableGraph] Dummy node ${nodeConfig.name} invoked due to unknown type ${nodeConfig.type}`);
          return { ...state, error: `Unknown node type ${nodeConfig.type} for ${nodeConfig.name}` };
        }
      });
    }
  }

  type ConditionFunctionGenerator = (state: AgentState, graphInstance: StateGraph<AgentState>, edgeConfig: GraphEdgeConfig, model: ChatOpenAI) => string;

  const conditionFactories: Record<string, ConditionFunctionGenerator> = {
    'routeBasedOnLastMessage': (state) => routeNextNode(state),
    'alwaysAgent': () => NodeType.AGENT.toString(),
    'routeOrPrepareToolExecutor': (state, graphInstance, edgeConfig) => {
      const routingKey = routeNextNode(state);
      if (routingKey === NodeType.TOOL_EXECUTOR.toString()) {
        const toolExecutorNodeName = edgeConfig.targetMap[NodeType.TOOL_EXECUTOR.toString()];
        if (toolExecutorNodeName && toolExecutorNodeName !== '__end__') {
          console.log(`[ConfigurableGraph Cond] Dynamically creating/updating tool executor: ${toolExecutorNodeName}`);
          const toolExecutorInstance = createToolExecutorNode(state);
          graphInstance.addNode(toolExecutorNodeName, toolExecutorInstance);
        } else {
          console.error('[ConfigurableGraph Cond] Tool executor node name not found in targetMap or is __end__. Routing to __end__.');
          return '__end__';
        }
      }
      return routingKey;
    },
  };

  for (const edgeConfig of config.edges) {
    const conditionFactory = conditionFactories[edgeConfig.conditionType];
    if (conditionFactory) {
      const conditionFn = (state: AgentState) => {
        return conditionFactory(state, graph, edgeConfig, openAiModel);
      };
      graph.addConditionalEdges(edgeConfig.source, conditionFn, edgeConfig.targetMap);
      console.log(`[ConfigurableGraph] Added edge from ${edgeConfig.source} via ${edgeConfig.conditionType}`);
    } else {
      console.warn(`[ConfigurableGraph] Unknown condition type: ${edgeConfig.conditionType} for edge from ${edgeConfig.source}`);
    }
  }

  if (config.nodes.find(n => n.name === config.entryPoint)) {
    graph.setEntryPoint(config.entryPoint);
    console.log(`[ConfigurableGraph] Set entry point to: ${config.entryPoint}`);
  } else {
    console.error(`[ConfigurableGraph] Entry point "${config.entryPoint}" not found in defined nodes.`);
    if (config.nodes.length > 0) {
        const fallbackEntryPoint = config.nodes[0].name;
        graph.setEntryPoint(fallbackEntryPoint);
        console.warn(`[ConfigurableGraph] Setting entry point to fallback: ${fallbackEntryPoint}`);
    } else {
        throw new Error("[ConfigurableGraph] No nodes defined in graph config, cannot set entry point.");
    }
  }

  return graph.compile();
} 