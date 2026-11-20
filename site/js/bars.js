const canvas = document.querySelector('#bars')
const g = canvas.getContext('2d')
let analyser = null
let data = null
let levels = new Float32Array(0)
let tint = '167 86 231'

export function setAnalyser(node) {
  analyser = node
  data = node ? new Uint8Array(node.frequencyBinCount) : null
}

function readTint() {
  tint = getComputedStyle(document.documentElement).getPropertyValue('--accent-hi-rgb').trim() || tint
}

function size() {
  const dpr = devicePixelRatio || 1
  canvas.width = canvas.clientWidth * dpr
  canvas.height = canvas.clientHeight * dpr
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function draw(now) {
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const count = Math.min(140, Math.max(24, Math.floor(w / 13)))
  if (levels.length !== count) levels = new Float32Array(count)
  if (analyser) analyser.getByteFrequencyData(data)
  const grad = g.createLinearGradient(0, h, 0, h * 0.3)
  grad.addColorStop(0, `rgb(${tint} / 0.17)`)
  grad.addColorStop(1, `rgb(${tint} / 0)`)
  g.clearRect(0, 0, w, h)
  g.fillStyle = grad
  const step = w / count
  const bw = step * 0.56
  const mid = (count - 1) / 2
  for (let i = 0; i < count; i++) {
    const m = Math.abs(i - mid) / mid
    const idle = 0.05 + 0.035 * Math.sin(now / 900 + i * 0.32) + 0.02 * Math.sin(now / 430 - i * 0.7)
    const live = data ? (data[2 + Math.floor(m * 70)] / 255) * (1 + m * 0.9) : 0
    levels[i] += (Math.max(idle, live) - levels[i]) * 0.28
    const bh = 6 + levels[i] * h * 0.6
    const x = i * step + (step - bw) / 2
    g.beginPath()
    g.roundRect ? g.roundRect(x, h - bh, bw, bh, bw / 2) : g.rect(x, h - bh, bw, bh)
    g.fill()
  }
  requestAnimationFrame(draw)
}

export function startBars() {
  readTint()
  size()
  addEventListener('resize', size)
  requestAnimationFrame(draw)
}
