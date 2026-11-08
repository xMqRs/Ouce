import { decodeBlob, toWav } from './lib/audio.js'
import { $ } from './lib/dom.js'
import { rateOf } from './lib/fx.js'
import { tagOf } from './lib/track.js'
import { makeImpulse } from './engine.js'
import { mine, state } from './state.js'
import { toast } from './ui.js'

const REVERB_TAIL = 3

async function render(blob, fx) {
  const buffer = await decodeBlob(blob)
  const sampleRate = buffer.sampleRate

  const rate = rateOf(fx)
  const seconds = buffer.duration / rate + (fx.reverb > 0 ? REVERB_TAIL : 0.1)
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate)

  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate

  const low = ctx.createBiquadFilter()
  low.type = 'lowshelf'
  low.frequency.value = 140
  low.gain.value = fx.bass * 15

  const dry = ctx.createGain()
  dry.gain.value = 1 - fx.reverb * 0.25
  const wet = ctx.createGain()
  wet.gain.value = fx.reverb * 0.6
  const verb = ctx.createConvolver()
  verb.buffer = makeImpulse(ctx)

  src.connect(low)
  low.connect(dry)
  low.connect(verb)
  verb.connect(wet)
  dry.connect(ctx.destination)
  wet.connect(ctx.destination)
  src.start()
  return ctx.startRendering()
}

function save(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function downloadEdited() {
  const n = state.now
  if (!n.blob) return toast('Abra uma música primeiro.')
  if (n.id !== null && !mine(n.id)) return toast('Só dá para baixar músicas suas ou arquivos que você abriu.')

  const btn = $('#dlBtn')
  btn.disabled = true
  btn.classList.add('busy')
  toast('Preparando o arquivo…')
  try {
    const wav = toWav(await render(n.blob, state.fx))
    const tag = tagOf(state.fx)
    const name = `${n.title}${tag ? ` (${tag})` : ''}.wav`.replace(/[\\/:*?"<>|]+/g, '')
    save(wav, name)
    toast('Download pronto')
  } catch (err) {
    console.error(err)
    toast(err.message === 'faixa longa demais' ? 'Essa faixa passa de 15 minutos, é longa demais.' : 'Não consegui gerar o arquivo.')
  } finally {
    btn.disabled = false
    btn.classList.remove('busy')
  }
}
