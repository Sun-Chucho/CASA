import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceDirectory = process.argv[2];
const outputFile = process.argv[3];
if (!sourceDirectory) {
  throw new Error("Usage: node scripts/recover-chromium-localstorage.mjs <copied-leveldb-directory>");
}

function readVarint(buffer, start) {
  let value = 0;
  let shift = 0;
  let offset = start;
  while (offset < buffer.length && shift <= 49) {
    const byte = buffer[offset++];
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return { value, offset };
    shift += 7;
  }
  throw new Error("Invalid varint");
}

function decompressSnappy(input) {
  const header = readVarint(input, 0);
  const output = Buffer.allocUnsafe(header.value);
  let inputOffset = header.offset;
  let outputOffset = 0;

  while (inputOffset < input.length && outputOffset < output.length) {
    const tag = input[inputOffset++];
    const type = tag & 3;
    if (type === 0) {
      let length = tag >>> 2;
      if (length < 60) {
        length += 1;
      } else {
        const byteCount = length - 59;
        length = 1;
        for (let index = 0; index < byteCount; index += 1) {
          length += input[inputOffset++] * 2 ** (8 * index);
        }
      }
      input.copy(output, outputOffset, inputOffset, inputOffset + length);
      inputOffset += length;
      outputOffset += length;
      continue;
    }

    let length;
    let copyOffset;
    if (type === 1) {
      length = 4 + ((tag >>> 2) & 7);
      copyOffset = ((tag & 0xe0) << 3) | input[inputOffset++];
    } else if (type === 2) {
      length = 1 + (tag >>> 2);
      copyOffset = input.readUInt16LE(inputOffset);
      inputOffset += 2;
    } else {
      length = 1 + (tag >>> 2);
      copyOffset = input.readUInt32LE(inputOffset);
      inputOffset += 4;
    }
    if (copyOffset <= 0 || copyOffset > outputOffset) throw new Error("Invalid Snappy copy offset");
    for (let index = 0; index < length; index += 1) {
      output[outputOffset] = output[outputOffset - copyOffset];
      outputOffset += 1;
    }
  }

  if (outputOffset !== output.length) throw new Error("Incomplete Snappy block");
  return output;
}

function readBlock(file, handle) {
  const trailerOffset = handle.offset + handle.size;
  if (handle.offset < 0 || trailerOffset + 5 > file.length) throw new Error("Invalid block handle");
  const raw = file.subarray(handle.offset, trailerOffset);
  const compression = file[trailerOffset];
  if (compression === 0) return raw;
  if (compression === 1) return decompressSnappy(raw);
  throw new Error(`Unsupported LevelDB compression type ${compression}`);
}

function decodeHandle(value) {
  const offset = readVarint(value, 0);
  const size = readVarint(value, offset.offset);
  return { offset: offset.value, size: size.value };
}

function parseBlockEntries(block) {
  if (block.length < 4) return [];
  const restartCount = block.readUInt32LE(block.length - 4);
  const entriesEnd = block.length - 4 - restartCount * 4;
  if (restartCount === 0 || entriesEnd < 0) return [];

  const entries = [];
  let previousKey = Buffer.alloc(0);
  let offset = 0;
  while (offset < entriesEnd) {
    const shared = readVarint(block, offset);
    const unshared = readVarint(block, shared.offset);
    const valueLength = readVarint(block, unshared.offset);
    offset = valueLength.offset;
    const keyEnd = offset + unshared.value;
    const valueEnd = keyEnd + valueLength.value;
    if (shared.value > previousKey.length || valueEnd > entriesEnd) break;
    const key = Buffer.concat([previousKey.subarray(0, shared.value), block.subarray(offset, keyEnd)]);
    const value = Buffer.from(block.subarray(keyEnd, valueEnd));
    entries.push({ key, value });
    previousKey = key;
    offset = valueEnd;
  }
  return entries;
}

function parseTable(file) {
  if (file.length < 48) return [];
  const footer = file.subarray(file.length - 48);
  const magic = footer.subarray(40).toString("hex");
  if (magic !== "57fb808b247547db") return [];
  const metaHandle = readVarint(footer, 0);
  readVarint(footer, metaHandle.offset);
  const indexOffset = readVarint(footer, readVarint(footer, metaHandle.offset).offset);
  const indexSize = readVarint(footer, indexOffset.offset);
  const indexBlock = readBlock(file, { offset: indexOffset.value, size: indexSize.value });
  const records = [];
  for (const indexEntry of parseBlockEntries(indexBlock)) {
    try {
      records.push(...parseBlockEntries(readBlock(file, decodeHandle(indexEntry.value))));
    } catch {
      // Preserve all other readable blocks if one damaged table block cannot be decoded.
    }
  }
  return records;
}

function decodeChromiumString(value) {
  if (value.length === 0) return "";
  if (value[0] === 0) return value.subarray(1).toString("utf16le");
  if (value[0] === 1) return value.subarray(1).toString("utf8");
  return value.toString("utf8");
}

function decodeKey(key) {
  const userKey = key.length > 8 ? key.subarray(0, -8) : key;
  return decodeChromiumString(userKey);
}

function summarize(value) {
  try {
    const parsed = JSON.parse(value);
    return {
      validJson: true,
      count: Array.isArray(parsed) ? parsed.length : undefined,
      tickets: Array.isArray(parsed?.tickets) ? parsed.tickets.length : undefined,
      payments: Array.isArray(parsed?.payments) ? parsed.payments.length : undefined,
      ticketSeq: parsed?.ticketSeq,
    };
  } catch {
    return { validJson: false };
  }
}

const targetPattern = /orange-hotel-(?:kitchen-state|barista-state|kitchen-tickets|kitchen-payments|barista-orders|barista-payments)/;
const candidates = [];
for (const filename of (await readdir(sourceDirectory)).filter((name) => name.endsWith(".ldb")).sort()) {
  const file = await readFile(path.join(sourceDirectory, filename));
  for (const record of parseTable(file)) {
    const key = decodeKey(record.key);
    if (!targetPattern.test(key)) continue;
    const value = decodeChromiumString(record.value);
    candidates.push({ filename, key, bytes: record.value.length, ...summarize(value), value });
  }
}

if (outputFile) {
  await writeFile(outputFile, `${JSON.stringify(candidates, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(candidates.map(({ value, ...candidate }) => candidate), null, 2));
