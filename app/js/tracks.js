import { config } from './config.js'
import { downloadEdited } from './download.js'
import { $, sid } from './lib/dom.js'
import { squareJpeg, toDataURL } from './lib/image.js'
import { markNow, renderLibrary } from './library.js'
import { play, setNow, syncQuick, updateLabel, updateNow } from './player.js'
import { audio, cache, mine, state } from './state.js'
import { sb } from './supabase.js'
import { accentFromCover, applyAccent, theme } from './theme.js'
import { toast, undoable } from './ui.js'
import { extractAudio, isVideo, videoError } from './video.js'

function parseName(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim()
  const [artist, ...rest] = base.split(/\s+-\s+/)
  return rest.length ? { artist, title: rest.join(' - ') } : { title: base, artist: '' }
}

async function uploadFile(file) {
  const safe = (file.name || 'audio').replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${state.user.id}/${Date.now()}-${safe}`
  const up = await sb.storage.from(config.bucket).upload(path, file)
  if (up.error) throw up.error
  const { data, error } = await sb.from('history').insert({ ...parseName(file.name), settings: { ...state.fx }, storage_path: path }).select().single()
  if (error) throw error
  return data
}

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|flac|aac|opus)$/i
const MAX_UPLOAD = 50 * 1024 * 1024

const isAudio = f => f.type.startsWith('audio/') || AUDIO_EXT.test(f.name)

async function prepare(files) {
  const ready = []
  for (const f of files) {
    if (isAudio(f)) {
      ready.push(f)
    } else if (isVideo(f)) {
      toast(`Extraindo o áudio de "${f.name}"…`)
      try {
        ready.push(await extractAudio(f))
      } catch (err) {
        toast(videoError(err))
      }
    }
  }
  return ready
}

export async function addFiles(files, extra = {}) {
  const incoming = [...files]
  if (!incoming.some(f => isAudio(f) || isVideo(f))) return toast('Nenhum áudio ou vídeo encontrado')
  const valid = await prepare(incoming)
  if (!valid.length) return
  const first = valid[0]
  setNow({ blob: first, ...parseName(first.name), ...extra })
  play()
  if (!state.user) return toast('Entre na sua conta para salvar na biblioteca')

  const saveable = valid.filter(f => f.size <= MAX_UPLOAD)
  const skipped = valid.length - saveable.length
  if (!saveable.length) return toast('Arquivo grande demais para guardar na conta (limite de 50 MB). Ele toca normalmente.')
  toast(saveable.length === 1 ? 'Salvando…' : `Salvando ${saveable.length} músicas…`)
  let saved = 0
  for (const f of saveable) {
    try {
      const row = await uploadFile(f)
      state.rows.unshift(row)
      cache.set(sid(row.id), f)
      saved++
      if (f === first && state.now.blob === f) {
        state.now.id = row.id
        state.queue = [row.id]
        syncQuick()
        markNow()
      }
    } catch (err) {
      console.error(err)
    }
  }
  renderLibrary(true)
  const note = skipped ? ' Arquivos acima de 50 MB não foram guardados.' : ''
  toast(saved ? (saved === 1 ? 'Música salva.' : `${saved} músicas salvas.`) + note : 'Não consegui salvar. Tente de novo.')
}

export async function saveNow() {
  const n = state.now
  if (!state.user || n.id === null || !mine(n.id)) return
  const fields = { title: n.title, artist: n.artist, settings: { ...state.fx } }
  const { error } = await sb.from('history').update(fields).eq('id', n.id)
  if (error) return console.error(error)
  Object.assign(mine(n.id), fields)
}

export async function setPublished(id, on) {
  const row = mine(id)
  if (!row) return
  const fields = { published: on }
  if (on && sid(row.id) === sid(state.now.id)) {
    fields.settings = { ...state.fx }
    if (state.now.coverBlob) {
      const path = `${state.user.id}/cover-${row.id}.jpg`
      await sb.storage.from(config.bucket).remove([path])
      const up = await sb.storage.from(config.bucket).upload(path, state.now.coverBlob, { contentType: 'image/jpeg' })
      if (up.error) return toast('Não consegui enviar a capa.')
      fields.cover_path = path
      fields.cover_thumb = await toDataURL(await squareJpeg(state.now.coverBlob, 96))
    }
  }
  const { data, error } = await sb.from('history').update(fields).eq('id', row.id).select().single()
  if (error) return toast(/column|published|cover_/i.test(error.message || '') ? 'Falta rodar o SQL novo no Supabase.' : 'Não consegui atualizar.')
  Object.assign(row, data)
  state.pub = state.pub.filter(r => sid(r.id) !== sid(row.id))
  if (row.published) state.pub.unshift(row)
  renderLibrary()
  syncQuick()
  toast(on ? 'Publicada. Qualquer pessoa pode ouvir.' : 'Tirada da biblioteca pública')
}

export function removeRow(id) {
  const row = mine(id)
  if (!row) return
  state.rows = state.rows.filter(r => r !== row)
  state.pub = state.pub.filter(r => r !== row)
  if (sid(state.now.id) === sid(row.id)) {
    audio.pause()
    audio.removeAttribute('src')
    state.now = { id: null, blob: null, title: '', artist: '', cover: null, coverBlob: null }
    applyAccent(theme.pref)
    updateNow()
  }
  renderLibrary()
  undoable(`"${row.title}" excluída`, async () => {
    const { error } = await sb.from('history').delete().eq('id', row.id)
    if (error) {
      console.error(error)
      state.rows.push(row)
      if (row.published) state.pub.push(row)
      renderLibrary()
      return toast('Sem permissão para excluir. Falta a policy de delete no Supabase.')
    }
    const paths = [row.storage_path, row.cover_path].filter(Boolean)
    if (paths.length) sb.storage.from(config.bucket).remove(paths)
    cache.delete(sid(row.id))
    for (const pl of state.playlists.filter(p => (p.track_ids || []).some(x => sid(x) === sid(row.id)))) {
      pl.track_ids = pl.track_ids.filter(x => sid(x) !== sid(row.id))
      sb.from('playlists').update({ track_ids: pl.track_ids }).eq('id', pl.id)
    }
    if (state.tab === 'playlists') renderLibrary()
  }, () => { state.rows.push(row); if (row.published) state.pub.push(row); renderLibrary() })
}

export function openEdit(id) {
  const row = mine(id)
  if (!row) return
  state.editing = row.id
  const form = $('#editForm')
  form.title.value = row.title
  form.artist.value = row.artist || ''
  $('#editDlg').showModal()
}

async function saveEdit() {
  const row = mine(state.editing)
  const form = $('#editForm')
  const fields = { title: form.title.value.trim() || row.title, artist: form.artist.value.trim() }
  const { error } = await sb.from('history').update(fields).eq('id', row.id)
  if (error) return toast('Não consegui salvar as alterações.')
  Object.assign(row, fields)
  if (sid(state.now.id) === sid(row.id)) {
    Object.assign(state.now, fields)
    updateNow()
  }
  renderLibrary()
  toast('Alterações salvas')
}

export function bindTracks() {
  for (const id of ['railAdd', 'libAdd']) $('#' + id).addEventListener('click', () => $('#file').click())
  $('#file').addEventListener('change', e => { addFiles(e.target.files); e.target.value = '' })
  $('#videoBtn').addEventListener('click', () => $('#videoFile').click())
  $('#videoFile').addEventListener('change', e => { addFiles(e.target.files); e.target.value = '' })
  $('#editForm').addEventListener('submit', e => { if (e.submitter && e.submitter.value === 'ok') saveEdit() })
  $('#qPub').addEventListener('click', () => { const r = mine(state.now.id); if (r) setPublished(r.id, !r.published) })
  $('#dlBtn').addEventListener('click', downloadEdited)
  $('#qCover').addEventListener('click', () => $('#coverFile').click())
  $('#coverFile').addEventListener('change', onCoverPicked)

  let depth = 0
  const drop = $('#drop')
  addEventListener('dragenter', e => { e.preventDefault(); depth++; drop.classList.add('on') })
  addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; drop.classList.remove('on') } })
  addEventListener('dragover', e => e.preventDefault())
  addEventListener('drop', e => {
    e.preventDefault()
    depth = 0
    drop.classList.remove('on')
    addFiles(e.dataTransfer.files)
  })
}

async function onCoverPicked(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file || !state.now.blob) return
  try {
    state.now.coverBlob = await squareJpeg(file, 512)
    state.now.cover = await toDataURL(state.now.coverBlob)
  } catch {
    return toast('Não consegui abrir essa imagem.')
  }
  updateLabel()
  accentFromCover(state.now.cover)
  const row = mine(state.now.id)
  if (row && row.published) setPublished(row.id, true)
  else toast(row ? 'Capa pronta. Ela é salva quando você publica a música.' : 'Capa aplicada.')
}
