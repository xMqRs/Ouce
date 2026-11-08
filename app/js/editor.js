import { decodeBlob, peaksOf, sliceBuffer, toWav } from './lib/audio.js'
import { $ } from './lib/dom.js'
import { audio, mine, state } from './state.js'
import { addFiles } from './tracks.js'
import { hideToast, toast } from './ui.js'

const BAR = 2
const GAP = 1
const MIN_SPAN = 0.05

const edit = { buffer: null, peaks: new Float32Array(0), start: 0, end: 0, mode: 'keep' }
let preview = null

const fmtT = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`

function parseT(text) {
  const parts = String(text).trim().replace(',', '.').split(':')
  if (parts.length > 2 || parts.some(p => p === '' || isNaN(p))) return null
  return parts.reduce((total, p) => total * 60 + parseFloat(p), 0)
}

const resultLength = () => (edit.mode === 'keep' ? edit.end - edit.start : edit.buffer.duration - (edit.end - edit.start))

function draw() {
  const cv = $('#waveCv')
  const dpr = devicePixelRatio || 1
  const w = cv.clientWidth
  const h = cv.clientHeight
  const g = cv.getContext('2d')
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, h)
  const dur = edit.buffer.duration
  const from = (edit.start / dur) * w
  const to = (edit.end / dur) * w
  const lit = getComputedStyle(document.documentElement).getPropertyValue('--accent-hi').trim()
  edit.peaks.forEach((p, i) => {
    const x = i * (BAR + GAP)
    const inside = x + BAR / 2 >= from && x + BAR / 2 <= to
    g.fillStyle = (edit.mode === 'keep' ? inside : !inside) ? lit : '#3a3a3a'
    const bh = Math.max(2, p * (h - 12))
    g.fillRect(x, (h - bh) / 2, BAR, bh)
  })
}

function place() {
  const dur = edit.buffer.duration
  $('#hs').style.left = `${(edit.start / dur) * 100}%`
  $('#he').style.left = `${(edit.end / dur) * 100}%`
  $('#edStart').value = fmtT(edit.start)
  $('#edEnd').value = fmtT(edit.end)
  $('#edLen').textContent = `Resultado: ${fmtT(resultLength())}`
}

function layout() {
  const cv = $('#waveCv')
  const dpr = devicePixelRatio || 1
  cv.width = cv.clientWidth * dpr
  cv.height = cv.clientHeight * dpr
  edit.peaks = peaksOf(edit.buffer, Math.max(1, Math.floor(cv.clientWidth / (BAR + GAP))))
  draw()
  place()
}

function refresh() {
  stopPreview()
  draw()
  place()
}

function move(which, t) {
  const dur = edit.buffer.duration
  if (which === 'start') edit.start = Math.min(Math.max(0, t), edit.end - MIN_SPAN)
  else edit.end = Math.max(Math.min(dur, t), edit.start + MIN_SPAN)
  refresh()
}

function stopPreview() {
  if (!preview) return
  const { sources, raf } = preview
  preview = null
  cancelAnimationFrame(raf)
  sources.forEach(s => { s.onended = null; try { s.stop() } catch {} })
  $('#ph').hidden = true
  $('#edPreview').textContent = 'Ouvir'
}

async function startPreview() {
  audio.pause()
  const ctx = new AudioContext()
  await ctx.resume()
  const dur = edit.buffer.duration
  const ranges = edit.mode === 'keep' ? [[edit.start, edit.end]] : [[0, edit.start], [edit.end, dur]]
  const spans = []
  const sources = []
  let at = ctx.currentTime + 0.05
  for (const [a, b] of ranges) {
    if (b - a < 0.01) continue
    const src = ctx.createBufferSource()
    src.buffer = edit.buffer
    src.connect(ctx.destination)
    src.start(at, a, b - a)
    sources.push(src)
    spans.push({ at, a, len: b - a })
    at += b - a
  }
  if (!sources.length) return ctx.close()
  const done = () => { stopPreview(); ctx.close() }
  sources[sources.length - 1].onended = done

  const ph = $('#ph')
  ph.hidden = false
  $('#edPreview').textContent = 'Parar'
  const tick = () => {
    if (!preview) return
    const now = ctx.currentTime
    const span = spans.find(s => now >= s.at && now < s.at + s.len)
    if (span) ph.style.left = `${((span.a + now - span.at) / dur) * 100}%`
    preview.raf = requestAnimationFrame(tick)
  }
  preview = { sources, raf: 0 }
  tick()
}

async function apply() {
  stopPreview()
  const n = state.now
  const out = sliceBuffer(edit.buffer, edit.mode === 'keep' ? [[edit.start, edit.end]] : [[0, edit.start], [edit.end, edit.buffer.duration]])
  if (!out) return toast('O resultado ficou vazio.')
  const base = `${n.artist ? `${n.artist} - ` : ''}${n.title} (recorte)`.replace(/[\\/:*?"<>|]+/g, '')
  const file = new File([toWav(out)], `${base}.wav`, { type: 'audio/wav' })
  $('#editorDlg').close()
  await addFiles([file], { cover: n.cover, coverBlob: n.coverBlob })
}

export async function openEditor() {
  const n = state.now
  if (!n.blob) return toast('Abra uma música primeiro.')
  if (n.id !== null && !mine(n.id)) return toast('Só dá para editar músicas suas ou arquivos que você abriu.')
  toast('Carregando o áudio…')
  try {
    edit.buffer = await decodeBlob(n.blob)
  } catch (err) {
    return toast(err.message === 'faixa longa demais' ? 'Essa faixa passa de 15 minutos, é longa demais.' : 'Não consegui ler esse áudio.')
  }
  hideToast()
  audio.pause()
  edit.start = 0
  edit.end = edit.buffer.duration
  edit.mode = 'keep'
  $('#edName').textContent = n.title
  syncMode()
  $('#editorDlg').showModal()
  layout()
}

function syncMode() {
  document.querySelectorAll('#edMode .chip').forEach(c => c.classList.toggle('on', c.dataset.mode === edit.mode))
}

function commitTime(which, input) {
  const t = parseT(input.value)
  if (t === null) return place()
  move(which, t)
}

export function bindEditor() {
  $('#qCut').addEventListener('click', openEditor)
  $('#edApply').addEventListener('click', apply)
  $('#edPreview').addEventListener('click', () => (preview ? stopPreview() : startPreview()))
  $('#editorDlg').addEventListener('close', stopPreview)
  $('#edMode').addEventListener('click', e => {
    const chip = e.target.closest('[data-mode]')
    if (!chip) return
    edit.mode = chip.dataset.mode
    syncMode()
    refresh()
  })
  $('#edStart').addEventListener('change', e => commitTime('start', e.target))
  $('#edEnd').addEventListener('change', e => commitTime('end', e.target))

  const wave = $('#wave')
  let dragging = null
  const timeAt = e => {
    const r = wave.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * edit.buffer.duration
  }
  wave.addEventListener('pointerdown', e => {
    const t = timeAt(e)
    dragging = Math.abs(t - edit.start) <= Math.abs(t - edit.end) ? 'start' : 'end'
    wave.setPointerCapture(e.pointerId)
    move(dragging, t)
  })
  wave.addEventListener('pointermove', e => { if (dragging) move(dragging, timeAt(e)) })
  const release = () => { dragging = null }
  wave.addEventListener('pointerup', release)
  wave.addEventListener('pointercancel', release)
  new ResizeObserver(() => { if ($('#editorDlg').open && edit.buffer) layout() }).observe(wave)
}
