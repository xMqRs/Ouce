import { engine } from './engine.js'
import { $, $$ } from './lib/dom.js'
import { audio } from './state.js'
import { theme } from './theme.js'

const ROWS = 5
const SNAPSHOT_MS = 110

const barsCv = $('#bars')
const bc = barsCv.getContext('2d')
const spinners = $$('.spin')
const tilt = $('#tilt')
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
const pointer = { x: 0.5, y: 0.5 }

let levels = new Float32Array(0)
let history = []
let lastSnapshot = 0
let angle = 0
let bass = 0
let lastTick = performance.now()

function sizeBars() {
  const dpr = devicePixelRatio || 1
  barsCv.width = barsCv.clientWidth * dpr
  barsCv.height = barsCv.clientHeight * dpr
  bc.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function updateLevels(now, playing, count) {
  const mid = (count - 1) / 2
  for (let i = 0; i < count; i++) {
    const m = Math.abs(i - mid) / mid
    let v
    if (engine.nodes && playing) v = (engine.nodes.freq[2 + Math.floor(m * 70)] / 255) * (1 + m * 0.9)
    else v = 0.05 + 0.035 * Math.sin(now / 900 + i * 0.32) + 0.02 * Math.sin(now / 430 - i * 0.7)
    levels[i] += (v - levels[i]) * 0.28
  }
  if (now - lastSnapshot > SNAPSHOT_MS) {
    history.unshift(Float32Array.from(levels))
    history.length = Math.min(history.length, ROWS - 1)
    lastSnapshot = now
  }
}

function drawBars(now, playing) {
  const w = barsCv.clientWidth
  const h = barsCv.clientHeight
  const count = Math.min(140, Math.max(24, Math.floor(w / 13)))
  if (levels.length !== count) {
    levels = new Float32Array(count)
    history = []
  }
  updateLevels(now, playing, count)

  const [r, g, b] = theme.hiRgb
  const mid = (count - 1) / 2
  const rows = [levels, ...history]
  bc.clearRect(0, 0, w, h)

  for (let k = rows.length - 1; k >= 0; k--) {
    const depth = k / ROWS
    const scale = 1 - depth * 0.42
    const step = (w / count) * scale
    const bw = step * 0.56
    const baseY = h - k * h * 0.04
    const shift = (pointer.x - 0.5) * k * 12
    const grad = bc.createLinearGradient(0, baseY, 0, baseY - h * 0.5)
    grad.addColorStop(0, `rgb(${r} ${g} ${b} / ${(0.17 * (1 - depth * 0.85)).toFixed(3)})`)
    grad.addColorStop(1, `rgb(${r} ${g} ${b} / 0)`)
    bc.fillStyle = grad
    for (let i = 0; i < count; i++) {
      const bh = (6 + rows[k][i] * h * 0.5) * scale
      const x = w / 2 + (i - mid) * step - bw / 2 + shift
      bc.beginPath()
      bc.roundRect ? bc.roundRect(x, baseY - bh, bw, bh, bw / 2) : bc.rect(x, baseY - bh, bw, bh)
      bc.fill()
    }
  }

  const glow = bc.createLinearGradient(0, h, 0, h * 0.68)
  glow.addColorStop(0, `rgb(${r} ${g} ${b} / ${(0.07 + bass * 0.1).toFixed(3)})`)
  glow.addColorStop(1, `rgb(${r} ${g} ${b} / 0)`)
  bc.fillStyle = glow
  bc.fillRect(0, h * 0.68, w, h * 0.32)
}

function sway(now) {
  if (calm) return
  const t = now / 1000
  tilt.style.transform = `translateZ(${(bass * 14).toFixed(1)}px) rotateY(${(-16 + Math.sin(t * 0.7) * 4).toFixed(2)}deg) rotateX(${(3 + Math.sin(t * 0.5) * 1.5).toFixed(2)}deg)`
}

function frame(now) {
  const dt = (now - lastTick) / 1000
  lastTick = now
  const playing = !audio.paused
  if (playing) angle += dt * 70 * audio.playbackRate
  let target = 0
  if (engine.nodes && playing) {
    engine.nodes.an.getByteFrequencyData(engine.nodes.freq)
    target = engine.nodes.freq.slice(0, 6).reduce((a, v) => a + v, 0) / 6 / 255
  }
  bass += (target - bass) * 0.15
  spinners.forEach(el => { el.style.transform = `rotate(${angle}deg)` })
  drawBars(now, playing)
  sway(now)
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
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return
    pointer.x = e.clientX / innerWidth
    pointer.y = e.clientY / innerHeight
  })
  bindTilt()
  requestAnimationFrame(frame)
}
