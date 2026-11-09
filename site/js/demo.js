const NOTES = [220, 261.63, 329.63, 392, 329.63, 261.63, 196, 246.94]
const STEP = 0.42

function makeImpulse(ctx, secs = 3, decay = 2.6) {
  const len = ctx.sampleRate * secs
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

const paint = el => el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min)) * 100}%`)

export function initDemo() {
  const playBtn = document.querySelector('#demoPlay')
  const speed = document.querySelector('#demoSpeed')
  const reverb = document.querySelector('#demoReverb')
  const speedOut = document.querySelector('#speedOut')
  const reverbOut = document.querySelector('#reverbOut')
  const chips = [...document.querySelectorAll('#demoPresets .chip')]

  const deck = document.querySelector('#deck3d')
  const rec = document.querySelector('#demoRec')
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches

  let ctx, bus, wet, dry, timer, next, step
  let playing = false
  let angle = 0
  let speedNow = 0
  let spinning = 0
  let lastSpin = 0

  function spin(now) {
    const dt = Math.min(0.05, (now - lastSpin) / 1000)
    lastSpin = now
    speedNow += ((playing ? 110 * rate() : 0) - speedNow) * Math.min(1, dt * 3)
    angle += speedNow * dt
    rec.style.transform = `rotate(${angle}deg)`
    spinning = playing || speedNow > 0.5 ? requestAnimationFrame(spin) : 0
  }

  function kick() {
    if (calm || spinning) return
    lastSpin = performance.now()
    spinning = requestAnimationFrame(spin)
  }

  function build() {
    ctx = new AudioContext()
    bus = ctx.createGain()
    dry = ctx.createGain()
    wet = ctx.createGain()
    const verb = ctx.createConvolver()
    verb.buffer = makeImpulse(ctx)
    bus.connect(dry)
    bus.connect(verb)
    verb.connect(wet)
    dry.connect(ctx.destination)
    wet.connect(ctx.destination)
    applyReverb()
  }

  const rate = () => speed.value / 100

  function applyReverb() {
    if (!ctx) return
    const v = reverb.value / 100
    wet.gain.setTargetAtTime(v * 0.9, ctx.currentTime, 0.05)
    dry.gain.setTargetAtTime(1 - v * 0.3, ctx.currentTime, 0.05)
  }

  function note(freq, when, len, gain) {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    env.gain.setValueAtTime(0.0001, when)
    env.gain.exponentialRampToValueAtTime(gain, when + 0.02)
    env.gain.exponentialRampToValueAtTime(0.0001, when + len)
    osc.connect(env)
    env.connect(bus)
    osc.start(when)
    osc.stop(when + len + 0.05)
  }

  function schedule() {
    while (next < ctx.currentTime + 0.3) {
      const r = rate()
      const freq = NOTES[step % NOTES.length] * r
      note(freq, next, (STEP * 1.8) / r, 0.22)
      if (step % 4 === 0) note(freq / 2, next, (STEP * 3) / r, 0.16)
      next += STEP / r
      step++
    }
    timer = setTimeout(schedule, 80)
  }

  async function start() {
    if (!ctx) build()
    await ctx.resume()
    next = ctx.currentTime + 0.05
    step = 0
    playing = true
    schedule()
    sync()
    kick()
  }

  function stop() {
    clearTimeout(timer)
    playing = false
    sync()
  }

  function sync() {
    playBtn.classList.toggle('live', playing)
    playBtn.setAttribute('aria-label', playing ? 'Pausar exemplo' : 'Tocar exemplo')
  }

  function render() {
    speedOut.textContent = `${rate().toFixed(2)}x`
    reverbOut.textContent = `${reverb.value}%`
    deck.style.setProperty('--v', reverb.value / 100)
    paint(speed)
    paint(reverb)
    chips.forEach(c => c.classList.toggle('on', +c.dataset.rate === +speed.value && +c.dataset.verb === +reverb.value))
    applyReverb()
  }

  playBtn.addEventListener('click', () => (playing ? stop() : start()))
  speed.addEventListener('input', render)
  reverb.addEventListener('input', render)
  chips.forEach(chip => chip.addEventListener('click', () => {
    speed.value = chip.dataset.rate
    reverb.value = chip.dataset.verb
    render()
  }))
  render()
}
