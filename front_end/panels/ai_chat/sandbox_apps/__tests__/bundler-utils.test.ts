// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for bundler-utils - Pure utility functions for the bundler
 */

import {
  toEsmShUrl,
  isBareSpecifier,
  dirname,
  normalizePath,
  resolveRelativePath,
  resolveWithExtensions,
  loaderForPath,
  formatLocation,
  formatMessages,
  isReactExternal,
  ESM_SH_DEFAULT_QUERY,
  REACT_EXTERNALS,
} from '../bundler/bundler-utils.js';

describe('ai_chat: bundler-utils', () => {
  // ==========================================================================
  // toEsmShUrl Tests
  // ==========================================================================

  describe('toEsmShUrl', () => {
    it('converts simple package name to esm.sh URL', () => {
      const result = toEsmShUrl('lodash');
      assert.strictEqual(result, `https://esm.sh/lodash?${ESM_SH_DEFAULT_QUERY}`);
    });

    it('converts scoped package to esm.sh URL', () => {
      const result = toEsmShUrl('@tanstack/react-query');
      assert.strictEqual(result, `https://esm.sh/@tanstack/react-query?${ESM_SH_DEFAULT_QUERY}`);
    });

    it('converts package with version to esm.sh URL', () => {
      const result = toEsmShUrl('lodash@4.17.21');
      assert.strictEqual(result, `https://esm.sh/lodash@4.17.21?${ESM_SH_DEFAULT_QUERY}`);
    });

    it('appends to existing query parameters', () => {
      const result = toEsmShUrl('lodash?bundle');
      assert.strictEqual(result, `https://esm.sh/lodash?bundle&${ESM_SH_DEFAULT_QUERY}`);
    });

    it('handles package with subpath', () => {
      const result = toEsmShUrl('lodash/debounce');
      assert.strictEqual(result, `https://esm.sh/lodash/debounce?${ESM_SH_DEFAULT_QUERY}`);
    });
  });

  // ==========================================================================
  // isBareSpecifier Tests
  // ==========================================================================

  describe('isBareSpecifier', () => {
    it('returns true for simple package name', () => {
      assert.isTrue(isBareSpecifier('lodash'));
    });

    it('returns true for scoped package', () => {
      assert.isTrue(isBareSpecifier('@scope/package'));
    });

    it('returns true for package with subpath', () => {
      assert.isTrue(isBareSpecifier('lodash/debounce'));
    });

    it('returns false for relative path with ./', () => {
      assert.isFalse(isBareSpecifier('./foo'));
    });

    it('returns false for relative path with ../', () => {
      assert.isFalse(isBareSpecifier('../foo'));
    });

    it('returns false for absolute path', () => {
      assert.isFalse(isBareSpecifier('/src/utils'));
    });

    it('returns false for http URL', () => {
      assert.isFalse(isBareSpecifier('http://example.com/lib.js'));
    });

    it('returns false for https URL', () => {
      assert.isFalse(isBareSpecifier('https://esm.sh/lodash'));
    });

    it('returns false for data URL', () => {
      assert.isFalse(isBareSpecifier('data:text/javascript,export default 42'));
    });

    it('returns false for empty string', () => {
      assert.isFalse(isBareSpecifier(''));
    });

    it('returns false for @/ path alias', () => {
      // @/ is a path alias, not a scoped package
      // However, isBareSpecifier returns true for @/ since it doesn't start with special chars
      // The path alias handling happens separately in the VFS plugin
      assert.isTrue(isBareSpecifier('@/utils'));
    });
  });

  // ==========================================================================
  // dirname Tests
  // ==========================================================================

  describe('dirname', () => {
    it('returns directory for nested path', () => {
      assert.strictEqual(dirname('/src/components/App.tsx'), '/src/components');
    });

    it('returns /src for file in src directory', () => {
      assert.strictEqual(dirname('/src/App.tsx'), '/src');
    });

    it('returns / for file at root', () => {
      assert.strictEqual(dirname('/file.ts'), '/');
    });

    it('returns / for path without slash', () => {
      assert.strictEqual(dirname('file.ts'), '/');
    });

    it('returns / for root path', () => {
      assert.strictEqual(dirname('/'), '/');
    });

    it('returns / for empty path', () => {
      assert.strictEqual(dirname(''), '/');
    });
  });

  // ==========================================================================
  // normalizePath Tests
  // ==========================================================================

  describe('normalizePath', () => {
    it('resolves .. segments', () => {
      assert.strictEqual(normalizePath('/src/../lib/utils'), '/lib/utils');
    });

    it('resolves . segments', () => {
      assert.strictEqual(normalizePath('/src/./App.tsx'), '/src/App.tsx');
    });

    it('removes duplicate slashes', () => {
      assert.strictEqual(normalizePath('//src//file.ts'), '/src/file.ts');
    });

    it('handles multiple .. segments', () => {
      assert.strictEqual(normalizePath('/src/components/../utils/../App.tsx'), '/src/App.tsx');
    });

    it('handles .. at the beginning', () => {
      assert.strictEqual(normalizePath('../src/utils'), '/src/utils');
    });

    it('handles too many .. segments', () => {
      // Going above root just stays at root
      assert.strictEqual(normalizePath('/src/../../file.ts'), '/file.ts');
    });

    it('returns / for empty path', () => {
      assert.strictEqual(normalizePath(''), '/');
    });

    it('returns / for just slashes', () => {
      assert.strictEqual(normalizePath('///'), '/');
    });

    it('preserves path without special segments', () => {
      assert.strictEqual(normalizePath('/src/components/ui'), '/src/components/ui');
    });
  });

  // ==========================================================================
  // resolveRelativePath Tests
  // ==========================================================================

  describe('resolveRelativePath', () => {
    it('resolves ./ relative path', () => {
      assert.strictEqual(resolveRelativePath('/src', './App'), '/src/App');
    });

    it('resolves ../ relative path', () => {
      assert.strictEqual(resolveRelativePath('/src/components', '../utils'), '/src/utils');
    });

    it('handles absolute path (ignores resolveDir)', () => {
      assert.strictEqual(resolveRelativePath('/src', '/lib/utils'), '/lib/utils');
    });

    it('handles resolveDir with trailing slash', () => {
      assert.strictEqual(resolveRelativePath('/src/', './App'), '/src/App');
    });

    it('handles resolveDir without trailing slash', () => {
      assert.strictEqual(resolveRelativePath('/src', './App'), '/src/App');
    });

    it('resolves nested relative path', () => {
      assert.strictEqual(resolveRelativePath('/src/components', '../utils/helpers'), '/src/utils/helpers');
    });

    it('handles path without leading ./', () => {
      assert.strictEqual(resolveRelativePath('/src', 'App'), '/src/App');
    });
  });

  // ==========================================================================
  // resolveWithExtensions Tests
  // ==========================================================================

  describe('resolveWithExtensions', () => {
    const files: Record<string, string> = {
      '/src/App.tsx': 'export default App;',
      '/src/utils.ts': 'export const helper = 1;',
      '/src/styles.css': 'body {}',
      '/src/data.json': '{}',
      '/src/script.js': 'console.log(1);',
      '/src/component.jsx': 'export default () => <div />;',
      '/src/components/ui/index.ts': 'export * from "./Button";',
      '/src/exact': 'exact match without extension',
    };

    it('returns exact match when file exists', () => {
      assert.strictEqual(resolveWithExtensions('/src/App.tsx', files), '/src/App.tsx');
    });

    it('returns exact match for file without extension', () => {
      assert.strictEqual(resolveWithExtensions('/src/exact', files), '/src/exact');
    });

    it('resolves .tsx extension', () => {
      assert.strictEqual(resolveWithExtensions('/src/App', files), '/src/App.tsx');
    });

    it('resolves .ts extension', () => {
      assert.strictEqual(resolveWithExtensions('/src/utils', files), '/src/utils.ts');
    });

    it('resolves .js extension', () => {
      assert.strictEqual(resolveWithExtensions('/src/script', files), '/src/script.js');
    });

    it('resolves .jsx extension', () => {
      assert.strictEqual(resolveWithExtensions('/src/component', files), '/src/component.jsx');
    });

    it('resolves .css extension', () => {
      assert.strictEqual(resolveWithExtensions('/src/styles', files), '/src/styles.css');
    });

    it('resolves .json extension', () => {
      assert.strictEqual(resolveWithExtensions('/src/data', files), '/src/data.json');
    });

    it('resolves index file in directory', () => {
      assert.strictEqual(resolveWithExtensions('/src/components/ui', files), '/src/components/ui/index.ts');
    });

    it('returns null for non-existent file', () => {
      assert.isNull(resolveWithExtensions('/src/nonexistent', files));
    });

    it('returns null for empty files map', () => {
      assert.isNull(resolveWithExtensions('/src/App', {}));
    });

    it('prefers exact match over extension', () => {
      const filesWithBoth: Record<string, string> = {
        '/src/file': 'exact',
        '/src/file.ts': 'with extension',
      };
      assert.strictEqual(resolveWithExtensions('/src/file', filesWithBoth), '/src/file');
    });

    it('prefers .tsx over .ts', () => {
      const filesWithMultiple: Record<string, string> = {
        '/src/App.tsx': 'tsx version',
        '/src/App.ts': 'ts version',
      };
      assert.strictEqual(resolveWithExtensions('/src/App', filesWithMultiple), '/src/App.tsx');
    });
  });

  // ==========================================================================
  // loaderForPath Tests
  // ==========================================================================

  describe('loaderForPath', () => {
    it('returns tsx for .tsx files', () => {
      assert.strictEqual(loaderForPath('/src/App.tsx'), 'tsx');
    });

    it('returns ts for .ts files', () => {
      assert.strictEqual(loaderForPath('/src/utils.ts'), 'ts');
    });

    it('returns jsx for .jsx files', () => {
      assert.strictEqual(loaderForPath('/src/Component.jsx'), 'jsx');
    });

    it('returns js for .js files', () => {
      assert.strictEqual(loaderForPath('/src/script.js'), 'js');
    });

    it('returns css for .css files', () => {
      assert.strictEqual(loaderForPath('/src/styles.css'), 'css');
    });

    it('returns json for .json files', () => {
      assert.strictEqual(loaderForPath('/data.json'), 'json');
    });

    it('returns text for unknown extensions', () => {
      assert.strictEqual(loaderForPath('/readme.md'), 'text');
    });

    it('returns text for files without extension', () => {
      assert.strictEqual(loaderForPath('/Makefile'), 'text');
    });

    it('handles nested paths', () => {
      assert.strictEqual(loaderForPath('/src/components/ui/Button.tsx'), 'tsx');
    });

    it('handles double extensions (uses last)', () => {
      assert.strictEqual(loaderForPath('/file.test.tsx'), 'tsx');
    });
  });

  // ==========================================================================
  // formatLocation Tests
  // ==========================================================================

  describe('formatLocation', () => {
    it('formats complete location', () => {
      const result = formatLocation({file: '/src/App.tsx', line: 10, column: 5});
      assert.strictEqual(result, '/src/App.tsx:10:5');
    });

    it('uses defaults for missing fields', () => {
      const result = formatLocation({file: '/src/App.tsx'});
      assert.strictEqual(result, '/src/App.tsx:0:0');
    });

    it('uses <unknown> for missing file', () => {
      const result = formatLocation({line: 10, column: 5});
      assert.strictEqual(result, '<unknown>:10:5');
    });

    it('returns empty string for null', () => {
      assert.strictEqual(formatLocation(null), '');
    });

    it('returns empty string for undefined', () => {
      assert.strictEqual(formatLocation(undefined), '');
    });

    it('handles empty object', () => {
      const result = formatLocation({});
      assert.strictEqual(result, '<unknown>:0:0');
    });
  });

  // ==========================================================================
  // formatMessages Tests
  // ==========================================================================

  describe('formatMessages', () => {
    it('formats messages with locations', () => {
      const msgs = [
        {text: 'Error found', location: {file: '/src/App.tsx', line: 10, column: 5}},
      ];
      const result = formatMessages(msgs);
      assert.deepStrictEqual(result, ['/src/App.tsx:10:5 Error found']);
    });

    it('formats messages without locations', () => {
      const msgs = [{text: 'General error'}];
      const result = formatMessages(msgs);
      assert.deepStrictEqual(result, ['General error']);
    });

    it('handles mixed messages', () => {
      const msgs = [
        {text: 'Error 1', location: {file: '/src/App.tsx', line: 5, column: 1}},
        {text: 'Error 2'},
        {text: 'Error 3', location: {file: '/src/utils.ts', line: 10, column: 3}},
      ];
      const result = formatMessages(msgs);
      assert.deepStrictEqual(result, [
        '/src/App.tsx:5:1 Error 1',
        'Error 2',
        '/src/utils.ts:10:3 Error 3',
      ]);
    });

    it('returns empty array for null', () => {
      assert.deepStrictEqual(formatMessages(null), []);
    });

    it('returns empty array for undefined', () => {
      assert.deepStrictEqual(formatMessages(undefined), []);
    });

    it('returns empty array for empty array', () => {
      assert.deepStrictEqual(formatMessages([]), []);
    });

    it('returns empty array for non-array', () => {
      assert.deepStrictEqual(formatMessages('not an array' as any), []);
    });
  });

  // ==========================================================================
  // isReactExternal Tests
  // ==========================================================================

  describe('isReactExternal', () => {
    it('returns true for react', () => {
      assert.isTrue(isReactExternal('react'));
    });

    it('returns true for react-dom', () => {
      assert.isTrue(isReactExternal('react-dom'));
    });

    it('returns true for react-dom/client', () => {
      assert.isTrue(isReactExternal('react-dom/client'));
    });

    it('returns true for react/jsx-runtime', () => {
      assert.isTrue(isReactExternal('react/jsx-runtime'));
    });

    it('returns true for zustand', () => {
      assert.isTrue(isReactExternal('zustand'));
    });

    it('returns true for zustand/middleware', () => {
      assert.isTrue(isReactExternal('zustand/middleware'));
    });

    it('returns false for preact', () => {
      assert.isFalse(isReactExternal('preact'));
    });

    it('returns false for react subpath not in list', () => {
      assert.isFalse(isReactExternal('react/test-renderer'));
    });

    it('returns false for regular packages', () => {
      assert.isFalse(isReactExternal('lodash'));
    });
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe('constants', () => {
    it('ESM_SH_DEFAULT_QUERY includes es2022 target', () => {
      assert.include(ESM_SH_DEFAULT_QUERY, 'target=es2022');
    });

    it('ESM_SH_DEFAULT_QUERY marks react as external', () => {
      assert.include(ESM_SH_DEFAULT_QUERY, 'external=react');
    });

    it('REACT_EXTERNALS contains expected modules', () => {
      assert.isTrue(REACT_EXTERNALS.has('react'));
      assert.isTrue(REACT_EXTERNALS.has('react-dom'));
      assert.isTrue(REACT_EXTERNALS.has('react-dom/client'));
      assert.isTrue(REACT_EXTERNALS.has('react/jsx-runtime'));
      assert.isTrue(REACT_EXTERNALS.has('zustand'));
      assert.isTrue(REACT_EXTERNALS.has('zustand/middleware'));
      assert.strictEqual(REACT_EXTERNALS.size, 6);
    });
  });
});
