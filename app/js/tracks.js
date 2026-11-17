import { config } from './config.js'
import { downloadEdited } from './download.js'
import { $, sid } from './lib/dom.js'
import { isPreset, pickAutoCover, presetPath, presetThumb } from './autocover.js'
import { coverExt, coverThumb, embeddedCover, prepareCover, toDataURL } from './lib/image.js'
import { markNow, renderLibrary } from './library.js'
import { play, setNow, syncQuick, updateLabel, updateNow } from './player.js'
import { audio, cache, canEdit, state } from './state.js'
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

export async function attachCover(row, blob) {
  const path = `${row.user_id || state.user.id}/cover-${row.id}.${coverExt(blob)}`
  const stale = [path, row.cover_path].filter((p, i, all) => p && !isPreset(p) && all.indexOf(p) === i)
  await sb.storage.from(config.bucket).remove(stale)
  const up = await sb.storage.from(config.bucket).upload(path, blob, { contentType: blob.type || 'image/jpeg' })
  if (up.error) throw up.error
  const fields = { cover_path: path, cover_thumb: await coverThumb(blob) }
  const { data, error } = await sb.from('history').update(fields).eq('id', row.id).select().single()
  if (error) throw error
  Object.assign(row, data)
}

async function attachPreset(row, file) {
  const thumb = await presetThumb(file)
  const fields = { cover_path: presetPath(file), ...(thumb ? { cover_thumb: thumb } : {}) }
  const { data, error } = await sb.from('history').update(fields).eq('id', row.id).select().single()
  if (error) throw error
  Object.assign(row, data)
}

async function giveAutoCover(file) {
  const pick = await pickAutoCover()
  if (!pick || state.now.blob !== file) return null
  Object.assign(state.now, { cover: pick.url, coverBlob: null, coverPreset: pick.file })
  updateLabel()
  accentFromCover(pick.url)
  return pick
}

const coverNote = () => 'Capa automática do Ouce.'
const swapCover = () => {
  if (!state.editor.on) $('#qEdit').click()
  $('#coverFile').click()
}

export const coverFail = err => (/column|cover_/i.test((err && err.message) || '') ? 'Falta rodar o SQL novo no Supabase.' : 'Não consegui enviar a capa.')

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
  let auto = null
  let autoFailed = false
  const hasCover = extra.cover || (await state.now.coverReady.catch(() => false))
  if (!hasCover && state.now.blob === first) {
    auto = await giveAutoCover(first).catch(err => (console.error(err), null))
    autoFailed = !auto
  }
  const noAuto = autoFailed ? ' Não consegui carregar as capas automáticas.' : ''
  if (!state.user) {
    return auto ? toast(`${coverNote(auto)} Entre na sua conta para salvar.`, swapCover, 'Trocar') : toast(`Entre na sua conta para salvar na biblioteca.${noAuto}`)
  }

  const saveable = valid.filter(f => f.size <= MAX_UPLOAD)
  const skipped = valid.length - saveable.length
  if (!saveable.length) return toast('Arquivo grande demais para guardar na conta (limite de 50 MB). Ele toca normalmente.')
  if (auto) toast(`${coverNote(auto)} Toque em Trocar se quiser outra.`, swapCover, 'Trocar')
  else toast(saveable.length === 1 ? 'Salvando…' : `Salvando ${saveable.length} músicas…`)
  let saved = 0
  for (const f of saveable) {
    try {
      const row = await uploadFile(f)
      state.rows.unshift(row)
      cache.set(sid(row.id), f)
      if (f === first) {
        if (auto) await attachPreset(row, auto.file).catch(err => console.error(err))
        else if (extra.coverBlob) await attachCover(row, extra.coverBlob).catch(err => console.error(err))
        else if (extra.coverPreset) await attachPreset(row, extra.coverPreset).catch(err => console.error(err))
      } else {
        const own = await embeddedCover(f)
        const pick = own ? null : await pickAutoCover()
        if (pick) await attachPreset(row, pick.file).catch(err => console.error(err))
      }
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
  const done = saved ? (saved === 1 ? 'Música salva.' : `${saved} músicas salvas.`) + note : 'Não consegui salvar. Tente de novo.'
  if (auto && saved) toast(`${done} ${coverNote(auto)}`, swapCover, 'Trocar')
  else toast(done + noAuto)
}

export async function setPublished(id, on) {
  const row = canEdit(id)
  if (!row) return
  const fields = { published: on }
  if (on && sid(row.id) === sid(state.now.id)) {
    fields.settings = { ...state.fx }
    if (state.now.coverBlob && !row.cover_path) {
      try { await attachCover(row, state.now.coverBlob) } catch (err) { return toast(coverFail(err)) }
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
  const row = canEdit(id)
  if (!row) return
  const wasOwn = state.rows.includes(row)
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
      if (wasOwn) state.rows.push(row)
      if (row.published) state.pub.push(row)
      renderLibrary()
      return toast('Sem permissão para excluir. Falta a policy de delete no Supabase.')
    }
    const paths = [row.storage_path, row.cover_path].filter(p => p && !isPreset(p))
    if (paths.length) sb.storage.from(config.bucket).remove(paths)
    cache.delete(sid(row.id))
    for (const pl of state.playlists.filter(p => (p.track_ids || []).some(x => sid(x) === sid(row.id)))) {
      pl.track_ids = pl.track_ids.filter(x => sid(x) !== sid(row.id))
      sb.from('playlists').update({ track_ids: pl.track_ids }).eq('id', pl.id)
    }
    if (state.tab === 'playlists') renderLibrary()
  }, () => { if (wasOwn) state.rows.push(row); if (row.published) state.pub.push(row); renderLibrary() })
}

export function openEdit(id) {
  const row = canEdit(id)
  if (!row) return
  state.editing = row.id
  const form = $('#editForm')
  form.title.value = row.title
  form.artist.value = row.artist || ''
  $('#editDlg').showModal()
}

async function saveEdit() {
  const row = canEdit(state.editing)
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
  $('#qPub').addEventListener('click', () => { const r = canEdit(state.now.id); if (r) setPublished(r.id, !r.published) })
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
  if (!state.editor.on) return toast('Abra o Modo editor para trocar a capa.')
  try {
    state.now.coverBlob = await prepareCover(file)
    state.now.cover = await toDataURL(state.now.coverBlob)
    state.now.coverPreset = null
  } catch (err) {
    return toast(err && err.message === 'gif-grande' ? 'Esse GIF passa de 4 MB. Use um menor.' : 'Não consegui abrir essa imagem.')
  }
  state.editor.coverDirty = true
  updateLabel()
  accentFromCover(state.now.cover)
  toast('Capa pronta. Toque em Salvar para guardar.')
}
