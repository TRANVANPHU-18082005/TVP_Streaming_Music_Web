// Byte-mode QR, error correction L, versions 2–6.
// Enough for a room URL. Finder patterns sit in the three corners.

const ECC_CODEWORDS = [0, 7, 10, 15, 20, 26, 36];
const DATA_CODEWORDS = [0, 16, 28, 44, 64, 86, 108];
const ALIGN = [0, 0, 6, 22, 34, 46, 58];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = value;
    GF_LOG[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a: number, b: number) => (a && b ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0);

const generator = (degree: number) => {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= gfMul(poly[j], GF_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
};

const reedSolomon = (data: number[], degree: number) => {
  const gen = generator(degree);
  const result = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < degree; i += 1) result[i] ^= gfMul(gen[i + 1] ?? 0, factor);
  }
  return result;
};

const versionFor = (length: number) => {
  for (let version = 2; version <= 6; version += 1) {
    if (length <= DATA_CODEWORDS[version] - 2) return version;
  }
  return 6;
};

export const qrMatrix = (text: string): boolean[][] => {
  const bytes = Array.from(new TextEncoder().encode(text)).slice(0, 100);
  const version = versionFor(bytes.length);
  const size = 17 + version * 4;
  const dataLength = DATA_CODEWORDS[version];
  const bits: number[] = [];
  const push = (value: number, width: number) => {
    for (let i = width - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, dataLength * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b += 1) byte = (byte << 1) | (bits[i + b] ?? 0);
    data.push(byte);
  }
  const pads = [0xec, 0x11];
  let pad = 0;
  while (data.length < dataLength) {
    data.push(pads[pad % 2]);
    pad += 1;
  }
  const ecc = reedSolomon(data.slice(0, dataLength), ECC_CODEWORDS[version]);
  const stream = [...data.slice(0, dataLength), ...ecc];

  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  const set = (x: number, y: number, dark: boolean, hold = false) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
    if (hold) reserved[y][x] = true;
  };
  const finder = (ox: number, oy: number) => {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const edge = x < 0 || y < 0 || x > 6 || y > 6;
        const ring = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        set(ox + x, oy + y, !edge && (ring || core), true);
      }
    }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  for (let i = 8; i < size - 8; i += 1) {
    const dark = i % 2 === 0;
    set(i, 6, dark, true);
    set(6, i, dark, true);
  }
  const align = ALIGN[version];
  if (align) {
    for (let y = -2; y <= 2; y += 1) {
      for (let x = -2; x <= 2; x += 1) {
        const dark = Math.max(Math.abs(x), Math.abs(y)) !== 1;
        set(align + x, align + y, dark, true);
      }
    }
  }
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  const formatCoords = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8],
    [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  formatCoords.forEach(([x, y], index) => set(x, y, formatBits[index] === 1, true));
  for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, formatBits[i] === 1, true);
  for (let i = 0; i < 7; i += 1) set(8, size - 7 + i, formatBits[8 + i] === 1, true);
  set(8, size - 8, true, true);

  let bitIndex = 0;
  const readBit = () => {
    const byte = stream[bitIndex >> 3] ?? 0;
    const bit = (byte >> (7 - (bitIndex & 7))) & 1;
    bitIndex += 1;
    return bit === 1;
  };
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let rowStep = 0; rowStep < size; rowStep += 1) {
      const y = upward ? size - 1 - rowStep : rowStep;
      for (let dx = 0; dx < 2; dx += 1) {
        const x = col - dx;
        if (reserved[y][x]) continue;
        const dark = readBit();
        const mask = (x + y) % 2 === 0;
        modules[y][x] = mask ? !dark : dark;
      }
    }
    upward = !upward;
  }
  return modules;
};
