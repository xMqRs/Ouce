export const MAX_SECONDS = 15 * 60
const FADE_SECONDS = 0.008

export async function decodeBlob(blob) {
  const ctx = new AudioContext()
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
    if (buffer.duration > MAX_SECONDS) throw new Error('faixa longa demais')
    return buffer
  } finally {
    ctx.close()
  }
}

export function toWav(buffer) {
  const channels = buffer.numberOfChannels
  const length = buffer.length
  const bytes = length * channels * 2
  const view = new DataView(new ArrayBuffer(44 + bytes))
  const text = (offset, str) => [...str].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))

  text(0, 'RIFF')
  view.setUint32(4, 36 + bytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, bytes, true)

  const data = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i))
  let peak = 0
  for (const ch of data) for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(ch[i]))
  const gain = peak > 0.98 ? 0.98 / peak : 1

  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const v = data[c][i] * gain
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([view], { type: 'audio/wav' })
}

export function sliceBuffer(buffer, ranges) {
  const rate = buffer.sampleRate
  const fade = Math.round(FADE_SECONDS * rate)
  const spans = ranges
    .map(([a, b]) => [Math.max(0, Math.round(a * rate)), Math.min(buffer.length, Math.round(b * rate))])
    .filter(([a, b]) => b > a)
  const length = spans.reduce((total, [a, b]) => total + (b - a), 0)
  if (!length) return null

  const out = new AudioBuffer({ length, numberOfChannels: buffer.numberOfChannels, sampleRate: rate })
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c)
    const dst = out.getChannelData(c)
    let at = 0
    for (const [a, b] of spans) {
      dst.set(src.subarray(a, b), at)
      const n = Math.min(fade, (b - a) >> 1)
      if (a > 0) for (let i = 0; i < n; i++) dst[at + i] *= i / n
      if (b < buffer.length) for (let i = 0; i < n; i++) dst[at + (b - a) - 1 - i] *= i / n
      at += b - a
    }
  }
  return out
}

export function peaksOf(buffer, columns) {
  const total = buffer.length
  const step = Math.max(1, Math.floor(total / columns))
  const stride = Math.max(1, Math.floor(step / 64))
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i))
  const peaks = new Float32Array(columns)
  let top = 0
  for (let col = 0; col < columns; col++) {
    const from = col * step
    const to = Math.min(total, from + step)
    let peak = 0
    for (let i = from; i < to; i += stride) {
      for (const data of channels) {
        const v = Math.abs(data[i])
        if (v > peak) peak = v
      }
    }
    peaks[col] = peak
    if (peak > top) top = peak
  }
  if (top > 0) for (let i = 0; i < columns; i++) peaks[i] /= top
  return peaks
}
