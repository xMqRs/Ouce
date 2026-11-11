import { config } from './config.js'
import { setFx } from './effects.js'
import { applyFx, resumeAudio } from './engine.js'
import { $, fmt, paint, sid } from './lib/dom.js'
import { presets } from './lib/fx.js'
import { embeddedCover, toDataURL } from './lib/image.js'
import { coverOf } from './lib/track.js'
import { markNow, visibleRows } from './library.js'
import { audio, byId, cache, mine, state } from './state.js'
import { sb } from './supabase.js'
import { accentFromCover, applyAccent, theme } from './theme.js'
import { toast } from './ui.js'
import { setFocus } from './views.js'

async function loadEmbeddedCover(blob) {
  const img = await embeddedCover(blob)
  if (!img || state.now.blob !== blob || state.now.cover) return
  const url = await toDataURL(img)
  if (state.now.blob !== blob) return
  state.now.cover = url
  updateLabel()
  accentFromCover(url)
}

export function updateLabel() {
  const n = state.now
  const value = !n.blob ? '' : n.cover ? `url("${n.cover}") center/cover` : coverOf(n.id ?? n.title)
  for (const el of [$('#art'), $('#label')]) value ? el.style.setProperty('--cover', value) : el.style.removeProperty('--cover')
  $('#miniCover').style.background = value || ''
}

export function syncQuick() {
  const n = state.now
  const own = n.id !== null ? mine(n.id) : null
  $('#quick').hidden = !n.blob
  $('#dlBtn').hidden = !n.blob
  $('#qPl').hidden = !(state.user && n.id !== null && byId(n.id))
  $('#qPub').hidden = !own
  $('#qPub i').className = own && own.published ? 'ri-global-fill' : 'ri-global-line'
  $('#qPub span').textContent = own && own.published ? 'Pública' : 'Publicar'
}

function replay(el, cls) {
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}

function syncKicker() {
  $('#kicker').textContent = !state.now.blob ? 'Nada tocando' : audio.paused ? 'Pausado' : 'Tocando agora'
}

export function updateNow() {
  const n = state.now
  document.body.classList.toggle('has-track', !!n.blob)
  updateLabel()
  $('#title').textContent = n.blob ? n.title : 'Solte um som'
  if (n.blob) {
    replay($('.sleeve'), 'deal')
    replay($('#title'), 'flip')
  }
  $('#artist').textContent = n.blob ? n.artist || 'Artista desconhecido' : 'Adicione músicas para começar.'
  $('#cur').textContent = '0:00'
  $('#dur').textContent = '0:00'
  $('#seek').value = 0
  paint($('#seek'))
  document.title = n.blob ? `${n.title} · Ouce` : 'Ouce'
  $('#miniTitle').textContent = n.title
  $('#miniArtist').textContent = n.artist || ''
  if (n.blob && 'mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: n.title, artist: n.artist || '' })
  syncQuick()
  syncKicker()
  markNow()
}

export function setNow(patch, fx) {
  if (state.url) URL.revokeObjectURL(state.url)
  state.now = { id: null, blob: null, title: '', artist: '', cover: null, coverBlob: null, ...patch }
  state.url = URL.createObjectURL(state.now.blob)
  state.counted = false
  applyAccent(theme.pref)
  audio.src = state.url
  if (fx) setFx({ ...presets.original, ...fx }, false)
  else applyFx()
  updateNow()
  if (state.now.cover) accentFromCover(state.now.cover)
  else loadEmbeddedCover(state.now.blob)
}

export async function play() {
  await resumeAudio()
  try { await audio.play() } catch {}
  if (!state.counted) {
    state.counted = true
    sb.rpc('bump_stat', { stat: 'plays' }).then(() => {}, () => {})
  }
}

export async function openRow(id, ids) {
  const row = byId(id)
  if (!row) return
  state.queue = ids || [row.id]
  let blob = cache.get(sid(row.id))
  if (!blob) {
    toast('Carregando…')
    const { data, error } = await sb.storage.from(config.bucket).download(row.storage_path)
    if (error) return toast(mine(row.id) ? 'Não consegui baixar esse áudio.' : 'Não consegui abrir essa música. Falta liberar a leitura pública no Supabase.')
    blob = data
    cache.set(sid(row.id), blob)
  }
  let cover = null
  if (row.cover_path) {
    const res = await sb.storage.from(config.bucket).download(row.cover_path)
    if (!res.error) cover = await toDataURL(new Blob([res.data], { type: 'image/jpeg' }))
  }
  setNow({ id: row.id, blob, title: row.title, artist: row.artist || '', cover }, row.settings || {})
  await play()
}

function toggle() {
  if (!state.now.blob) {
    const first = visibleRows()[0]
    return first ? openRow(first.id, visibleRows().map(r => r.id)) : $('#file').click()
  }
  audio.paused ? play() : audio.pause()
}

function step(dir, auto = false) {
  const ids = state.queue.length ? state.queue : visibleRows().map(r => r.id)
  if (!ids.length || state.now.id === null) return
  const idx = ids.findIndex(x => sid(x) === sid(state.now.id))
  if (auto && state.repeat === 0 && !state.shuffle && idx === ids.length - 1) return
  let next
  if (state.shuffle && ids.length > 1) {
    do { next = ids[(Math.random() * ids.length) | 0] } while (sid(next) === sid(state.now.id))
  } else {
    next = ids[(idx + dir + ids.length) % ids.length]
  }
  openRow(next, ids)
}

function syncPlayState() {
  const playing = !audio.paused
  document.body.classList.toggle('playing', playing)
  const icon = playing ? 'ri-pause-fill' : 'ri-play-fill'
  $('#play i').className = icon
  $('#miniPlay i').className = icon
  syncKicker()
  markNow()
}

export function bindPlayer() {
  $('#miniPlay').addEventListener('click', toggle)
  $('#miniPrev').addEventListener('click', () => step(-1))
  $('#miniNext').addEventListener('click', () => step(1))
  $('#play').addEventListener('click', toggle)
  $('#prev').addEventListener('click', () => (audio.currentTime > 4 ? (audio.currentTime = 0) : step(-1)))
  $('#next').addEventListener('click', () => step(1))
  $('#shuffle').addEventListener('click', e => {
    state.shuffle = !state.shuffle
    e.currentTarget.classList.toggle('on', state.shuffle)
  })
  $('#repeat').addEventListener('click', e => {
    state.repeat = (state.repeat + 1) % 3
    e.currentTarget.classList.toggle('on', state.repeat > 0)
    e.currentTarget.firstChild.className = state.repeat === 2 ? 'ri-repeat-one-line' : 'ri-repeat-2-line'
  })
  $('#seek').addEventListener('input', e => {
    paint(e.target)
    if (audio.duration) audio.currentTime = (e.target.value / 1000) * audio.duration
  })

  audio.addEventListener('play', syncPlayState)
  audio.addEventListener('pause', syncPlayState)
  audio.addEventListener('ended', () => (state.repeat === 2 ? (audio.currentTime = 0, play()) : step(1, true)))
  audio.addEventListener('loadedmetadata', () => { $('#dur').textContent = fmt(audio.duration) })
  audio.addEventListener('timeupdate', () => {
    const d = audio.duration
    if (!d) return
    $('#cur').textContent = fmt(audio.currentTime)
    const seek = $('#seek')
    if (document.activeElement !== seek) { seek.value = (audio.currentTime / d) * 1000; paint(seek) }
    $('#mini').style.setProperty('--prog', audio.currentTime / d)
  })

  document.addEventListener('keydown', e => {
    if (e.target.closest('input, select, dialog')) return
    if (e.code === 'Space') { e.preventDefault(); toggle() }
    if (e.code === 'ArrowRight') audio.currentTime += 5
    if (e.code === 'ArrowLeft') audio.currentTime -= 5
    if (e.key === 'f') setFocus()
    if (e.key === 'Escape') document.body.classList.contains('fx-open') ? document.body.classList.remove('fx-open') : setFocus(false)
    if (e.key === 'n') step(1)
    if (e.key === 'p') step(-1)
  })

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', play)
    navigator.mediaSession.setActionHandler('pause', () => audio.pause())
    navigator.mediaSession.setActionHandler('previoustrack', () => step(-1))
    navigator.mediaSession.setActionHandler('nexttrack', () => step(1))
  }
}
