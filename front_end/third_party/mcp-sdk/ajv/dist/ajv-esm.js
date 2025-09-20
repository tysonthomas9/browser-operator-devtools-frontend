// ES module wrapper for ajv.bundle.js
import * as ajvModule from './ajv.bundle.js';

// Try multiple ways to get AJV - from direct import, global, or window
const Ajv = ajvModule.default || ajvModule.Ajv || globalThis.Ajv || window?.Ajv;
if (!Ajv) {
  throw new Error('AJV failed to load from bundle. ajvModule=' + typeof ajvModule + ', globalThis.Ajv=' + typeof globalThis.Ajv + ', window.Ajv=' + typeof window?.Ajv);
}
export default Ajv;