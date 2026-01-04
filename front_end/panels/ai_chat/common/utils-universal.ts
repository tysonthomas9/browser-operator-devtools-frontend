/**
 * Universal Utils - CDP-adapter compatible utility functions
 *
 * These functions work with both DevTools SDK and direct CDP connections
 * by using the CDPSessionAdapter interface.
 *
 * Usage:
 * - In DevTools: new SDKTargetAdapter(target)
 * - In eval runner: new DirectCDPAdapter(chromeRemoteInterfaceClient)
 */

import type {CDPSessionAdapter} from '../cdp/CDPSessionAdapter.js';
import {FrameRegistryUniversal} from '../cdp/FrameRegistryUniversal.js';
import type {AccessibilityNode, TreeResult, BackendIdMaps} from './context.js';
import {XPATH_BUILDER_FUNCTION_STRING} from './xpath-builder.js';
import {getQuadCenter} from './geometry-helpers.js';
import {
  getElementCenterFromObjectId,
  getElementCenterFromBackendNodeId,
  dispatchClick,
  dispatchMouseMove,
  dispatchDrag,
} from './mouse-helpers.js';

/**
 * Simple logger that works in both browser and Node.js
 */
const logger = {
  info: (...args: unknown[]) => console.log('[utils-universal]', ...args),
  warn: (...args: unknown[]) => console.warn('[utils-universal]', ...args),
  error: (...args: unknown[]) => console.error('[utils-universal]', ...args),
};

// ============================================================================
// Constants
// ============================================================================

/** Maximum time to wait for element position to stabilize after scroll */
const SCROLL_STABILIZATION_TIMEOUT_MS = 1000;

/** Interval for checking if element position has stabilized */
const POSITION_CHECK_INTERVAL_MS = 50;

// ============================================================================
// Tree Formatting Functions (pure functions, no CDP needed)
// ============================================================================

/**
 * Formats an accessibility node tree into a simplified string representation
 */
export function formatSimplifiedTree(node: AccessibilityNode, level = 0): string {
  const indent = '  '.repeat(level);
  let result = `${indent}[${node.nodeId}] ${node.role}${node.name ? `: ${node.name}` : ''}\n`;

  if (node.children?.length) {
    result += node.children.map(child => formatSimplifiedTree(child, level + 1)).join('');
  }
  return result;
}

/**
 * Helper function to recursively build a subtree from a flat list of nodes.
 */
function buildSubtreeRecursive(
    nodeId: string,
    nodeMap: Map<string, AccessibilityNode>,
): AccessibilityNode|null {
  const nodeIdNum = parseInt(nodeId, 10);
  if (isNaN(nodeIdNum) || nodeIdNum < 0) {
    return null;
  }

  const currentNode = nodeMap.get(nodeId);
  if (!currentNode) {
    return null;
  }

  const newNode: AccessibilityNode = {
    ...currentNode,
    children: [],
  };

  if (currentNode.childIds && currentNode.childIds.length > 0) {
    newNode.children = currentNode.childIds
                           .map(childId => buildSubtreeRecursive(childId, nodeMap))
                           .filter((child): child is AccessibilityNode => child !== null);
  }

  delete newNode.childIds;
  delete newNode.parentId;

  return newNode;
}

// ============================================================================
// Backend ID Maps
// ============================================================================

/**
 * Builds backend ID mappings for DOM nodes.
 * Returns tagNameMap (backendNodeId -> tagName) and xpathMap (backendNodeId -> xpath).
 */
export async function buildBackendIdMaps(adapter: CDPSessionAdapter): Promise<BackendIdMaps> {
  const domAgent = adapter.domAgent();

  try {
    const response = await domAgent.invoke<{root: any}>('getDocument', {
      depth: -1,
      pierce: true,
    });
    const root = response.root;

    const tagNameMap: Record<number, string> = {};
    const xpathMap: Record<number, string> = {};

    const walkNode = (node: any, path: string): void => {
      if (node.backendNodeId) {
        const tag = String(node.nodeName).toLowerCase();
        tagNameMap[node.backendNodeId] = tag;
        xpathMap[node.backendNodeId] = path;
      }

      // Walk shadow roots first (CDP includes these when pierce: true)
      // Shadow root children share XPath context with the host element
      if (node.shadowRoots?.length) {
        for (const shadowRoot of node.shadowRoots) {
          // Shadow root contents use the same path as the host element
          // since XPath doesn't have native shadow DOM support
          walkNode(shadowRoot, path);
        }
      }

      if (!node.children?.length) {
        return;
      }

      const counters: Record<string, number> = {};

      for (const child of node.children) {
        const name = String(child.nodeName).toLowerCase();
        const counterKey = `${child.nodeType}:${name}`;
        const idx = (counters[counterKey] = (counters[counterKey] ?? 0) + 1);

        let seg: string;
        if (child.nodeType === 3) {
          seg = `text()[${idx}]`;
        } else if (child.nodeType === 8) {
          seg = `comment()[${idx}]`;
        } else {
          seg = `${name}[${idx}]`;
        }

        walkNode(child, `${path}/${seg}`);
      }
    };

    walkNode(root, '');

    logger.info(
        `Built backend ID maps: ${Object.keys(tagNameMap).length} tag mappings, ${Object.keys(xpathMap).length} xpath mappings`);

    return {tagNameMap, xpathMap};
  } catch (error) {
    logger.error('Error building backend ID maps:', error);
    return {tagNameMap: {}, xpathMap: {}};
  }
}

// ============================================================================
// XPath Resolution
// ============================================================================

/**
 * Gets XPath by resolved object ID
 */
export async function getXPathByResolvedObjectId(
    adapter: CDPSessionAdapter,
    resolvedObjectId: string,
): Promise<string> {
  const runtimeAgent = adapter.runtimeAgent();
  const response = await runtimeAgent.invoke<{result?: {value?: string}}>('callFunctionOn', {
    objectId: resolvedObjectId,
    functionDeclaration: `function() {
      ${XPATH_BUILDER_FUNCTION_STRING}
      return getNodePath(this);
    }`,
    returnByValue: true,
  });

  return response.result?.value || '';
}

/**
 * Resolves a DOM BackendNodeId to an XPath string
 */
export async function getXPathByBackendNodeId(
    adapter: CDPSessionAdapter,
    backendNodeId: number,
): Promise<string> {
  try {
    const domAgent = adapter.domAgent();
    const response = await domAgent.invoke<{object?: {objectId?: string}}>('resolveNode', {
      backendNodeId,
    });

    if (!response.object || !response.object.objectId) {
      return '';
    }

    return await getXPathByResolvedObjectId(adapter, response.object.objectId);
  } catch (error) {
    logger.error('Error resolving BackendNodeId to XPath:', error);
    return '';
  }
}

// ============================================================================
// Scrollable Elements
// ============================================================================

const getScrollableElementXpathsFunction = `
window.getScrollableElementXpaths = function() {
  ${XPATH_BUILDER_FUNCTION_STRING}

  const allElements = document.querySelectorAll('*');
  const scrollableElements = [];

  for (const el of allElements) {
    const style = window.getComputedStyle(el);
    const hasScrollableOverflow =
      style.overflowX === 'scroll' || style.overflowX === 'auto' ||
      style.overflowY === 'scroll' || style.overflowY === 'auto';

    if (hasScrollableOverflow && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) {
      scrollableElements.push(getNodePath(el));
    }
  }

  // Also check the document body and html
  if (document.body.scrollHeight > document.body.clientHeight ||
      document.body.scrollWidth > document.body.clientWidth) {
    scrollableElements.push('/html/body');
  }

  return scrollableElements;
}`;

/**
 * Initialize the getScrollableElementXpaths function in the browser
 */
async function initializeScrollableElementsFunction(adapter: CDPSessionAdapter): Promise<void> {
  const runtimeAgent = adapter.runtimeAgent();
  await runtimeAgent.invoke('evaluate', {
    expression: getScrollableElementXpathsFunction,
    returnByValue: true,
  });
}

/**
 * Finds all scrollable elements in the DOM and returns their backendNodeIds.
 */
export async function findScrollableElementIds(adapter: CDPSessionAdapter): Promise<Set<number>> {
  await initializeScrollableElementsFunction(adapter);

  const runtimeAgent = adapter.runtimeAgent();
  const evaluateResult = await runtimeAgent.invoke<{result?: {value?: string[]}}>('evaluate', {
    expression: 'window.getScrollableElementXpaths()',
    returnByValue: true,
  });

  const xpaths = evaluateResult.result?.value || [];
  const scrollableBackendIds = new Set<number>();

  try {
    const domAgent = adapter.domAgent();

    for (const xpath of xpaths) {
      if (!xpath) {
        continue;
      }

      const evaluateResponse = await runtimeAgent.invoke<{result?: {objectId?: string}}>('evaluate', {
        expression: `
          (function() {
            const res = document.evaluate(${JSON.stringify(xpath)}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return res.singleNodeValue;
          })();
        `,
        returnByValue: false,
      });

      const result = evaluateResponse.result;

      if (result?.objectId) {
        const nodeResponse = await domAgent.invoke<{node?: {backendNodeId?: number}}>('describeNode', {
          objectId: result.objectId,
        });

        const node = nodeResponse.node;
        if (node?.backendNodeId) {
          scrollableBackendIds.add(node.backendNodeId);
        }
      }
    }
  } catch (error) {
    logger.error('Error finding scrollable element IDs:', error);
  }

  return scrollableBackendIds;
}

// ============================================================================
// Accessibility Tree
// ============================================================================

/**
 * Builds a hierarchical accessibility tree from flat CDP nodes
 */
async function buildHierarchicalTree(
    accessibilityNodes: AccessibilityNode[],
    adapter?: CDPSessionAdapter,
    scrollableBackendIds?: Set<number>,
): Promise<TreeResult> {
  // Build tagNameMap if adapter is provided
  let tagNameMap: Record<number, string> = {};
  let xpathMap: Record<number, string> = {};

  if (adapter) {
    const maps = await buildBackendIdMaps(adapter);
    tagNameMap = maps.tagNameMap;
    xpathMap = maps.xpathMap;
  }

  // Build node map for parent-child lookup
  const nodeMap = new Map<string, AccessibilityNode>();
  for (const node of accessibilityNodes) {
    if (node.nodeId) {
      nodeMap.set(node.nodeId, node);
    }
  }

  // Find root nodes (nodes without parents or with non-existent parents)
  const rootNodes: AccessibilityNode[] = [];
  for (const node of accessibilityNodes) {
    if (!node.parentId || !nodeMap.has(node.parentId)) {
      rootNodes.push(node);
    }
  }

  // Build tree recursively
  const buildTree = (node: AccessibilityNode): AccessibilityNode => {
    const children: AccessibilityNode[] = [];

    if (node.childIds) {
      for (const childId of node.childIds) {
        const childNode = nodeMap.get(childId);
        if (childNode) {
          children.push(buildTree(childNode));
        }
      }
    }

    return {
      ...node,
      children: children.length > 0 ? children : undefined,
      childIds: undefined,
      parentId: undefined,
    };
  };

  const tree = rootNodes.map(buildTree);

  // Build simplified string representation
  const simplified = tree.map(node => formatSimplifiedTree(node)).join('');

  // Build scrollable container nodes list
  const scrollableContainerNodes: Array<{
    nodeId: string,
    role: string,
    backendDOMNodeId?: number,
    name?: string,
  }> = [];

  if (scrollableBackendIds) {
    for (const node of accessibilityNodes) {
      if (node.nodeId && node.backendDOMNodeId && scrollableBackendIds.has(node.backendDOMNodeId)) {
        scrollableContainerNodes.push({
          nodeId: node.nodeId,
          role: node.role,
          backendDOMNodeId: node.backendDOMNodeId,
          name: node.name,
        });
      }
    }
  }

  // Build nodeId → backendDOMNodeId mapping for ID translation
  const nodeIdToBackendId: Record<string, number> = {};
  for (const node of accessibilityNodes) {
    if (node.nodeId && node.backendDOMNodeId) {
      nodeIdToBackendId[node.nodeId] = node.backendDOMNodeId;
    }
  }

  return {
    tree,
    simplified,
    iframes: [],
    scrollableContainerNodes,
    xpathMap,
    tagNameMap,
    nodeIdToBackendId,
  };
}

/**
 * Retrieves the full accessibility tree via CDP and transforms it into a hierarchical structure.
 */
export async function getAccessibilityTree(adapter: CDPSessionAdapter): Promise<TreeResult> {
  try {
    const scrollableBackendIds = await findScrollableElementIds(adapter);

    const accessibilityAgent = adapter.accessibilityAgent();
    const response = await accessibilityAgent.invoke<{nodes: any[]}>('getFullAXTree', {});
    const nodes = response.nodes;
    const startTime = Date.now();

    // Transform CDP nodes to AccessibilityNode format
    const accessibilityNodes: AccessibilityNode[] = nodes.map((node: any) => {
      const roleValue = node.role && typeof node.role === 'object' && 'value' in node.role
                            ? node.role.value
                            : '';

      const nameValue = node.name && typeof node.name === 'object' && 'value' in node.name
                            ? node.name.value
                            : undefined;

      const descriptionValue =
          node.description && typeof node.description === 'object' && 'value' in node.description
              ? node.description.value
              : undefined;

      const valueValue = node.value && typeof node.value === 'object' && 'value' in node.value
                             ? node.value.value
                             : undefined;

      const backendNodeId =
          typeof node.backendDOMNodeId === 'number' ? node.backendDOMNodeId : undefined;

      return {
        role: roleValue,
        name: nameValue,
        description: descriptionValue,
        value: valueValue,
        nodeId: node.nodeId,
        backendDOMNodeId: backendNodeId,
        parentId: node.parentId,
        childIds: node.childIds,
        properties: node.properties,
      };
    });

    const hierarchicalTree =
        await buildHierarchicalTree(accessibilityNodes, adapter, scrollableBackendIds);

    logger.info(`got accessibility tree in ${Date.now() - startTime}ms`);
    return hierarchicalTree;
  } catch (error) {
    logger.error('Error getting accessibility tree', error);
    throw error;
  }
}

// ============================================================================
// Perform Action
// ============================================================================

/**
 * Performs an action on a DOM element identified by XPath
 */
export async function performAction(
    adapter: CDPSessionAdapter,
    method: string,
    args: unknown[],
    xpath: string,
    iframeNodeId?: string,
): Promise<void> {
  const runtimeAgent = adapter.runtimeAgent();
  const domAgent = adapter.domAgent();
  const inputAgent = adapter.inputAgent();
  const accessibilityAgent = adapter.accessibilityAgent();

  let objectId: string;

  // Handle iframe-specific elements
  if (iframeNodeId) {
    logger.info(`Performing action in iframe ${iframeNodeId} for element ${xpath}`);

    const response = await accessibilityAgent.invoke<{nodes: any[]}>('getFullAXTree', {});
    const nodes = response.nodes;

    const iframeNode = nodes.find((node: any) => node.nodeId === iframeNodeId);
    if (!iframeNode || !iframeNode.backendDOMNodeId) {
      throw new Error(`Could not find iframe with nodeId ${iframeNodeId}`);
    }

    const resolveResponse =
        await domAgent.invoke<{object?: {objectId?: string}}>('resolveNode', {
          backendNodeId: iframeNode.backendDOMNodeId,
        });

    if (!resolveResponse.object?.objectId) {
      throw new Error(`Could not resolve iframe node ${iframeNodeId}`);
    }

    const elementNodeId = xpath;

    const domNodeResponse = await domAgent.invoke<{node?: {frameId?: string}}>('describeNode', {
      backendNodeId: iframeNode.backendDOMNodeId,
    });

    if (!domNodeResponse.node?.frameId) {
      throw new Error(`Could not get frameId for iframe ${iframeNodeId}`);
    }

    const iframeAccessibilityResponse = await accessibilityAgent.invoke<{nodes: any[]}>('getFullAXTree', {
      frameId: domNodeResponse.node.frameId,
    });

    const elementNode =
        iframeAccessibilityResponse.nodes.find((node: any) => node.nodeId === elementNodeId);
    if (!elementNode || !elementNode.backendDOMNodeId) {
      throw new Error(
          `Could not find element with nodeId ${elementNodeId} in iframe ${iframeNodeId}`);
    }

    const elementResolveResponse =
        await domAgent.invoke<{object?: {objectId?: string}}>('resolveNode', {
          backendNodeId: elementNode.backendDOMNodeId,
        });

    if (!elementResolveResponse.object?.objectId) {
      throw new Error(`Could not resolve element node ${elementNodeId} in iframe ${iframeNodeId}`);
    }

    objectId = elementResolveResponse.object.objectId;
  } else {
    // Locate element by XPath using composed tree resolver (supports shadow DOM)
    // First tries __browserOperator__.resolveSimpleXPath (pierces shadow DOM)
    // Falls back to standard document.evaluate for regular XPath
    const evaluateResult = await runtimeAgent.invoke<{result?: {objectId?: string}}>('evaluate', {
      expression: `
        (function() {
          const xp = ${JSON.stringify(xpath)};
          try {
            // Try composed tree resolver first (handles shadow DOM)
            if (window.__browserOperator__?.resolveSimpleXPath) {
              const el = window.__browserOperator__.resolveSimpleXPath(xp);
              if (el) return el;
            }
          } catch (e) {
            console.warn('[utils-universal] Shadow DOM resolver failed for xpath:', xp, e);
          }
          try {
            // Fall back to standard XPath evaluation
            const res = document.evaluate(
              xp.replace(/^xpath=/i, ''),
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            );
            return res.singleNodeValue;
          } catch (e) {
            console.warn('[utils-universal] Standard XPath evaluation failed for xpath:', xp, e);
            return null;
          }
        })()
      `,
      returnByValue: false,
    });

    if (!evaluateResult.result?.objectId) {
      throw new Error(`Could not find element with xpath ${xpath} in main document`);
    }

    objectId = evaluateResult.result.objectId;
  }

  try {
    if (method === 'click') {
      try {
        await runtimeAgent.invoke('callFunctionOn', {
          objectId,
          functionDeclaration: `
            function() {
              if ('scrollIntoView' in this) {
                this.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }

              return new Promise(resolve => {
                const initialRect = this.getBoundingClientRect();
                let lastTop = initialRect.top;
                let lastLeft = initialRect.left;
                let positionStableCount = 0;
                const maxWaitTime = 1000;
                const startTime = Date.now();

                const checkPosition = () => {
                  const currentRect = this.getBoundingClientRect();
                  const currentTop = currentRect.top;
                  const currentLeft = currentRect.left;

                  if (Math.abs(currentTop - lastTop) < 1 && Math.abs(currentLeft - lastLeft) < 1) {
                    positionStableCount++;

                    if (positionStableCount >= 3 || (Date.now() - startTime > maxWaitTime)) {
                      this.click();
                      resolve(true);
                      return;
                    }
                  } else {
                    positionStableCount = 0;
                  }

                  lastTop = currentTop;
                  lastLeft = currentLeft;
                  setTimeout(checkPosition, 50);
                };

                setTimeout(checkPosition, 50);
              });
            }
          `,
          returnByValue: true,
          awaitPromise: true,
        });
      } catch (e) {
        logger.warn(`Direct click failed, falling back to mouse events: ${e}`);
        await clickWithMouseEvents(domAgent, inputAgent, objectId);
      }
    } else if (method === 'rightClick') {
      await rightClickElement(domAgent, inputAgent, objectId);
    } else if (method === 'hover') {
      await hoverElement(domAgent, inputAgent, objectId);
    } else if (method === 'drag') {
      await dragElement(domAgent, inputAgent, objectId, args);
    } else if (method === 'fill' || method === 'type') {
      await fillElement(runtimeAgent, inputAgent, objectId, args);
    } else if (method === 'press') {
      await pressKey(inputAgent, args);
    } else if (method === 'scrollIntoView') {
      await scrollElementIntoView(runtimeAgent, objectId);
    } else if (method === 'selectOption') {
      await selectOption(runtimeAgent, objectId, args);
    } else if (method === 'check') {
      await checkElement(runtimeAgent, objectId);
    } else if (method === 'uncheck') {
      await uncheckElement(runtimeAgent, objectId);
    } else if (method === 'setChecked') {
      await setCheckedState(runtimeAgent, objectId, args);
    } else {
      throw new Error(`Method ${method} not supported`);
    }
  } catch (error) {
    throw error;
  }
}

// ============================================================================
// Perform Action by BackendNodeId (cross-frame compatible)
// ============================================================================

/**
 * Gets the execution context ID for a specific frame.
 * This is needed to resolve nodes in iframes via DOM.resolveNode.
 */
async function getFrameExecutionContextId(
    adapter: CDPSessionAdapter,
    frameId: string,
): Promise<number | undefined> {
  try {
    const runtimeAgent = adapter.runtimeAgent();

    // Create an isolated world in the frame to get its execution context
    const response = await runtimeAgent.invoke<{executionContextId: number}>('createIsolatedWorld', {
      frameId,
      worldName: 'frame-context-resolver',
    });

    return response.executionContextId;
  } catch (error) {
    logger.warn(`Failed to get execution context for frame ${frameId}:`, error);
    return undefined;
  }
}

/**
 * Performs an action on a DOM element identified by backendNodeId.
 * This works across frames since backendNodeIds are unique within a target.
 *
 * @param adapter - CDP session adapter
 * @param method - Action method to perform
 * @param args - Arguments for the action
 * @param backendNodeId - Backend node ID of the element
 * @param frameOrdinal - Optional frame ordinal for cross-frame resolution (0 = main frame)
 */
export async function performActionByBackendNodeId(
    adapter: CDPSessionAdapter,
    method: string,
    args: unknown[],
    backendNodeId: number,
    frameOrdinal?: number,
): Promise<void> {
  const runtimeAgent = adapter.runtimeAgent();
  const domAgent = adapter.domAgent();
  const inputAgent = adapter.inputAgent();

  logger.info(`[performActionByBackendNodeId] method=${method}, backendNodeId=${backendNodeId}, frameOrdinal=${frameOrdinal}`);

  // Resolve backendNodeId to objectId for methods that need JavaScript execution
  let objectId: string | undefined;

  // For click, hover, scrollIntoView, and press, we can use Input events directly
  // For other methods, we need to resolve to objectId first
  if (['fill', 'type', 'selectOption', 'check', 'uncheck', 'setChecked'].includes(method)) {
    // For iframe nodes (frameOrdinal > 0), we need to resolve with frame context
    if (frameOrdinal !== undefined && frameOrdinal > 0) {
      const frameRegistry = new FrameRegistryUniversal(adapter);
      await frameRegistry.collectFrames();
      const frameInfo = frameRegistry.getFrameByOrdinal(frameOrdinal);

      if (frameInfo) {
        logger.info(`[performActionByBackendNodeId] Resolving in iframe: frameId=${frameInfo.frameId}`);
        const executionContextId = await getFrameExecutionContextId(adapter, frameInfo.frameId);

        if (executionContextId) {
          const resolveResponse = await domAgent.invoke<{object?: {objectId?: string}}>('resolveNode', {
            backendNodeId,
            executionContextId,
          });

          if (resolveResponse.object?.objectId) {
            objectId = resolveResponse.object.objectId;
            logger.info(`[performActionByBackendNodeId] Resolved iframe node to objectId=${objectId}`);
          }
        }
      }

      if (!objectId) {
        throw new Error(`Could not resolve iframe backendNodeId ${backendNodeId} (frame ${frameOrdinal}) to objectId`);
      }
    } else {
      // Main frame resolution (original behavior)
      const resolveResponse = await domAgent.invoke<{object?: {objectId?: string}}>('resolveNode', {
        backendNodeId,
      });

      if (!resolveResponse.object?.objectId) {
        throw new Error(`Could not resolve backendNodeId ${backendNodeId} to objectId`);
      }
      objectId = resolveResponse.object.objectId;
      logger.info(`[performActionByBackendNodeId] Resolved to objectId=${objectId}`);
    }
  }

  // Perform the action
  if (method === 'click') {
    await clickByBackendNodeId(domAgent, inputAgent, backendNodeId);
  } else if (method === 'rightClick') {
    await rightClickByBackendNodeId(domAgent, inputAgent, backendNodeId);
  } else if (method === 'hover') {
    await hoverByBackendNodeId(domAgent, inputAgent, backendNodeId);
  } else if (method === 'scrollIntoView') {
    await scrollIntoViewByBackendNodeId(domAgent, backendNodeId);
  } else if ((method === 'fill' || method === 'type') && objectId) {
    await fillElement(runtimeAgent, inputAgent, objectId, args);
  } else if (method === 'press') {
    await pressKey(inputAgent, args);
  } else if (method === 'selectOption' && objectId) {
    await selectOption(runtimeAgent, objectId, args);
  } else if ((method === 'check' || method === 'uncheck' || method === 'setChecked') && objectId) {
    await setCheckedState(runtimeAgent, objectId, args);
  } else if (method === 'drag') {
    await dragByBackendNodeId(domAgent, inputAgent, backendNodeId, args);
  } else {
    throw new Error(`Method ${method} not supported for backendNodeId-based action`);
  }
}

/**
 * Click element by backendNodeId using Input events.
 */
async function clickByBackendNodeId(
    domAgent: ReturnType<CDPSessionAdapter['domAgent']>,
    inputAgent: ReturnType<CDPSessionAdapter['inputAgent']>,
    backendNodeId: number,
): Promise<void> {
  await scrollIntoViewByBackendNodeId(domAgent, backendNodeId);
  const {x, y} = await getElementCenterFromBackendNodeId(domAgent, backendNodeId);
  logger.info(`[clickByBackendNodeId] Clicking at (${x}, ${y})`);
  await dispatchClick(inputAgent, x, y, 'left');
}

/**
 * Right-click element by backendNodeId using Input events.
 */
async function rightClickByBackendNodeId(
    domAgent: ReturnType<CDPSessionAdapter['domAgent']>,
    inputAgent: ReturnType<CDPSessionAdapter['inputAgent']>,
    backendNodeId: number,
): Promise<void> {
  await scrollIntoViewByBackendNodeId(domAgent, backendNodeId);
  const {x, y} = await getElementCenterFromBackendNodeId(domAgent, backendNodeId);
  logger.info(`[rightClickByBackendNodeId] Right-clicking at (${x}, ${y})`);
  await dispatchClick(inputAgent, x, y, 'right');
}

/**
 * Hover element by backendNodeId using Input events.
 */
async function hoverByBackendNodeId(
    domAgent: ReturnType<CDPSessionAdapter['domAgent']>,
    inputAgent: ReturnType<CDPSessionAdapter['inputAgent']>,
    backendNodeId: number,
): Promise<void> {
  const {x, y} = await getElementCenterFromBackendNodeId(domAgent, backendNodeId);
  await dispatchMouseMove(inputAgent, x, y);
}

/**
 * Scroll element into view by backendNodeId.
 */
async function scrollIntoViewByBackendNodeId(
    domAgent: ReturnType<CDPSessionAdapter['domAgent']>,
    backendNodeId: number,
): Promise<void> {
  await domAgent.invoke('scrollIntoViewIfNeeded', {
    backendNodeId,
  });
}

/**
 * Drag element by backendNodeId using Input events.
 * Supports both relative offset (offsetX, offsetY) and absolute position (toX, toY).
 */
async function dragByBackendNodeId(
    domAgent: ReturnType<CDPSessionAdapter['domAgent']>,
    inputAgent: ReturnType<CDPSessionAdapter['inputAgent']>,
    backendNodeId: number,
    args: unknown[],
): Promise<void> {
  await scrollIntoViewByBackendNodeId(domAgent, backendNodeId);
  const {x: startX, y: startY} = await getElementCenterFromBackendNodeId(domAgent, backendNodeId);

  const dragArgs = args[0] as {offsetX?: number; offsetY?: number; toX?: number; toY?: number} | undefined;
  let endX: number;
  let endY: number;

  if (dragArgs?.toX !== undefined && dragArgs?.toY !== undefined) {
    endX = dragArgs.toX;
    endY = dragArgs.toY;
  } else {
    endX = startX + (dragArgs?.offsetX || 0);
    endY = startY + (dragArgs?.offsetY || 0);
  }

  logger.info(`[dragByBackendNodeId] Dragging from (${startX}, ${startY}) to (${endX}, ${endY})`);
  await dispatchDrag(inputAgent, startX, startY, endX, endY);
}

// Helper functions for performAction
async function clickWithMouseEvents(
    domAgent: ReturnType<CDPSessionAdapter['domAgent']>,
    inputAgent: ReturnType<CDPSessionAdapter['inputAgent']>,
    objectId: string,
): Promise<void> {
  const {x, y} = await getElementCenterFromObjectId(domAgent, objectId);
  await dispatchClick(inputAgent, x, y, 'left');
}

async function rightClickElement(
    domAgent: ReturnType<CDPSessionAdapter['domAgent']>,
    inputAgent: ReturnType<CDPSessionAdapter['inputAgent']>,
    objectId: string,
): Promise<void> {
  const {x, y} = await getElementCenterFromObjectId(domAgent, objectId);
  logger.info(`[rightClickElement] Right-clicking at (${x}, ${y})`);
  await dispatchClick(inputAgent, x, y, 'right');
}

async function hoverElement(
    domAgent: ReturnType<CDPSessionAdapter['domAgent']>,
    inputAgent: ReturnType<CDPSessionAdapter['inputAgent']>,
    objectId: string,
): Promise<void> {
  const {x, y} = await getElementCenterFromObjectId(domAgent, objectId);
  await dispatchMouseMove(inputAgent, x, y);
}

async function dragElement(
    domAgent: ReturnType<CDPSessionAdapter['domAgent']>,
    inputAgent: ReturnType<CDPSessionAdapter['inputAgent']>,
    objectId: string,
    args: unknown[],
): Promise<void> {
  const {x: startX, y: startY} = await getElementCenterFromObjectId(domAgent, objectId);

  const dragArgs = args[0] as {offsetX?: number; offsetY?: number; toX?: number; toY?: number};
  let endX: number;
  let endY: number;

  if (dragArgs.toX !== undefined && dragArgs.toY !== undefined) {
    endX = dragArgs.toX;
    endY = dragArgs.toY;
  } else {
    endX = startX + (dragArgs.offsetX || 0);
    endY = startY + (dragArgs.offsetY || 0);
  }

  await dispatchDrag(inputAgent, startX, startY, endX, endY);
}

async function fillElement(
    runtimeAgent: ReturnType<CDPSessionAdapter['runtimeAgent']>,
    inputAgent: ReturnType<CDPSessionAdapter['inputAgent']>,
    objectId: string,
    args: unknown[],
): Promise<void> {
  const text = String(args[0] || '');

  await runtimeAgent.invoke('callFunctionOn', {
    objectId,
    functionDeclaration: `
      function() {
        this.focus();
        if (this.value !== undefined) {
          this.value = "";
        }
        return true;
      }
    `,
    returnByValue: true,
  });

  for (const char of text) {
    await inputAgent.invoke('dispatchKeyEvent', {
      type: 'keyDown',
      text: char,
    });

    await inputAgent.invoke('dispatchKeyEvent', {
      type: 'keyUp',
    });
  }

  await runtimeAgent.invoke('callFunctionOn', {
    objectId,
    functionDeclaration: `
      function(value) {
        if (this instanceof HTMLInputElement || this instanceof HTMLTextAreaElement) {
          this.value = value;
          this.dispatchEvent(new Event('input', { bubbles: true }));
          this.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
      }
    `,
    arguments: [{value: text}],
    returnByValue: true,
  });
}

async function pressKey(
    inputAgent: ReturnType<CDPSessionAdapter['inputAgent']>,
    args: unknown[],
): Promise<void> {
  const key = String(args[0] || '');

  await inputAgent.invoke('dispatchKeyEvent', {
    type: 'keyDown',
    key,
  });

  await inputAgent.invoke('dispatchKeyEvent', {
    type: 'keyUp',
    key,
  });
}

async function scrollElementIntoView(
    runtimeAgent: ReturnType<CDPSessionAdapter['runtimeAgent']>,
    objectId: string,
): Promise<void> {
  await runtimeAgent.invoke('callFunctionOn', {
    objectId,
    functionDeclaration: `
      function() {
        if ('scrollIntoView' in this) {
          this.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return true;
      }
    `,
    returnByValue: true,
  });
}

async function selectOption(
    runtimeAgent: ReturnType<CDPSessionAdapter['runtimeAgent']>,
    objectId: string,
    args: unknown[],
): Promise<void> {
  const optionValue = String(args[0] || '');

  await runtimeAgent.invoke('callFunctionOn', {
    objectId,
    functionDeclaration: `
      function(value) {
        if (this.tagName.toLowerCase() === 'select') {
          let optionFound = false;
          for (let i = 0; i < this.options.length; i++) {
            const option = this.options[i];
            if (option.value === value || option.text === value || option.textContent === value) {
              this.selectedIndex = i;
              optionFound = true;
              break;
            }
          }

          if (!optionFound) {
            for (let i = 0; i < this.options.length; i++) {
              const option = this.options[i];
              if (option.text.toLowerCase().includes(value.toLowerCase()) ||
                  option.textContent.toLowerCase().includes(value.toLowerCase())) {
                this.selectedIndex = i;
                optionFound = true;
                break;
              }
            }
          }

          if (optionFound) {
            this.dispatchEvent(new Event('change', { bubbles: true }));
            this.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
          return false;
        }
        return false;
      }
    `,
    arguments: [{value: optionValue}],
    returnByValue: true,
  });
}

async function checkElement(
    runtimeAgent: ReturnType<CDPSessionAdapter['runtimeAgent']>,
    objectId: string,
): Promise<void> {
  await runtimeAgent.invoke('callFunctionOn', {
    objectId,
    functionDeclaration: `
      function() {
        if (this.type === 'checkbox' || this.type === 'radio') {
          if (!this.checked) {
            this.checked = true;
            this.dispatchEvent(new Event('change', { bubbles: true }));
            this.dispatchEvent(new Event('input', { bubbles: true }));
          }
          return true;
        }
        return false;
      }
    `,
    returnByValue: true,
  });
}

async function uncheckElement(
    runtimeAgent: ReturnType<CDPSessionAdapter['runtimeAgent']>,
    objectId: string,
): Promise<void> {
  await runtimeAgent.invoke('callFunctionOn', {
    objectId,
    functionDeclaration: `
      function() {
        if (this.type === 'checkbox') {
          if (this.checked) {
            this.checked = false;
            this.dispatchEvent(new Event('change', { bubbles: true }));
            this.dispatchEvent(new Event('input', { bubbles: true }));
          }
          return true;
        }
        return false;
      }
    `,
    returnByValue: true,
  });
}

async function setCheckedState(
    runtimeAgent: ReturnType<CDPSessionAdapter['runtimeAgent']>,
    objectId: string,
    args: unknown[],
): Promise<void> {
  const shouldCheck = Boolean(args[0]);

  await runtimeAgent.invoke('callFunctionOn', {
    objectId,
    functionDeclaration: `
      function(checked) {
        if (this.type === 'checkbox' || this.type === 'radio') {
          if (this.checked !== checked) {
            this.checked = checked;
            this.dispatchEvent(new Event('change', { bubbles: true }));
            this.dispatchEvent(new Event('input', { bubbles: true }));
          }
          return true;
        }
        return false;
      }
    `,
    arguments: [{value: shouldCheck}],
    returnByValue: true,
  });
}
