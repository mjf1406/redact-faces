function readVarint(buf, offset) {
  let value = 0n;
  let shift = 0n;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos];
    pos += 1;
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      const num = value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
      return { value: num, offset: pos };
    }
    shift += 7n;
    if (shift > 70n) throw new Error('varint too long');
  }
  throw new Error('truncated varint');
}

function skip(buf, offset, wire) {
  if (wire === 0) return readVarint(buf, offset).offset;
  if (wire === 1) return offset + 8;
  if (wire === 5) return offset + 4;
  if (wire === 2) {
    const len = readVarint(buf, offset);
    const size = typeof len.value === 'number' ? len.value : Number(len.value);
    return len.offset + size;
  }
  throw new Error(`unsupported wire type ${wire}`);
}

function readBytes(buf, offset) {
  const len = readVarint(buf, offset);
  const size = typeof len.value === 'number' ? len.value : Number(len.value);
  const start = len.offset;
  const end = start + size;
  return { bytes: buf.subarray(start, end), offset: end };
}

function fields(buf) {
  const out = [];
  let offset = 0;
  while (offset < buf.length) {
    const key = readVarint(buf, offset);
    const keyNum = typeof key.value === 'number' ? key.value : Number(key.value);
    const field = keyNum >> 3;
    const wire = keyNum & 7;
    if (wire === 2) {
      const body = readBytes(buf, key.offset);
      out.push({ field, wire, bytes: body.bytes });
      offset = body.offset;
    } else if (wire === 0) {
      const body = readVarint(buf, key.offset);
      out.push({ field, wire, value: body.value });
      offset = body.offset;
    } else {
      offset = skip(buf, key.offset, wire);
    }
  }
  return out;
}

function readString(bytes) {
  return new TextDecoder().decode(bytes);
}

function parseShape(bytes) {
  const dims = [];
  for (const field of fields(bytes)) {
    if (field.field !== 1 || !field.bytes) continue;
    let dimValue;
    let dimParam;
    for (const part of fields(field.bytes)) {
      if (part.field === 1 && part.wire === 0) dimValue = part.value;
      if (part.field === 2 && part.bytes) dimParam = readString(part.bytes);
    }
    dims.push(dimValue ?? dimParam ?? '?');
  }
  return dims;
}

function parseType(bytes) {
  for (const field of fields(bytes)) {
    if (field.field === 1 && field.bytes) {
      let elemType;
      let shape = [];
      for (const part of fields(field.bytes)) {
        if (part.field === 1 && part.wire === 0) elemType = part.value;
        if (part.field === 2 && part.bytes) shape = parseShape(part.bytes);
      }
      return { elemType, shape };
    }
  }
  return { elemType: undefined, shape: [] };
}

function parseValueInfo(bytes) {
  let name = '';
  let type = { elemType: undefined, shape: [] };
  for (const field of fields(bytes)) {
    if (field.field === 1 && field.bytes) name = readString(field.bytes);
    if (field.field === 2 && field.bytes) type = parseType(field.bytes);
  }
  return { name, ...type };
}

function parseGraphIo(graphBytes) {
  const inputs = [];
  const outputs = [];
  for (const field of fields(graphBytes)) {
    if (field.field === 11 && field.bytes) inputs.push(parseValueInfo(field.bytes));
    if (field.field === 12 && field.bytes) outputs.push(parseValueInfo(field.bytes));
  }
  return { inputs, outputs };
}

export function parseOnnxIo(buffer) {
  const buf = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  for (const field of fields(buf)) {
    if (field.field === 7 && field.bytes) return parseGraphIo(field.bytes);
  }
  return { inputs: [], outputs: [] };
}
