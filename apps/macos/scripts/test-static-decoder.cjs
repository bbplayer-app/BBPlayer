// Run with Node; native Swift builds do not depend on Node.
const assert = require('node:assert/strict');
require('../Sources/BBPlayerMac/Resources/Renderer/static-svga.js');
const decode = globalThis.BBPStaticSVGA.decode;
const float = (value) => { const b = Buffer.alloc(4); b.writeFloatLE(value); return [...b]; };
// MovieParams: width=100, height=50, fps=30, frames=2.
const params = [13, ...float(100), 21, ...float(50), 24, 30, 32, 2];
const image = [10, 3, ...Buffer.from('key'), 18, 3, 1, 2, 3];
const bytes = Uint8Array.from([10, 5, ...Buffer.from('2.1.0'), 18, params.length, ...params, 26, image.length, ...image]);
const movie = decode(bytes);
assert.equal(movie.version, '2.1.0');
assert.equal(movie.params.viewBoxWidth, 100);
assert.equal(movie.params.frames, 2);
assert.deepEqual([...movie.images.key], [1, 2, 3]);
assert.equal(movie.images.hasOwnProperty('key'), true);
assert.deepEqual(movie.sprites, []);
assert.throws(() => decode(bytes.subarray(0, bytes.length - 1)), /Truncated/);
assert.throws(() => decode(Uint8Array.from([0])), /Invalid/);
assert.throws(() => decode(Uint8Array.from([18, 255, 255, 255, 255, 15])), /Truncated/);
const originalFunction = globalThis.Function;
globalThis.Function = () => { throw new Error('Runtime code generation forbidden'); };
try { assert.equal(decode(bytes).params.fps, 30); }
finally { globalThis.Function = originalFunction; }
process.stdout.write('Static SVGA decoder: 10 assertions passed, runtime code generation disabled\n');
