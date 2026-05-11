const VERSION = 3;
const SIZE = VERSION * 4 + 17;
const DATA_CODEWORDS = 55;
const ERROR_CODEWORDS = 15;
const MASK_PATTERN = 0;

function appendBits(buffer, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) {
    buffer.push((value >>> i) & 1);
  }
}

function bitsToBytes(bits) {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) {
      value = (value << 1) | (bits[i + j] || 0);
    }
    bytes.push(value);
  }
  return bytes;
}

function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function reedSolomonDivisor(degree) {
  const result = Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;

  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }

  return result;
}

function reedSolomonRemainder(data, degree) {
  const divisor = reedSolomonDivisor(degree);
  const result = Array(degree).fill(0);

  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor);
    });
  });

  return result;
}

function encodeData(text) {
  const data = Array.from(new TextEncoder().encode(text));
  const bits = [];

  appendBits(bits, 0x4, 4);
  appendBits(bits, data.length, 8);
  data.forEach((byte) => appendBits(bits, byte, 8));

  const capacityBits = DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) appendBits(bits, 0, 1);

  const bytes = bitsToBytes(bits);
  for (let padByte = 0xec; bytes.length < DATA_CODEWORDS; padByte ^= 0xfd) {
    bytes.push(padByte);
  }

  return [...bytes, ...reedSolomonRemainder(bytes, ERROR_CODEWORDS)];
}

function createMatrix() {
  return {
    modules: Array.from({ length: SIZE }, () => Array(SIZE).fill(false)),
    reserved: Array.from({ length: SIZE }, () => Array(SIZE).fill(false)),
  };
}

function setFunction(matrix, x, y, dark) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  matrix.modules[y][x] = dark;
  matrix.reserved[y][x] = true;
}

function drawFinder(matrix, left, top) {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const distance = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      setFunction(matrix, left + x, top + y, distance !== 2 && distance !== 4);
    }
  }
}

function drawAlignment(matrix, centerX, centerY) {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const distance = Math.max(Math.abs(x), Math.abs(y));
      setFunction(matrix, centerX + x, centerY + y, distance !== 1);
    }
  }
}

function reserveFormat(matrix) {
  for (let i = 0; i <= 5; i += 1) {
    setFunction(matrix, 8, i, false);
    setFunction(matrix, i, 8, false);
  }
  setFunction(matrix, 8, 7, false);
  setFunction(matrix, 8, 8, false);
  setFunction(matrix, 7, 8, false);

  for (let i = 0; i < 8; i += 1) setFunction(matrix, SIZE - 1 - i, 8, false);
  for (let i = 0; i < 7; i += 1) setFunction(matrix, 8, SIZE - 7 + i, false);
}

function drawFunctionPatterns(matrix) {
  drawFinder(matrix, 0, 0);
  drawFinder(matrix, SIZE - 7, 0);
  drawFinder(matrix, 0, SIZE - 7);
  drawAlignment(matrix, 22, 22);

  for (let i = 8; i < SIZE - 8; i += 1) {
    const dark = i % 2 === 0;
    setFunction(matrix, i, 6, dark);
    setFunction(matrix, 6, i, dark);
  }

  setFunction(matrix, 8, VERSION * 4 + 9, true);
  reserveFormat(matrix);
}

function getFormatBits() {
  const errorCorrectionLevel = 1;
  const data = (errorCorrectionLevel << 3) | MASK_PATTERN;
  let bits = data << 10;

  for (let i = 14; i >= 10; i -= 1) {
    if (((bits >>> i) & 1) !== 0) bits ^= 0x537 << (i - 10);
  }

  return (((data << 10) | bits) ^ 0x5412) & 0x7fff;
}

function drawFormatBits(matrix) {
  const bits = getFormatBits();
  const bit = (index) => ((bits >>> index) & 1) !== 0;

  for (let i = 0; i <= 5; i += 1) setFunction(matrix, 8, i, bit(i));
  setFunction(matrix, 8, 7, bit(6));
  setFunction(matrix, 8, 8, bit(7));
  setFunction(matrix, 7, 8, bit(8));
  for (let i = 9; i < 15; i += 1) setFunction(matrix, 14 - i, 8, bit(i));

  for (let i = 0; i < 8; i += 1) setFunction(matrix, SIZE - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i += 1) setFunction(matrix, 8, SIZE - 15 + i, bit(i));
}

function shouldMask(x, y) {
  return (x + y) % 2 === 0;
}

function drawData(matrix, codewords) {
  const bits = codewords.flatMap((byte) => Array.from({ length: 8 }, (_, index) => (byte >>> (7 - index)) & 1));
  let bitIndex = 0;
  let upward = true;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;

    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const y = upward ? SIZE - 1 - vertical : vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (matrix.reserved[y][x]) continue;

        const dark = Boolean(bits[bitIndex]) !== shouldMask(x, y);
        matrix.modules[y][x] = dark;
        bitIndex += 1;
      }
    }

    upward = !upward;
  }
}

export function createQrMatrix(text) {
  const matrix = createMatrix();
  drawFunctionPatterns(matrix);
  drawData(matrix, encodeData(text));
  drawFormatBits(matrix);
  return matrix.modules;
}

export function createQrSvg(text, options = {}) {
  const modules = createQrMatrix(text);
  const quietZone = options.quietZone ?? 4;
  const size = modules.length + quietZone * 2;

  const rects = modules.flatMap((row, y) => (
    row.map((dark, x) => (dark ? `<rect x="${x + quietZone}" y="${y + quietZone}" width="1" height="1"/>` : '')).filter(Boolean)
  )).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="#ffffff"/><g fill="#020617">${rects}</g></svg>`;
}
