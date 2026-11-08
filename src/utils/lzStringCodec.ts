/**
 * lzStringCodec.ts
 * Codec LZString pur compatible à 100 % avec `lz-string` (compressToBase64 / decompressFromBase64)
 * utilisé par `o-girador-sequenciador` pour sérialiser/désérialiser les morceaux de la collection `presets` (< 130 lignes).
 */
const KEY_STR_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const BASE_REVERSE_DIC: Record<string, number> = {};
for (let i = 0; i < KEY_STR_BASE64.length; i++) BASE_REVERSE_DIC[KEY_STR_BASE64.charAt(i)] = i;

function _compress(uncompressed: string, bitsPerChar: number, getCharFromInt: (a: number) => string): string {
  if (uncompressed == null) return '';
  let ii: number;
  const context_dictionary: Record<string, number> = {}, context_dictionaryToCreate: Record<string, boolean> = {};
  let context_c = '', context_wc = '', context_w = '', context_enlargeIn = 2, context_dictSize = 3, context_numBits = 2;
  const context_data: string[] = [];
  let context_data_val = 0, context_data_position = 0;

  const writeBit = (bit: number) => {
    context_data_val = (context_data_val << 1) | bit;
    if (context_data_position === bitsPerChar - 1) {
      context_data_position = 0; context_data.push(getCharFromInt(context_data_val)); context_data_val = 0;
    } else context_data_position++;
  };
  const writeBits = (numBits: number, val: number) => {
    let v = val;
    for (let k = 0; k < numBits; k++) { writeBit(v & 1); v >>= 1; }
  };
  const decrementEnlarge = () => {
    context_enlargeIn--;
    if (context_enlargeIn === 0) { context_enlargeIn = Math.pow(2, context_numBits); context_numBits++; }
  };
  const produceW = () => {
    if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
      if (context_w.charCodeAt(0) < 256) {
        writeBits(context_numBits, 0); writeBits(8, context_w.charCodeAt(0));
      } else {
        writeBits(context_numBits, 1); writeBits(16, context_w.charCodeAt(0));
      }
      decrementEnlarge(); delete context_dictionaryToCreate[context_w];
    } else writeBits(context_numBits, context_dictionary[context_w]);
    decrementEnlarge();
  };

  for (ii = 0; ii < uncompressed.length; ii += 1) {
    context_c = uncompressed.charAt(ii);
    if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
      context_dictionary[context_c] = context_dictSize++; context_dictionaryToCreate[context_c] = true;
    }
    context_wc = context_w + context_c;
    if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) context_w = context_wc;
    else { produceW(); context_dictionary[context_wc] = context_dictSize++; context_w = String(context_c); }
  }
  if (context_w !== '') produceW();
  writeBits(context_numBits, 2);
  while (true) {
    context_data_val <<= 1;
    if (context_data_position === bitsPerChar - 1) { context_data.push(getCharFromInt(context_data_val)); break; }
    else context_data_position++;
  }
  return context_data.join('');
}

function _decompress(length: number, resetValue: number, getNextValue: (index: number) => number): string | null {
  const dictionary: string[] = [];
  let enlargeIn = 4, dictSize = 4, numBits = 3, entry = '', c: string | number;
  const result: string[] = [];
  const data = { val: getNextValue(0), position: resetValue, index: 1 };

  const readBits = (nBits: number): number => {
    let bits = 0, maxpower = Math.pow(2, nBits), power = 1;
    while (power !== maxpower) {
      const resb = data.val & data.position;
      data.position >>= 1;
      if (data.position === 0) { data.position = resetValue; data.val = getNextValue(data.index++); }
      bits |= (resb > 0 ? 1 : 0) * power; power <<= 1;
    }
    return bits;
  };

  for (let i = 0; i < 3; i += 1) dictionary[i] = String(i);
  const next = readBits(2);
  switch (next) {
    case 0: c = String.fromCharCode(readBits(8)); break;
    case 1: c = String.fromCharCode(readBits(16)); break;
    case 2: return '';
    default: return null;
  }
  dictionary[3] = c; let w = c; result.push(c);
  while (true) {
    if (data.index > length) return '';
    let cc: string | number = readBits(numBits);
    switch (cc) {
      case 0: dictionary[dictSize++] = String.fromCharCode(readBits(8)); cc = dictSize - 1; enlargeIn--; break;
      case 1: dictionary[dictSize++] = String.fromCharCode(readBits(16)); cc = dictSize - 1; enlargeIn--; break;
      case 2: return result.join('');
    }
    if (enlargeIn === 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
    if (dictionary[cc as number]) entry = dictionary[cc as number];
    else if (cc === dictSize) entry = w + w.charAt(0);
    else return null;
    result.push(entry); dictionary[dictSize++] = w + entry.charAt(0); enlargeIn--; w = entry;
    if (enlargeIn === 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
  }
}

export function compressToBase64(input: string): string {
  if (input == null) return '';
  const res = _compress(input, 6, (a) => KEY_STR_BASE64.charAt(a));
  switch (res.length % 4) {
    default: case 0: return res;
    case 1: return `${res}===`;
    case 2: return `${res}==`;
    case 3: return `${res}=`;
  }
}

export function decompressFromBase64(input: string): string | null {
  if (input == null) return '';
  if (input === '') return null;
  return _decompress(input.length, 32, (index) => BASE_REVERSE_DIC[input.charAt(index)]);
}

export function parseSequenciadorPresetData(rawData: unknown): Record<string, any> | null {
  if (!rawData) return null;
  if (typeof rawData === 'object') return JSON.parse(JSON.stringify(rawData));
  if (typeof rawData === 'string') {
    const trimmed = rawData.trim();
    if (trimmed.startsWith('{')) { try { return JSON.parse(trimmed); } catch { /* ignore */ } }
    const decomp = decompressFromBase64(trimmed);
    if (decomp) { try { return JSON.parse(decomp); } catch { /* ignore */ } }
  }
  return null;
}

export function encodeSequenciadorPresetData(presetObj: Record<string, any>): string {
  return compressToBase64(JSON.stringify(presetObj));
}
