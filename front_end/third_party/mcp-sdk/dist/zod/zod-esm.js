// ES module wrapper for zod (dist path compatibility)
// The SDK’s ESM files import "../../zod/zod-esm.js" relative to their own
// location. Some DevTools bundling paths may instead resolve to
// "dist/zod/zod-esm.js". This file mirrors the top-level wrapper and forwards
// to the canonical zod ESM entry.
export * from '../../zod/lib/index.mjs';
export { z } from '../../zod/lib/index.mjs';

