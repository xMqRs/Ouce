import { rateOf } from './lib/fx.js'
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

function buildGraph() {
  if (engine.ctx) return
  const ctx = new AudioContext()
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
  verb.buffer = makeImpulse(ctx)
  src.connect(low)
  low.connect(dry)
  low.connect(verb)
  verb.connect(wet)
  dry.connect(an)
  wet.connect(an)
  an.connect(ctx.destination)
  engine.ctx = ctx
  engine.nodes = { low, dry, wet, an, freq: new Uint8Array(an.frequencyBinCount) }
  applyFx()
}

export function applyFx() {
  const f = state.fx
  const rate = rateOf(f)
  audio.defaultPlaybackRate = rate
  audio.playbackRate = rate
  if (!engine.nodes) return
  const { low, dry, wet } = engine.nodes
  const t = engine.ctx.currentTime
  low.gain.setTargetAtTime(f.bass * 15, t, 0.05)
  wet.gain.setTargetAtTime(f.reverb * 0.6, t, 0.05)
  dry.gain.setTargetAtTime(1 - f.reverb * 0.25, t, 0.05)
}

export async function resumeAudio() {
  buildGraph()
  await engine.ctx.resume()
}
