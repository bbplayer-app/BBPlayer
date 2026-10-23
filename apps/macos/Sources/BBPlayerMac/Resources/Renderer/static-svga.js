// Schema from pinned SVGAPlayer-Web 2.3.1 (Apache-2.0). No runtime code generation.
(function(){
  "use strict";
  const TYPES={"MovieParams":{"viewBoxWidth":{"type":"float","id":1},"viewBoxHeight":{"type":"float","id":2},"fps":{"type":"int32","id":3},"frames":{"type":"int32","id":4}},"SpriteEntity":{"imageKey":{"type":"string","id":1},"frames":{"rule":"repeated","type":"FrameEntity","id":2},"matteKey":{"type":"string","id":3}},"AudioEntity":{"audioKey":{"type":"string","id":1},"startFrame":{"type":"int32","id":2},"endFrame":{"type":"int32","id":3},"startTime":{"type":"int32","id":4},"totalTime":{"type":"int32","id":5}},"Layout":{"x":{"type":"float","id":1},"y":{"type":"float","id":2},"width":{"type":"float","id":3},"height":{"type":"float","id":4}},"Transform":{"a":{"type":"float","id":1},"b":{"type":"float","id":2},"c":{"type":"float","id":3},"d":{"type":"float","id":4},"tx":{"type":"float","id":5},"ty":{"type":"float","id":6}},"ShapeEntity":{"type":{"type":"ShapeType","id":1},"shape":{"type":"ShapeArgs","id":2},"rect":{"type":"RectArgs","id":3},"ellipse":{"type":"EllipseArgs","id":4},"styles":{"type":"ShapeStyle","id":10},"transform":{"type":"Transform","id":11}},"ShapeArgs":{"d":{"type":"string","id":1}},"RectArgs":{"x":{"type":"float","id":1},"y":{"type":"float","id":2},"width":{"type":"float","id":3},"height":{"type":"float","id":4},"cornerRadius":{"type":"float","id":5}},"EllipseArgs":{"x":{"type":"float","id":1},"y":{"type":"float","id":2},"radiusX":{"type":"float","id":3},"radiusY":{"type":"float","id":4}},"ShapeStyle":{"fill":{"type":"RGBAColor","id":1},"stroke":{"type":"RGBAColor","id":2},"strokeWidth":{"type":"float","id":3},"lineCap":{"type":"LineCap","id":4},"lineJoin":{"type":"LineJoin","id":5},"miterLimit":{"type":"float","id":6},"lineDashI":{"type":"float","id":7},"lineDashII":{"type":"float","id":8},"lineDashIII":{"type":"float","id":9}},"RGBAColor":{"r":{"type":"float","id":1},"g":{"type":"float","id":2},"b":{"type":"float","id":3},"a":{"type":"float","id":4}},"FrameEntity":{"alpha":{"type":"float","id":1},"layout":{"type":"Layout","id":2},"transform":{"type":"Transform","id":3},"clipPath":{"type":"string","id":4},"shapes":{"rule":"repeated","type":"ShapeEntity","id":5}},"MovieEntity":{"version":{"type":"string","id":1},"params":{"type":"MovieParams","id":2},"images":{"keyType":"string","type":"bytes","id":3},"sprites":{"rule":"repeated","type":"SpriteEntity","id":4},"audios":{"rule":"repeated","type":"AudioEntity","id":5}}};
  const ENUMS=["ShapeType", "LineCap", "LineJoin"];
  const utf8 = new TextDecoder('utf-8', {fatal: true});
  function decode(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.byteLength > 33554432) throw new Error('SVGA decoded payload exceeds 32MB');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let position = 0;
    function requireBytes(count, end) {
      if (!Number.isSafeInteger(count) || count < 0 || position + count > end) throw new Error('Truncated SVGA protobuf');
    }
    function varint(end) {
      let value = 0;
      for (let shift = 0; shift < 70; shift += 7) {
        requireBytes(1, end);
        const byte = bytes[position++];
        if (shift < 32) value |= (byte & 127) << shift;
        if (!(byte & 128)) return value >>> 0;
      }
      throw new Error('Invalid SVGA varint');
    }
    function block(end) {
      const count = varint(end); requireBytes(count, end);
      const start = position; position += count;
      return bytes.subarray(start, position);
    }
    function skip(wire, end) {
      if (wire === 0) { varint(end); return; }
      if (wire === 2) { block(end); return; }
      const count = wire === 5 ? 4 : wire === 1 ? 8 : -1;
      requireBytes(count, end); position += count;
    }
    function scalar(type, wire, end, depth) {
      if (type === 'float') {
        if (wire !== 5) throw new Error('Invalid float wire type');
        requireBytes(4, end); const value = view.getFloat32(position, true); position += 4; return value;
      }
      if (type === 'int32' || ENUMS.includes(type)) {
        if (wire !== 0) throw new Error('Invalid integer wire type');
        return varint(end) | 0;
      }
      if (wire !== 2) throw new Error('Invalid message wire type');
      if (type === 'bytes') return block(end);
      if (type === 'string') return utf8.decode(block(end));
      const length = varint(end); requireBytes(length, end);
      return message(type, position + length, depth + 1);
    }
    function emptyMap() {
      const map = Object.create(null);
      Object.defineProperty(map, 'hasOwnProperty', {value: function(key) { return Object.prototype.hasOwnProperty.call(this, key); }});
      return map;
    }
    function message(name, end, depth) {
      if (depth > 32 || !TYPES[name]) throw new Error('Unsupported SVGA message');
      const fields = TYPES[name], output = {}, byID = Object.create(null);
      for (const [key, field] of Object.entries(fields)) {
        byID[field.id] = [key, field];
        output[key] = field.keyType ? emptyMap() : field.rule === 'repeated' ? [] : field.type === 'string' ? '' : field.type === 'bytes' ? new Uint8Array(0) : field.type === 'float' || field.type === 'int32' || ENUMS.includes(field.type) ? 0 : null;
      }
      while (position < end) {
        const tag = varint(end), id = tag >>> 3, wire = tag & 7;
        if (!id) throw new Error('Invalid SVGA field');
        const entry = byID[id];
        if (!entry) { skip(wire, end); continue; }
        const [key, field] = entry;
        if (field.keyType) {
          if (wire !== 2) throw new Error('Invalid map wire type');
          const length = varint(end); requireBytes(length, end); const entryEnd = position + length;
          let mapKey = '', value = new Uint8Array(0);
          while (position < entryEnd) {
            const tag = varint(entryEnd), number = tag >>> 3;
            if (number === 1) mapKey = scalar(field.keyType, tag & 7, entryEnd, depth);
            else if (number === 2) value = scalar(field.type, tag & 7, entryEnd, depth);
            else skip(tag & 7, entryEnd);
          }
          if (mapKey === 'hasOwnProperty') throw new Error('Reserved image key');
          output[key][mapKey] = value;
        } else {
          const value = scalar(field.type, wire, end, depth);
          if (field.rule === 'repeated') output[key].push(value); else output[key] = value;
        }
      }
      return output;
    }
    return message('MovieEntity', bytes.length, 0);
  }
  globalThis.BBPStaticSVGA = Object.freeze({decode});
})();
