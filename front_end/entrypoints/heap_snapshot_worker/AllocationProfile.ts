/*
 * Copyright (C) 2013 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import * as HeapSnapshotModel from '../../models/heap_snapshot_model/heap_snapshot_model.js';

import type {LiveObjects, Profile} from './HeapSnapshot.js';

export class AllocationProfile {
  readonly #strings: string[];
  #nextNodeId: number;
  #functionInfos: FunctionAllocationInfo[];
  #idToNode: Record<number, BottomUpAllocationNode|null>;
  readonly #idToTopDownNode: Record<number, TopDownAllocationNode>;
  #collapsedTopNodeIdToFunctionInfo: Record<number, FunctionAllocationInfo>;
  #traceTops: HeapSnapshotModel.HeapSnapshotModel.SerializedAllocationNode[]|null;

  constructor(profile: Profile, liveObjectStats: LiveObjects) {
    this.#strings = profile.strings;

    this.#nextNodeId = 1;
    this.#functionInfos = [];

    this.#idToNode = {};

    this.#idToTopDownNode = {};

    this.#collapsedTopNodeIdToFunctionInfo = {};

    this.#traceTops = null;

    this.#buildFunctionAllocationInfos(profile);
    this.#buildAllocationTree(profile, liveObjectStats);
  }

  #buildFunctionAllocationInfos(profile: Profile): void {
    const strings = this.#strings;

    const functionInfoFields = profile.snapshot.meta.trace_function_info_fields;
    const functionNameOffset = functionInfoFields.indexOf('name');
    const scriptNameOffset = functionInfoFields.indexOf('script_name');
    const scriptIdOffset = functionInfoFields.indexOf('script_id');
    const lineOffset = functionInfoFields.indexOf('line');
    const columnOffset = functionInfoFields.indexOf('column');
    const functionInfoFieldCount = functionInfoFields.length;

    const rawInfos = profile.trace_function_infos;
    const infoLength = rawInfos.length;
    const functionInfos = this.#functionInfos = new Array(infoLength / functionInfoFieldCount);
    let index = 0;
    for (let i = 0; i < infoLength; i += functionInfoFieldCount) {
      functionInfos[index++] = new FunctionAllocationInfo(
          strings[rawInfos[i + functionNameOffset]], strings[rawInfos[i + scriptNameOffset]],
          rawInfos[i + scriptIdOffset], rawInfos[i + lineOffset], rawInfos[i + columnOffset]);
    }
  }

  #buildAllocationTree(profile: Profile, liveObjectStats: LiveObjects): TopDownAllocationNode {
    const traceTreeRaw = profile.trace_tree;
    const functionInfos = this.#functionInfos;
    const idToTopDownNode = this.#idToTopDownNode;

    const traceNodeFields = profile.snapshot.meta.trace_node_fields;
    const nodeIdOffset = traceNodeFields.indexOf('id');
    const functionInfoIndexOffset = traceNodeFields.indexOf('function_info_index');
    const allocationCountOffset = traceNodeFields.indexOf('count');
    const allocationSizeOffset = traceNodeFields.indexOf('size');
    const childrenOffset = traceNodeFields.indexOf('children');
    const nodeFieldCount = traceNodeFields.length;

    function traverseNode(
        // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawNodeArray: any, nodeOffset: any, parent: TopDownAllocationNode|null): TopDownAllocationNode {
      const functionInfo = functionInfos[rawNodeArray[nodeOffset + functionInfoIndexOffset]];
      const id = rawNodeArray[nodeOffset + nodeIdOffset];
      const stats = liveObjectStats[id];
      const liveCount = stats ? stats.count : 0;
      const liveSize = stats ? stats.size : 0;
      const result = new TopDownAllocationNode(
          id, functionInfo, rawNodeArray[nodeOffset + allocationCountOffset],
          rawNodeArray[nodeOffset + allocationSizeOffset], liveCount, liveSize, parent);
      idToTopDownNode[id] = result;
      functionInfo.addTraceTopNode(result);

      const rawChildren = rawNodeArray[nodeOffset + childrenOffset];
      for (let i = 0; i < rawChildren.length; i += nodeFieldCount) {
        result.children.push(traverseNode(rawChildren, i, result));
      }

      return result;
    }

    return traverseNode(traceTreeRaw, 0, null);
  }

  serializeTraceTops(): HeapSnapshotModel.HeapSnapshotModel.SerializedAllocationNode[] {
    if (this.#traceTops) {
      return this.#traceTops;
    }

    const result: HeapSnapshotModel.HeapSnapshotModel.SerializedAllocationNode[] = this.#traceTops = [];
    const functionInfos = this.#functionInfos;
    for (let i = 0; i < functionInfos.length; i++) {
      const info = functionInfos[i];
      if (info.totalCount === 0) {
        continue;
      }
      const nodeId = this.#nextNodeId++;
      const isRoot = i === 0;
      result.push(this.#serializeNode(
          nodeId, info, info.totalCount, info.totalSize, info.totalLiveCount, info.totalLiveSize, !isRoot));
      this.#collapsedTopNodeIdToFunctionInfo[nodeId] = info;
    }
    result.sort(function(a, b) {
      return b.size - a.size;
    });
    return result;
  }

  serializeCallers(nodeId: number): HeapSnapshotModel.HeapSnapshotModel.AllocationNodeCallers {
    let node = this.#ensureBottomUpNode(nodeId);
    const nodesWithSingleCaller = [];
    while (node.callers().length === 1) {
      node = node.callers()[0];
      nodesWithSingleCaller.push(this.#serializeCaller(node));
    }

    const branchingCallers = [];
    const callers = node.callers();
    for (let i = 0; i < callers.length; i++) {
      branchingCallers.push(this.#serializeCaller(callers[i]));
    }

    return new HeapSnapshotModel.HeapSnapshotModel.AllocationNodeCallers(nodesWithSingleCaller, branchingCallers);
  }

  serializeAllocationStack(traceNodeId: number): HeapSnapshotModel.HeapSnapshotModel.AllocationStackFrame[] {
    let node: (TopDownAllocationNode|null)|TopDownAllocationNode = this.#idToTopDownNode[traceNodeId];
    const result = [];
    while (node) {
      const functionInfo = node.functionInfo;
      result.push(new HeapSnapshotModel.HeapSnapshotModel.AllocationStackFrame(
          functionInfo.functionName, functionInfo.scriptName, functionInfo.scriptId, functionInfo.line,
          functionInfo.column));
      node = node.parent;
    }
    return result;
  }

  traceIds(allocationNodeId: number): number[] {
    return this.#ensureBottomUpNode(allocationNodeId).traceTopIds;
  }

  #ensureBottomUpNode(nodeId: number): BottomUpAllocationNode {
    let node = this.#idToNode[nodeId];
    if (!node) {
      const functionInfo = this.#collapsedTopNodeIdToFunctionInfo[nodeId];
      node = functionInfo.bottomUpRoot();
      delete this.#collapsedTopNodeIdToFunctionInfo[nodeId];
      this.#idToNode[nodeId] = node;
    }
    return node as BottomUpAllocationNode;
  }

  #serializeCaller(node: BottomUpAllocationNode): HeapSnapshotModel.HeapSnapshotModel.SerializedAllocationNode {
    const callerId = this.#nextNodeId++;
    this.#idToNode[callerId] = node;
    return this.#serializeNode(
        callerId, node.functionInfo, node.allocationCount, node.allocationSize, node.liveCount, node.liveSize,
        node.hasCallers());
  }

  #serializeNode(
      nodeId: number, functionInfo: FunctionAllocationInfo, count: number, size: number, liveCount: number,
      liveSize: number, hasChildren: boolean): HeapSnapshotModel.HeapSnapshotModel.SerializedAllocationNode {
    return new HeapSnapshotModel.HeapSnapshotModel.SerializedAllocationNode(
        nodeId, functionInfo.functionName, functionInfo.scriptName, functionInfo.scriptId, functionInfo.line,
        functionInfo.column, count, size, liveCount, liveSize, hasChildren);
  }
}

export class TopDownAllocationNode {
  id: number;
  functionInfo: FunctionAllocationInfo;
  allocationCount: number;
  allocationSize: number;
  liveCount: number;
  liveSize: number;
  parent: TopDownAllocationNode|null;
  children: TopDownAllocationNode[];
  constructor(
      id: number, functionInfo: FunctionAllocationInfo, count: number, size: number, liveCount: number,
      liveSize: number, parent: TopDownAllocationNode|null) {
    this.id = id;
    this.functionInfo = functionInfo;
    this.allocationCount = count;
    this.allocationSize = size;
    this.liveCount = liveCount;
    this.liveSize = liveSize;
    this.parent = parent;

    this.children = [];
  }
}

export class BottomUpAllocationNode {
  functionInfo: FunctionAllocationInfo;
  allocationCount: number;
  allocationSize: number;
  liveCount: number;
  liveSize: number;
  traceTopIds: number[];
  readonly #callersInternal: BottomUpAllocationNode[];
  constructor(functionInfo: FunctionAllocationInfo) {
    this.functionInfo = functionInfo;
    this.allocationCount = 0;
    this.allocationSize = 0;
    this.liveCount = 0;
    this.liveSize = 0;

    this.traceTopIds = [];

    this.#callersInternal = [];
  }

  addCaller(traceNode: TopDownAllocationNode): BottomUpAllocationNode {
    const functionInfo = traceNode.functionInfo;
    let result;
    for (let i = 0; i < this.#callersInternal.length; i++) {
      const caller = this.#callersInternal[i];
      if (caller.functionInfo === functionInfo) {
        result = caller;
        break;
      }
    }
    if (!result) {
      result = new BottomUpAllocationNode(functionInfo);
      this.#callersInternal.push(result);
    }
    return result;
  }

  callers(): BottomUpAllocationNode[] {
    return this.#callersInternal;
  }

  hasCallers(): boolean {
    return this.#callersInternal.length > 0;
  }
}

export class FunctionAllocationInfo {
  functionName: string;
  scriptName: string;
  scriptId: number;
  line: number;
  column: number;
  totalCount: number;
  totalSize: number;
  totalLiveCount: number;
  totalLiveSize: number;
  #traceTops: TopDownAllocationNode[];
  #bottomUpTree?: BottomUpAllocationNode;
  constructor(functionName: string, scriptName: string, scriptId: number, line: number, column: number) {
    this.functionName = functionName;
    this.scriptName = scriptName;
    this.scriptId = scriptId;
    this.line = line;
    this.column = column;
    this.totalCount = 0;
    this.totalSize = 0;
    this.totalLiveCount = 0;
    this.totalLiveSize = 0;

    this.#traceTops = [];
  }

  addTraceTopNode(node: TopDownAllocationNode): void {
    if (node.allocationCount === 0) {
      return;
    }
    this.#traceTops.push(node);
    this.totalCount += node.allocationCount;
    this.totalSize += node.allocationSize;
    this.totalLiveCount += node.liveCount;
    this.totalLiveSize += node.liveSize;
  }

  bottomUpRoot(): BottomUpAllocationNode|null {
    if (!this.#traceTops.length) {
      return null;
    }
    if (!this.#bottomUpTree) {
      this.#buildAllocationTraceTree();
    }
    return this.#bottomUpTree as BottomUpAllocationNode;
  }

  #buildAllocationTraceTree(): void {
    this.#bottomUpTree = new BottomUpAllocationNode(this);

    for (let i = 0; i < this.#traceTops.length; i++) {
      let node: (TopDownAllocationNode|null)|TopDownAllocationNode = this.#traceTops[i];
      let bottomUpNode: BottomUpAllocationNode = this.#bottomUpTree;
      const count = node.allocationCount;
      const size = node.allocationSize;
      const liveCount = node.liveCount;
      const liveSize = node.liveSize;
      const traceId = node.id;
      while (true) {
        bottomUpNode.allocationCount += count;
        bottomUpNode.allocationSize += size;
        bottomUpNode.liveCount += liveCount;
        bottomUpNode.liveSize += liveSize;
        bottomUpNode.traceTopIds.push(traceId);
        node = node.parent;
        if (node === null) {
          break;
        }

        bottomUpNode = bottomUpNode.addCaller(node);
      }
    }
  }
}
