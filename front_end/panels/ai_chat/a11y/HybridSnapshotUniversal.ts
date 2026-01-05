// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Hybrid Accessibility Snapshot - Universal Version
 *
 * Adapter-compatible version of HybridSnapshot that works with CDPSessionAdapter.
 * Captures a frame-aware accessibility tree with EncodedId→XPath mapping.
 */

import type {CDPSessionAdapter} from '../cdp/CDPSessionAdapter.js';
import {FrameRegistryUniversal, type FrameInfo} from '../cdp/FrameRegistryUniversal.js';
import {type EncodedId, makeEncodedId} from '../common/context.js';

/**
 * Options for capturing a hybrid snapshot
 */
export interface SnapshotOptions {
  /** Scope to a specific subtree using a selector */
  focusSelector?: string;
  /** Include shadow DOM in the snapshot (default: true) */
  pierceShadow?: boolean;
}

/**
 * Per-frame snapshot data
 */
export interface FrameSnapshot {
  frameId: string;
  ordinal: number;
  url: string;
  outline: string;
  xpathMap: Record<EncodedId, string>;
  urlMap: Record<EncodedId, string>;
}

/**
 * Complete hybrid snapshot across all frames
 */
export interface HybridSnapshot {
  /** Human-readable merged accessibility tree */
  combinedTree: string;
  /** EncodedId → absolute XPath (including iframe prefixes) */
  combinedXpathMap: Record<EncodedId, string>;
  /** EncodedId → URL (for links and images) */
  combinedUrlMap: Record<EncodedId, string>;
  /** Per-frame snapshot data for debugging */
  perFrame: FrameSnapshot[];
}

// ============================================================================
// XPath Utilities
// ============================================================================

/**
 * Join two XPath segments.
 * Handles shadow root hops ('//' markers) correctly.
 */
function joinXPath(base: string, step: string): string {
  // Shadow root hop marker
  if (step === '//') {
    if (!base || base === '/') {
      return '//';
    }
    return base.endsWith('/') ? `${base}/` : `${base}//`;
  }

  if (!base || base === '/') {
    return step ? `/${step}` : '/';
  }

  if (base.endsWith('//')) {
    return `${base}${step}`;
  }

  if (!step) {
    return base;
  }

  return `${base}/${step}`;
}

/**
 * Prefix a child XPath with an absolute parent iframe path.
 */
function prefixXPath(parentAbs: string, child: string): string {
  const p = parentAbs === '/' ? '' : parentAbs.replace(/\/$/, '');

  if (!child || child === '/') {
    return p || '/';
  }

  if (child.startsWith('//')) {
    return p ? `${p}//${child.slice(2)}` : `//${child.slice(2)}`;
  }

  const c = child.replace(/^\//, '');
  return p ? `${p}/${c}` : `/${c}`;
}

// ============================================================================
// DOM Map Building (CDP-based)
// ============================================================================

interface DomMaps {
  tagNameMap: Record<EncodedId, string>;
  xpathMap: Record<EncodedId, string>;
}

/**
 * CDP DOM node structure from DOM.getDocument / DOM.describeNode
 */
interface CDPNode {
  nodeId: number;
  backendNodeId: number;
  nodeType: number;
  nodeName: string;
  localName: string;
  nodeValue: string;
  childNodeCount?: number;
  children?: CDPNode[];
  shadowRoots?: CDPNode[];
  contentDocument?: CDPNode;
  attributes?: string[];
}

/**
 * Build DOM maps for ALL frames in a single pass using CDP.
 * Traverses the DOM tree with pierce=true to include iframe contents.
 * Tracks frame boundaries via contentDocument nodes to switch ordinals.
 */
async function buildDomMapsAllFrames(
    adapter: CDPSessionAdapter,
    frameRegistry: FrameRegistryUniversal,
    pierce: boolean,
): Promise<DomMaps> {
  const tagNameMap: Record<EncodedId, string> = {};
  const xpathMap: Record<EncodedId, string> = {};

  const mainFrameId = frameRegistry.getMainFrameId();
  if (!mainFrameId) {
    return {tagNameMap, xpathMap};
  }

  const mainOrdinal = frameRegistry.getOrdinal(mainFrameId);

  // Build a map from ownerBackendNodeId to child frame ordinal
  // This lets us detect frame boundaries when we encounter contentDocument
  const ownerToChildOrdinal = new Map<number, number>();
  for (const frameId of frameRegistry.listAllFrameIds()) {
    const info = frameRegistry.getFrame(frameId);
    if (info?.ownerBackendNodeId) {
      ownerToChildOrdinal.set(info.ownerBackendNodeId, info.ordinal);
    }
  }

  try {
    const domAgent = adapter.domAgent();

    // Request document with pierce and depth options
    // This returns the full DOM tree including all iframes via contentDocument
    const docResponse = await domAgent.invoke<{root: CDPNode}>('getDocument', {
      depth: -1,  // Traverse entire subtree
      pierce: pierce,  // Pierce shadow DOM and iframes
    });

    if (!docResponse.root) {
      return {tagNameMap, xpathMap};
    }

    // DFS traversal of the DOM with frame tracking
    interface StackEntry {
      node: CDPNode;
      xpath: string;
      ordinal: number;  // Current frame ordinal for encoding
    }

    const stack: StackEntry[] = [{node: docResponse.root, xpath: '', ordinal: mainOrdinal}];

    while (stack.length) {
      const entry = stack.pop();
      if (!entry) {
        continue;
      }

      const {node, xpath, ordinal} = entry;
      const backendNodeId = node.backendNodeId;

      if (backendNodeId) {
        const encId = makeEncodedId(ordinal, backendNodeId);
        tagNameMap[encId] = node.localName || node.nodeName.toLowerCase();
        xpathMap[encId] = xpath || '/';
      }

      // Check if this node is an iframe that owns a child frame
      // If so, use the child frame's ordinal for the contentDocument
      let childOrdinal = ordinal;
      if (backendNodeId && ownerToChildOrdinal.has(backendNodeId)) {
        childOrdinal = ownerToChildOrdinal.get(backendNodeId)!;
      }

      // Process contentDocument (iframe content) with child frame ordinal
      // The contentDocument has its own document structure inside the iframe
      if (node.contentDocument) {
        stack.push({
          node: node.contentDocument,
          xpath: xpath,  // Continue xpath from iframe element
          ordinal: childOrdinal,  // Switch to child frame's ordinal
        });
      }

      // Process children with sibling-indexed XPath segments
      const children = node.children || [];
      if (children.length) {
        // Build sibling-indexed segments
        const segs: string[] = [];
        const counter: Record<string, number> = {};

        for (const child of children) {
          const tag = child.localName || child.nodeName.toLowerCase();
          const nodeType = child.nodeType;
          const key = `${nodeType}:${tag}`;
          const idx = (counter[key] = (counter[key] ?? 0) + 1);

          if (nodeType === 3) {  // TEXT_NODE
            segs.push(`text()[${idx}]`);
          } else if (nodeType === 8) {  // COMMENT_NODE
            segs.push(`comment()[${idx}]`);
          } else if (tag.includes(':')) {
            // Namespaced tag
            segs.push(`*[name()='${tag}'][${idx}]`);
          } else {
            segs.push(`${tag}[${idx}]`);
          }
        }

        // Add children to stack in reverse order for correct processing
        for (let i = children.length - 1; i >= 0; i--) {
          stack.push({
            node: children[i],
            xpath: joinXPath(xpath, segs[i]),
            ordinal: ordinal,  // Children stay in same frame
          });
        }
      }

      // Process shadow roots with '//' hop marker
      const shadowRoots = node.shadowRoots || [];
      for (const sr of shadowRoots) {
        stack.push({
          node: sr,
          xpath: joinXPath(xpath, '//'),
          ordinal: ordinal,
        });
      }
    }
  } catch (error) {
    console.warn('[HybridSnapshotUniversal] Failed to build DOM maps:', error);
  }

  return {tagNameMap, xpathMap};
}

// ============================================================================
// Accessibility Tree Building (CDP-based)
// ============================================================================

interface A11yOutline {
  outline: string;
  urlMap: Record<EncodedId, string>;
}

/**
 * CDP Accessibility node structure from Accessibility.getFullAXTree
 */
interface AXNode {
  nodeId: string;
  ignored: boolean;
  role?: {type: string; value: string};
  name?: {type: string; value: string};
  description?: {type: string; value: string};
  value?: {type: string; value: string | number | boolean};
  properties?: Array<{name: string; value: {type: string; value: unknown}}>;
  childIds?: string[];
  parentId?: string;
  backendDOMNodeId?: number;
}

/**
 * Build accessibility tree outline for a single frame using CDP.
 */
async function buildA11yOutline(
    adapter: CDPSessionAdapter,
    frameId: string,
    frameRegistry: FrameRegistryUniversal,
    tagNameMap: Record<EncodedId, string>,
): Promise<A11yOutline> {
  const urlMap: Record<EncodedId, string> = {};
  const ordinal = frameRegistry.getOrdinal(frameId);
  const encode = (backendNodeId: number): EncodedId => makeEncodedId(ordinal, backendNodeId);

  // Request full accessibility tree for the frame
  let axNodes: AXNode[] = [];
  try {
    const accessibilityAgent = adapter.accessibilityAgent();
    const response = await accessibilityAgent.invoke<{nodes: AXNode[]}>('getFullAXTree', {
      frameId: frameId,
    });
    axNodes = response.nodes || [];
  } catch {
    // Frame may have been removed or is an OOPIF
    return {outline: '', urlMap};
  }

  if (!axNodes.length) {
    return {outline: '', urlMap};
  }

  // Build node map for tree traversal
  const nodeMap = new Map<string, AXNode>();
  for (const node of axNodes) {
    nodeMap.set(node.nodeId, node);
  }

  // Format a single node
  const lines: string[] = [];

  const formatNode = (node: AXNode, indent: number): void => {
    const role = node.role?.value ?? '';
    const name = node.name?.value ?? '';
    const backendNodeId = node.backendDOMNodeId;

    let labelId = '';
    if (typeof backendNodeId === 'number') {
      labelId = encode(backendNodeId);

      // Extract URL from properties
      const urlProp = node.properties?.find(p => p.name === 'url');
      if (urlProp?.value?.value) {
        urlMap[labelId as EncodedId] = String(urlProp.value.value);
      }
    }

    // Decorate role with tag name for generic roles
    let displayRole = role;
    if ((role === 'generic' || role === 'none') && labelId && tagNameMap[labelId as EncodedId]) {
      displayRole = tagNameMap[labelId as EncodedId];
    }

    const prefix = '  '.repeat(indent);
    const nameStr = name ? `: ${cleanText(name)}` : '';
    // Check if this node has focus
    const isFocused = node.properties?.some(p => p.name === 'focused' && p.value?.value === true);
    const focusMarker = isFocused ? ' [focused]' : '';
    const label = `[${labelId || node.nodeId}] ${displayRole}${nameStr}${focusMarker}`;
    lines.push(`${prefix}${label}`);
  };

  // DFS traversal to build outline
  const visit = (nodeId: string, indent: number): void => {
    const node = nodeMap.get(nodeId);
    if (!node) {
      return;
    }

    formatNode(node, indent);

    for (const childId of node.childIds || []) {
      visit(childId, indent + 1);
    }
  };

  // Start from root nodes (no parent)
  const roots = axNodes.filter(n => !n.parentId);
  for (const root of roots) {
    visit(root.nodeId, 0);
  }

  return {outline: lines.join('\n'), urlMap};
}

/**
 * Clean text for display (remove private use area characters, normalize whitespace)
 */
function cleanText(input: string): string {
  const PUA_START = 0xe000;
  const PUA_END = 0xf8ff;
  const NBSP_CHARS = new Set([0x00a0, 0x202f, 0x2007, 0xfeff]);

  let out = '';
  let prevSpace = false;

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);

    // Skip private use area characters
    if (code >= PUA_START && code <= PUA_END) {
      continue;
    }

    // Normalize non-breaking spaces
    if (NBSP_CHARS.has(code)) {
      if (!prevSpace) {
        out += ' ';
        prevSpace = true;
      }
      continue;
    }

    out += input[i];
    prevSpace = input[i] === ' ';
  }

  return out.trim();
}

// ============================================================================
// Main Snapshot Function
// ============================================================================

/**
 * Capture a hybrid accessibility snapshot across all frames using CDPSessionAdapter.
 * Returns a combined tree with EncodedId→XPath mapping for element targeting.
 */
export async function captureHybridSnapshotUniversal(
    adapter: CDPSessionAdapter,
    options?: SnapshotOptions,
): Promise<HybridSnapshot> {
  const pierce = options?.pierceShadow ?? true;

  // Initialize frame registry
  const frameRegistry = new FrameRegistryUniversal(adapter);
  await frameRegistry.collectFrames();

  const frames = frameRegistry.listAllFrameIds();

  // Build DOM maps for ALL frames in one pass
  // This traverses the full DOM tree including iframe contentDocument nodes
  const {tagNameMap, xpathMap: combinedXpathMap} = await buildDomMapsAllFrames(
      adapter,
      frameRegistry,
      pierce,
  );

  // Output maps
  const combinedUrlMap: Record<EncodedId, string> = {};
  const perFrame: FrameSnapshot[] = [];

  // Process each frame for accessibility tree (this API supports per-frame)
  for (const frameId of frames) {
    const frameInfo = frameRegistry.getFrame(frameId);
    if (!frameInfo) {
      continue;
    }

    // Build accessibility outline for this frame
    // The tagNameMap is shared across all frames (keyed by EncodedId)
    const {outline, urlMap} = await buildA11yOutline(
        adapter,
        frameId,
        frameRegistry,
        tagNameMap,
    );

    // Merge URL map
    Object.assign(combinedUrlMap, urlMap);

    // Extract per-frame xpaths for debugging
    const frameXpathMap: Record<EncodedId, string> = {};
    const frameOrdinal = frameInfo.ordinal;
    for (const [encId, xp] of Object.entries(combinedXpathMap)) {
      // Check if this encodedId belongs to this frame (starts with frameOrdinal-)
      if (encId.startsWith(`${frameOrdinal}-`)) {
        frameXpathMap[encId as EncodedId] = xp;
      }
    }

    perFrame.push({
      frameId,
      ordinal: frameInfo.ordinal,
      url: frameInfo.url,
      outline,
      xpathMap: frameXpathMap,
      urlMap,
    });
  }

  // Stitch combined tree (main frame first, then children separated by blank lines)
  const combinedTree = perFrame
      .map(f => f.outline)
      .filter(Boolean)
      .join('\n\n');

  return {combinedTree, combinedXpathMap, combinedUrlMap, perFrame};
}

/**
 * Helper to resolve an EncodedId to its absolute XPath.
 */
export function resolveEncodedIdToXPath(
    snapshot: HybridSnapshot,
    encodedId: EncodedId,
): string|undefined {
  return snapshot.combinedXpathMap[encodedId];
}

/**
 * Helper to resolve an EncodedId to its URL (if it's a link or image).
 */
export function resolveEncodedIdToUrl(
    snapshot: HybridSnapshot,
    encodedId: EncodedId,
): string|undefined {
  return snapshot.combinedUrlMap[encodedId];
}
