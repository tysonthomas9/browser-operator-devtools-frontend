// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for shadcn component injection into VFS
 */

import {VFSManager} from '../vfs/VFSManager.js';
import {
  getShadcnFiles,
  getShadcnThemeCSS,
  UTILS_SOURCE,
  BUTTON_SOURCE,
  INPUT_SOURCE,
  CARD_SOURCE,
  BADGE_SOURCE,
  TABS_SOURCE,
  SELECT_SOURCE,
  TABLE_SOURCE,
  INDEX_SOURCE,
} from '../components/shadcn/sources.js';

describe('ai_chat: shadcn components', () => {
  let vfs: VFSManager;

  beforeEach(() => {
    vfs = VFSManager.getInstance();
    vfs.reset();
  });

  afterEach(() => {
    vfs.reset();
  });

  // ==========================================================================
  // Source Constants Tests
  // ==========================================================================

  describe('source constants', () => {
    it('UTILS_SOURCE contains cn function', () => {
      assert.include(UTILS_SOURCE, 'cn(');
      assert.include(UTILS_SOURCE, 'clsx');
      assert.include(UTILS_SOURCE, 'twMerge');
    });

    it('BUTTON_SOURCE contains Button component', () => {
      assert.include(BUTTON_SOURCE, 'Button');
      assert.include(BUTTON_SOURCE, 'variant');
      assert.include(BUTTON_SOURCE, 'preact');
    });

    it('INPUT_SOURCE contains Input component', () => {
      assert.include(INPUT_SOURCE, 'Input');
      assert.include(INPUT_SOURCE, 'className');
    });

    it('CARD_SOURCE contains Card components', () => {
      assert.include(CARD_SOURCE, 'Card');
      assert.include(CARD_SOURCE, 'CardHeader');
      assert.include(CARD_SOURCE, 'CardTitle');
      assert.include(CARD_SOURCE, 'CardContent');
    });

    it('BADGE_SOURCE contains Badge component', () => {
      assert.include(BADGE_SOURCE, 'Badge');
      assert.include(BADGE_SOURCE, 'variant');
    });

    it('TABS_SOURCE contains Tabs components', () => {
      assert.include(TABS_SOURCE, 'Tabs');
      assert.include(TABS_SOURCE, 'TabsList');
      assert.include(TABS_SOURCE, 'TabsTrigger');
      assert.include(TABS_SOURCE, 'TabsContent');
    });

    it('SELECT_SOURCE contains Select components', () => {
      assert.include(SELECT_SOURCE, 'Select');
      assert.include(SELECT_SOURCE, 'SelectItem');
    });

    it('TABLE_SOURCE contains Table components', () => {
      assert.include(TABLE_SOURCE, 'Table');
      assert.include(TABLE_SOURCE, 'TableHeader');
      assert.include(TABLE_SOURCE, 'TableBody');
      assert.include(TABLE_SOURCE, 'TableRow');
      assert.include(TABLE_SOURCE, 'TableCell');
    });

    it('INDEX_SOURCE exports all components', () => {
      assert.include(INDEX_SOURCE, 'Button');
      assert.include(INDEX_SOURCE, 'Input');
      assert.include(INDEX_SOURCE, 'Card');
      assert.include(INDEX_SOURCE, 'Badge');
      assert.include(INDEX_SOURCE, 'Tabs');
      assert.include(INDEX_SOURCE, 'Select');
      assert.include(INDEX_SOURCE, 'Table');
    });
  });

  // ==========================================================================
  // getShadcnFiles Tests
  // ==========================================================================

  describe('getShadcnFiles', () => {
    it('returns all component files', () => {
      const files = getShadcnFiles();

      assert.isOk(files['/src/components/ui/utils.ts']);
      assert.isOk(files['/src/components/ui/Button.tsx']);
      assert.isOk(files['/src/components/ui/Input.tsx']);
      assert.isOk(files['/src/components/ui/Card.tsx']);
      assert.isOk(files['/src/components/ui/Badge.tsx']);
      assert.isOk(files['/src/components/ui/Tabs.tsx']);
      assert.isOk(files['/src/components/ui/Select.tsx']);
      assert.isOk(files['/src/components/ui/Table.tsx']);
      assert.isOk(files['/src/components/ui/index.ts']);
    });

    it('files have correct paths', () => {
      const files = getShadcnFiles();
      const paths = Object.keys(files);

      for (const path of paths) {
        assert.isTrue(path.startsWith('/src/components/ui/'));
      }
    });

    it('returns 9 files total', () => {
      const files = getShadcnFiles();
      assert.strictEqual(Object.keys(files).length, 9);
    });
  });

  // ==========================================================================
  // getShadcnThemeCSS Tests
  // ==========================================================================

  describe('getShadcnThemeCSS', () => {
    it('contains CSS variables', () => {
      const css = getShadcnThemeCSS();

      assert.include(css, '--background');
      assert.include(css, '--foreground');
      assert.include(css, '--primary');
      assert.include(css, '--secondary');
    });

    it('contains dark mode styles', () => {
      const css = getShadcnThemeCSS();

      assert.include(css, '.dark');
    });

    it('sets border-color', () => {
      const css = getShadcnThemeCSS();

      assert.include(css, 'border-color');
    });
  });

  // ==========================================================================
  // VFS Integration Tests
  // ==========================================================================

  describe('VFS integration', () => {
    it('default template includes shadcn files', () => {
      const result = vfs.createApp('test-app', 'default');
      const files = result.files;

      // Should have default files
      assert.isOk(files['/src/index.tsx']);
      assert.isOk(files['/src/App.tsx']);
      assert.isOk(files['/src/styles.css']);

      // Should also have shadcn files
      assert.isOk(files['/src/components/ui/Button.tsx']);
      assert.isOk(files['/src/components/ui/Card.tsx']);
      assert.isOk(files['/src/components/ui/index.ts']);
    });

    it('blank template does not include shadcn files', () => {
      const result = vfs.createApp('test-app', 'blank');
      const files = result.files;

      assert.deepStrictEqual(files, {});
    });

    it('shadcn files can be disabled', () => {
      const result = vfs.createApp('test-app', 'default', false);
      const files = result.files;

      // Should have default files
      assert.isOk(files['/src/index.tsx']);

      // Should NOT have shadcn files
      assert.isUndefined(files['/src/components/ui/Button.tsx']);
    });

    it('default app has correct file count', () => {
      const result = vfs.createApp('test-app', 'default');
      const files = result.files;

      // 3 default files + 9 shadcn files = 12 total
      assert.strictEqual(Object.keys(files).length, 12);
    });

    it('shadcn files are readable', () => {
      vfs.createApp('test-app', 'default');

      const buttonSource = vfs.readFile('test-app', '/src/components/ui/Button.tsx');
      assert.isOk(buttonSource);
      assert.include(buttonSource!, 'Button');
    });

    it('shadcn files are in listFiles', () => {
      vfs.createApp('test-app', 'default');

      const fileList = vfs.listFiles('test-app');
      const paths = fileList.map(f => f.path);

      assert.include(paths, '/src/components/ui/Button.tsx');
      assert.include(paths, '/src/components/ui/index.ts');
    });

    it('shadcn files can be modified', () => {
      vfs.createApp('test-app', 'default');

      const customButton = 'export function Button() { return <button>Custom</button>; }';
      vfs.writeFile('test-app', '/src/components/ui/Button.tsx', customButton);

      const content = vfs.readFile('test-app', '/src/components/ui/Button.tsx');
      assert.strictEqual(content, customButton);
    });
  });

  // ==========================================================================
  // Import Resolution Tests
  // ==========================================================================

  describe('import resolution', () => {
    it('utils imports clsx from esm.sh', () => {
      assert.include(UTILS_SOURCE, 'https://esm.sh/clsx');
    });

    it('utils imports tailwind-merge from esm.sh', () => {
      assert.include(UTILS_SOURCE, 'https://esm.sh/tailwind-merge');
    });

    it('components import from preact', () => {
      assert.include(BUTTON_SOURCE, "import { h } from 'preact'");
    });

    it('components import utils from relative path', () => {
      assert.include(BUTTON_SOURCE, "from './utils'");
    });

    it('barrel export uses relative paths', () => {
      assert.include(INDEX_SOURCE, "from './Button'");
      assert.include(INDEX_SOURCE, "from './utils'");
    });
  });

  // ==========================================================================
  // Component Syntax Tests
  // ==========================================================================

  describe('component syntax', () => {
    it('Button exports ButtonProps type', () => {
      assert.include(BUTTON_SOURCE, 'ButtonProps');
      assert.include(BUTTON_SOURCE, 'interface ButtonProps');
    });

    it('Button uses variant and size props', () => {
      assert.include(BUTTON_SOURCE, "variant?: 'default'");
      assert.include(BUTTON_SOURCE, "size?: 'default'");
    });

    it('Card uses CardProps interface', () => {
      assert.include(CARD_SOURCE, 'CardProps');
    });

    it('Tabs uses context for state', () => {
      assert.include(TABS_SOURCE, 'createContext');
      assert.include(TABS_SOURCE, 'useContext');
    });

    it('Select handles click outside', () => {
      assert.include(SELECT_SOURCE, 'handleClickOutside');
    });

    it('Table wraps in overflow container', () => {
      assert.include(TABLE_SOURCE, 'overflow-auto');
    });
  });
});
