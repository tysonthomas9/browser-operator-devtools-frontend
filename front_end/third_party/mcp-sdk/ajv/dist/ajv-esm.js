// ES module wrapper for ajv.bundle.js
import ajvBundle from './ajv.bundle.js';

// Try multiple ways to get AJV - from direct import, global, or window
const Ajv = ajvBundle || globalThis.Ajv || window?.Ajv;
if (!Ajv) {
  throw new Error('AJV failed to load from bundle. ajvBundle=' + typeof ajvBundle + ', globalThis.Ajv=' + typeof globalThis.Ajv + ', window.Ajv=' + typeof window?.Ajv);
}
export default Ajv;