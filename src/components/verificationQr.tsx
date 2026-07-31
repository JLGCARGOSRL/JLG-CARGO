type VerificationQrProps = {
  value: string
  size?: number
  className?: string
}

const QR_VERSION = 6
const QR_SIZE = QR_VERSION * 4 + 17
const DATA_CODEWORDS = 136
const BLOCK_DATA_CODEWORDS = 68
const ECC_CODEWORDS = 18

function multiply(x: number, y: number) {
  let result = 0
  for (let i = 7; i >= 0; i -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d)
    result ^= ((y >>> i) & 1) * x
  }
  return result
}

function reedSolomonDivisor(degree: number) {
  const result = new Uint8Array(degree)
  result[degree - 1] = 1
  let root = 1

  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = multiply(result[j], root)
      if (j + 1 < degree) result[j] ^= result[j + 1]
    }
    root = multiply(root, 0x02)
  }
  return result
}

function reedSolomonRemainder(data: Uint8Array, divisor: Uint8Array) {
  const result = new Uint8Array(divisor.length)
  for (const byte of data) {
    const factor = byte ^ result[0]
    result.copyWithin(0, 1)
    result[result.length - 1] = 0
    for (let i = 0; i < divisor.length; i += 1) {
      result[i] ^= multiply(divisor[i], factor)
    }
  }
  return result
}

function appendBits(target: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i -= 1) target.push((value >>> i) & 1)
}

function createCodewords(value: string) {
  const bytes = new TextEncoder().encode(value)
  if (bytes.length > 130) throw new Error('La dirección de verificación es demasiado larga para el QR.')

  const bits: number[] = []
  appendBits(bits, 0x4, 4)
  appendBits(bits, bytes.length, 8)
  for (const byte of bytes) appendBits(bits, byte, 8)

  const capacity = DATA_CODEWORDS * 8
  appendBits(bits, 0, Math.min(4, capacity - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)

  const data = new Uint8Array(DATA_CODEWORDS)
  let dataLength = 0
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j]
    data[dataLength] = byte
    dataLength += 1
  }
  for (let pad = 0; dataLength < DATA_CODEWORDS; dataLength += 1, pad += 1) {
    data[dataLength] = pad % 2 === 0 ? 0xec : 0x11
  }

  const divisor = reedSolomonDivisor(ECC_CODEWORDS)
  const blocks = [data.slice(0, BLOCK_DATA_CODEWORDS), data.slice(BLOCK_DATA_CODEWORDS)]
  const eccBlocks = blocks.map((block) => reedSolomonRemainder(block, divisor))
  const result = new Uint8Array(172)
  let index = 0

  for (let i = 0; i < BLOCK_DATA_CODEWORDS; i += 1) {
    for (const block of blocks) result[index++] = block[i]
  }
  for (let i = 0; i < ECC_CODEWORDS; i += 1) {
    for (const block of eccBlocks) result[index++] = block[i]
  }
  return result
}

function createMatrix(value: string) {
  const modules = Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false) as boolean[])
  const isFunction = Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false) as boolean[])

  function setFunction(x: number, y: number, dark: boolean) {
    if (x < 0 || x >= QR_SIZE || y < 0 || y >= QR_SIZE) return
    modules[y][x] = dark
    isFunction[y][x] = true
  }

  function drawFinder(centerX: number, centerY: number) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy))
        setFunction(centerX + dx, centerY + dy, distance !== 2 && distance !== 4)
      }
    }
  }

  function drawAlignment(centerX: number, centerY: number) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        setFunction(
          centerX + dx,
          centerY + dy,
          Math.max(Math.abs(dx), Math.abs(dy)) !== 1
        )
      }
    }
  }

  function drawFormatBits(mask: number) {
    const data = (1 << 3) | mask
    let remainder = data
    for (let i = 0; i < 10; i += 1) {
      remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537)
    }
    const bits = ((data << 10) | remainder) ^ 0x5412
    const bit = (index: number) => ((bits >>> index) & 1) !== 0

    for (let i = 0; i <= 5; i += 1) setFunction(8, i, bit(i))
    setFunction(8, 7, bit(6))
    setFunction(8, 8, bit(7))
    setFunction(7, 8, bit(8))
    for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i += 1) setFunction(QR_SIZE - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i += 1) setFunction(8, QR_SIZE - 15 + i, bit(i))
    setFunction(8, QR_SIZE - 8, true)
  }

  drawFinder(3, 3)
  drawFinder(QR_SIZE - 4, 3)
  drawFinder(3, QR_SIZE - 4)

  for (let i = 0; i < QR_SIZE; i += 1) {
    if (!isFunction[6][i]) setFunction(i, 6, i % 2 === 0)
    if (!isFunction[i][6]) setFunction(6, i, i % 2 === 0)
  }
  drawAlignment(34, 34)
  drawFormatBits(0)

  const codewords = createCodewords(value)
  let bitIndex = 0
  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vertical = 0; vertical < QR_SIZE; vertical += 1) {
      const upward = ((right + 1) & 2) === 0
      const y = upward ? QR_SIZE - 1 - vertical : vertical
      for (let column = 0; column < 2; column += 1) {
        const x = right - column
        if (isFunction[y][x]) continue
        const dark = bitIndex < codewords.length * 8
          ? ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0
          : false
        modules[y][x] = dark !== ((x + y) % 2 === 0)
        bitIndex += 1
      }
    }
  }
  return modules
}

export default function VerificationQr({ value, size = 76, className }: VerificationQrProps) {
  const matrix = createMatrix(value)
  const quietZone = 4
  const viewSize = QR_SIZE + quietZone * 2

  return (
    <svg
      role="img"
      aria-label="Código QR para verificar el despacho"
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width={viewSize} height={viewSize} fill="white" />
      {matrix.flatMap((row, y) =>
        row.map((dark, x) =>
          dark ? <rect key={`${x}-${y}`} x={x + quietZone} y={y + quietZone} width="1" height="1" fill="#0f172a" /> : null
        )
      )}
    </svg>
  )
}
