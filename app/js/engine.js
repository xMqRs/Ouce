import { rateOf } from './lib/fx.js'
import { perf } from './perf.js'
import { audio, state } from './state.js'

export const engine = { ctx: null, nodes: null }

export function makeImpulse(c, secs = 3, decay = 2.6) {
  const len = c.sampleRate * secs
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

// iPhone: sem isto o áudio da Web Audio é calado pela chave de silêncio e some ao bloquear a tela
function initSession() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback' } catch {}
}

function makeContext() {
  // 'playback' usa buffers maiores: bem menos estalos em celular fraco
  try { return new AudioContext({ latencyHint: 'playback' }) } catch { return new AudioContext() }
}

// o iOS "interrompe" o contexto (ligação, tela bloqueada); volta a tocar quando der
function wake() {
  const c = engine.ctx
  if (c && c.state !== 'running' && !audio.paused) c.resume().catch(() => {})
}

function buildGraph() {
  if (engine.ctx) return
  initSession()
  const ctx = makeContext()
  const src = ctx.createMediaElementSource(audio)
  const low = ctx.createBiquadFilter()
  low.type = 'lowshelf'
  low.frequency.value = 140
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const verb = ctx.createConvolver()
  const an = ctx.createAnalyser()
  an.fftSize = 256
  an.smoothingTimeConstant = 0.78
  verb.buffer = makeImpulse(ctx, perf.lite ? 1.6 : 3)
  src.connect(low)
  low.connect(dry)
  verb.connect(wet)
  dry.connect(an)
  wet.connect(an)
  an.connect(ctx.destination)
  engine.ctx = ctx
  engine.nodes = { low, dry, wet, verb, an, verbOn: false, freq: new Uint8Array(an.frequencyBinCount) }
  ctx.addEventListener('statechange', wake)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake() })
  audio.addEventListener('play', wake)
  applyFx()
}

// o reverb só entra no grafo quando há reverb: sem ele, a convolução não gasta processador
let verbOff = 0
function routeReverb(want) {
  const n = engine.nodes
  clearTimeout(verbOff)
  if (want) {
    if (!n.verbOn) { n.low.connect(n.verb); n.verbOn = true }
    return
  }
  verbOff = setTimeout(() => {
    if (n.verbOn && state.fx.reverb <= 0.005) { n.low.disconnect(n.verb); n.verbOn = false }
  }, 450)
}

document.addEventListener('ouce:perf', e => {
  if (engine.ctx && engine.nodes) engine.nodes.verb.buffer = makeImpulse(engine.ctx, e.detail.lite ? 1.6 : 3)
})

let primed = false
const SILENT = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

// Celular só deixa o áudio tocar depois de um toque na tela. Fazemos isso no primeiro toque,
// para a música tocar sozinha mesmo depois de baixar o arquivo ou ao passar para a próxima.
export function primeAudio() {
  if (primed) return
  primed = true
  try { buildGraph(); engine.ctx.resume().catch(() => {}) } catch {}
  if (audio.src) return
  audio.src = SILENT
  audio.muted = true
  audio.play().then(
    () => { if (audio.src === SILENT) { audio.pause(); audio.removeAttribute('src'); audio.load() } audio.muted = false },
    () => { audio.muted = false }
  )
}

export function applyFx() {
  const f = state.fx
  const rate = rateOf(f)
  audio.defaultPlaybackRate = rate
  audio.playbackRate = rate
  if (!engine.nodes) return
  const { low, dry, wet } = engine.nodes
  const t = engine.ctx.currentTime
  routeReverb(f.reverb > 0.005)
  low.gain.setTargetAtTime(f.bass * 15, t, 0.05)
  wet.gain.setTargetAtTime(f.reverb * 0.6, t, 0.05)
  dry.gain.setTargetAtTime(1 - f.reverb * 0.25, t, 0.05)
}

export async function resumeAudio() {
  buildGraph()
  await engine.ctx.resume()
}
