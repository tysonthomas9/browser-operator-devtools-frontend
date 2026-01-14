// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {DevToolsPage} from '../../e2e_non_hosted/shared/frontend-helper.js';
import {getBrowserAndPagesWrappers} from '../../shared/non_hosted_wrappers.js';

/**
 * Creates a sandbox app in the DevTools context via VFS
 * @param appId - Unique identifier for the app
 * @param template - 'blank', 'default', or 'data-studio'
 * @param devToolsPage - Optional DevTools page instance
 * @returns The created app's VFS state
 */
export async function createSandboxApp(
    appId: string,
    template: 'blank' | 'default' | 'data-studio' = 'default',
    devToolsPage = getBrowserAndPagesWrappers().devToolsPage,
) {
  return await devToolsPage.evaluate(async (appId, template) => {
    try {
      // @ts-expect-error DevTools context
      const vfsModule = await import('/front_end/panels/ai_chat/sandbox_apps/vfs/VFSManager.js');
      const vfs = vfsModule.VFSManager.getInstance();
      const result = vfs.createApp(appId, template);
      return {
        success: true,
        appId: result.appId,
        entry: result.entry,
        fileCount: Object.keys(result.files).length,
        filePaths: Object.keys(result.files),
      };
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  }, appId, template);
}

/**
 * Gets the files for a sandbox app
 * @param appId - The app identifier
 * @param devToolsPage - Optional DevTools page instance
 */
export async function getSandboxAppFiles(
    appId: string,
    devToolsPage = getBrowserAndPagesWrappers().devToolsPage,
) {
  return await devToolsPage.evaluate(async (appId) => {
    try {
      // @ts-expect-error DevTools context
      const vfsModule = await import('/front_end/panels/ai_chat/sandbox_apps/vfs/VFSManager.js');
      const vfs = vfsModule.VFSManager.getInstance();
      return vfs.getFiles(appId);
    } catch (error) {
      return null;
    }
  }, appId);
}

/**
 * Reads a specific file from a sandbox app
 * @param appId - The app identifier
 * @param filePath - Path to the file within the app
 * @param devToolsPage - Optional DevTools page instance
 */
export async function readSandboxFile(
    appId: string,
    filePath: string,
    devToolsPage = getBrowserAndPagesWrappers().devToolsPage,
) {
  return await devToolsPage.evaluate(async (appId, filePath) => {
    try {
      // @ts-expect-error DevTools context
      const vfsModule = await import('/front_end/panels/ai_chat/sandbox_apps/vfs/VFSManager.js');
      const vfs = vfsModule.VFSManager.getInstance();
      return vfs.readFile(appId, filePath);
    } catch (error) {
      return null;
    }
  }, appId, filePath);
}

/**
 * Deletes a sandbox app
 * @param appId - The app identifier
 * @param devToolsPage - Optional DevTools page instance
 */
export async function deleteSandboxApp(
    appId: string,
    devToolsPage = getBrowserAndPagesWrappers().devToolsPage,
) {
  return await devToolsPage.evaluate(async (appId) => {
    try {
      // @ts-expect-error DevTools context
      const vfsModule = await import('/front_end/panels/ai_chat/sandbox_apps/vfs/VFSManager.js');
      const vfs = vfsModule.VFSManager.getInstance();
      return vfs.deleteApp(appId);
    } catch (error) {
      return false;
    }
  }, appId);
}

/**
 * Resets the VFS manager (clears all apps)
 * @param devToolsPage - Optional DevTools page instance
 */
export async function resetVFS(
    devToolsPage = getBrowserAndPagesWrappers().devToolsPage,
) {
  return await devToolsPage.evaluate(async () => {
    try {
      // @ts-expect-error DevTools context
      const vfsModule = await import('/front_end/panels/ai_chat/sandbox_apps/vfs/VFSManager.js');
      const vfs = vfsModule.VFSManager.getInstance();
      vfs.reset();
      return true;
    } catch (error) {
      return false;
    }
  });
}

/**
 * Gets the Data Studio template source files directly
 * @param devToolsPage - Optional DevTools page instance
 */
export async function getDataStudioSources(
    devToolsPage = getBrowserAndPagesWrappers().devToolsPage,
) {
  return await devToolsPage.evaluate(async () => {
    try {
      // @ts-expect-error DevTools context
      const sourcesModule = await import('/front_end/panels/ai_chat/sandbox_apps/apps/data-studio/sources.js');
      return {
        success: true,
        hasIndexSource: !!sourcesModule.INDEX_SOURCE,
        hasAppSource: !!sourcesModule.APP_SOURCE,
        hasStoreSource: !!sourcesModule.STORE_SOURCE,
        hasBridgeSource: !!sourcesModule.BRIDGE_SOURCE,
        hasTypesSource: !!sourcesModule.TYPES_SOURCE,
      };
    } catch (error) {
      return {success: false, error: (error as Error).message};
    }
  });
}
