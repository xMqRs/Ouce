import { engine } from './engine.js'
import { $ } from './lib/dom.js'
import { audio } from './state.js'
import { theme } from './theme.js'

const barsCv = $('#bars')
const bc = barsCv.getContext('2d')
const vinyl = $('#vinyl')
let levels = new Float32Array(0)
let angle = 0
let lastTick = performance.now()

function sizeBars() {
  const dpr = devicePixelRatio || 1
  barsCv.width = barsCv.clientWidth * dpr
  barsCv.height = barsCv.clientHeight * dpr
  bc.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function drawBars(now, playing) {
  const w = barsCv.clientWidth
  const h = barsCv.clientHeight
  const count = Math.min(140, Math.max(24, Math.floor(w / 13)))
  if (levels.length !== count) levels = new Float32Array(count)
  const step = w / count
  const bw = step * 0.56
  const [r, g, b] = theme.hiRgb
  const grad = bc.createLinearGradient(0, h, 0, h * 0.25)
  grad.addColorStop(0, `rgb(${r} ${g} ${b} / 0.14)`)
  grad.addColorStop(1, `rgb(${r} ${g} ${b} / 0)`)
  bc.clearRect(0, 0, w, h)
  bc.fillStyle = grad
  const mid = (count - 1) / 2
  for (let i = 0; i < count; i++) {
    const m = Math.abs(i - mid) / mid
    let v
    if (engine.nodes && playing) v = (engine.nodes.freq[2 + Math.floor(m * 70)] / 255) * (1 + m * 0.9)
    else v = 0.05 + 0.035 * Math.sin(now / 900 + i * 0.32) + 0.02 * Math.sin(now / 430 - i * 0.7)
    levels[i] += (v - levels[i]) * 0.28
    const bh = 6 + levels[i] * h * 0.6
    const x = i * step + (step - bw) / 2
    bc.beginPath()
    bc.roundRect ? bc.roundRect(x, h - bh, bw, bh, bw / 2) : bc.rect(x, h - bh, bw, bh)
    bc.fill()
  }
}

function frame(now) {
  const dt = (now - lastTick) / 1000
  lastTick = now
  const playing = !audio.paused
  if (playing) angle += dt * 70 * audio.playbackRate
  if (engine.nodes && playing) engine.nodes.an.getByteFrequencyData(engine.nodes.freq)
  vinyl.style.transform = `rotate(${angle}deg)`
  drawBars(now, playing)
  requestAnimationFrame(frame)
}

function bindTilt() {
  const card = $('#card')
  let box
  card.addEventListener('pointerenter', e => {
    if (e.pointerType === 'mouse') box = card.getBoundingClientRect()
  })
  card.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !box) return
    const x = (e.clientX - box.left) / box.width - 0.5
    const y = (e.clientY - box.top) / box.height - 0.5
    card.style.transform = `perspective(1100px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`
  })
  card.addEventListener('pointerleave', () => { card.style.transform = '' })
}

export function startVisuals() {
  sizeBars()
  addEventListener('resize', sizeBars)
  bindTilt()
  requestAnimationFrame(frame)
}
