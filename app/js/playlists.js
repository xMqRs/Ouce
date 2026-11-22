import { config } from './config.js'
import { $, esc, sid } from './lib/dom.js'
import { coverExt, coverThumb } from './lib/image.js'
import { pickCover } from './lib/track.js'
import { renderLibrary } from './library.js'
import { openUsernameDialog } from './profile.js'
import { byId, mine, state } from './state.js'
import { sb } from './supabase.js'
import { toast, undoable } from './ui.js'

export const isOwner = pl => !!state.user && pl.user_id === state.user.id
export const authorName = pl => (isOwner(pl) ? state.profile?.username : state.authors.get(pl.user_id)) || null
export const findPlaylist = id => state.playlists.find(p => sid(p.id) === sid(id)) || state.pubPlaylists.find(p => sid(p.id) === sid(id))

// capa da playlist: a escolhida, senão a de uma das faixas, senão um degradê
export function playlistCover(pl) {
  const first = (pl.track_ids || []).map(byId).find(r => r && r.cover_thumb)
  return pickCover(pl.cover_thumb || first?.cover_thumb, pl.id, pl.name, '')
}

// quantas faixas: para o dono, todas; para os outros, só as que dá para ouvir
export const trackCount = pl => (isOwner(pl) ? (pl.track_ids || []).length : (pl.track_ids || []).filter(byId).length)

const SQL_MSG = 'Falta rodar o SQL novo no Supabase (supabase/playlists-publicas.sql).'
const sqlMissing = err => /column|published|cover_|profiles|relation/i.test((err && err.message) || '')

// playlist pública só toca se as faixas forem públicas: as do dono que estiverem privadas são publicadas junto
export async function publishTracks(ids) {
  const todo = (ids || []).map(id => mine(id)).filter(r => r && !r.published)
  if (!todo.length) return true
  const { error } = await sb.from('history').update({ published: true }).in('id', todo.map(r => r.id))
  if (error) { toast('Não consegui publicar as faixas da playlist.'); return false }
  todo.forEach(r => {
    r.published = true
    if (!state.pub.some(p => sid(p.id) === sid(r.id))) state.pub.unshift(r)
  })
  return true
}

function syncPublicList(pl) {
  state.pubPlaylists = state.pubPlaylists.filter(p => sid(p.id) !== sid(pl.id))
  if (pl.published) state.pubPlaylists.unshift(pl)
}

export async function setPlaylistPublic(pl, on) {
  if (on) {
    if (!state.profile?.username) {
      if (state.profileOk) openUsernameDialog({ required: true })
      toast('Escolha um @username para postar playlists.')
      return false
    }
    if (!(pl.track_ids || []).length) { toast('Adicione ao menos uma faixa antes de postar.'); return false }
    if (!(await publishTracks(pl.track_ids))) return false
  }
  const { error } = await sb.from('playlists').update({ published: on }).eq('id', pl.id)
  if (error) { toast(sqlMissing(error) ? SQL_MSG : 'Não consegui atualizar a playlist.'); return false }
  pl.published = on
  syncPublicList(pl)
  renderLibrary()
  toast(on ? 'Playlist postada na biblioteca pública.' : 'Playlist tirada da biblioteca pública.')
  return true
}

// capa nova (blob) ou remoção (null); devolve os campos para gravar na playlist
export async function savePlaylistCover(pl, blob) {
  const bucket = sb.storage.from(config.bucket)
  const old = pl.cover_path && !String(pl.cover_path).startsWith('ouce:') ? [pl.cover_path] : []
  if (!blob) {
    if (old.length) await bucket.remove(old)
    return { cover_path: null, cover_thumb: null }
  }
  const path = `${pl.user_id || state.user.id}/playlist-${pl.id}.${coverExt(blob)}`
  await bucket.remove([...new Set([...old, path])])
  const up = await bucket.upload(path, blob, { contentType: blob.type || 'image/jpeg' })
  if (up.error) throw up.error
  return { cover_path: path, cover_thumb: await coverThumb(blob) }
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))
let lastPublicLoad = 0

export async function loadPublicPlaylists(force = false) {
  if (!force && Date.now() - lastPublicLoad < 15000) return
  lastPublicLoad = Date.now()
  const { data, error } = await sb.from('playlists').select('*').eq('published', true).order('created_at', { ascending: false }).limit(100)
  if (error) {
    console.warn('[Ouce] playlists públicas indisponíveis:', error.message)
    if (state.tab === 'plpub') renderLibrary(true)
    return
  }
  const owners = [...new Set(data.map(p => p.user_id))]
  const ids = [...new Set(data.flatMap(p => p.track_ids || []).map(String))]
  const [profiles, tracks] = await Promise.all([
    Promise.all(chunk(owners, 100).map(c => sb.from('profiles').select('id, username').in('id', c))),
    Promise.all(chunk(ids, 80).map(c => sb.from('history').select('*').in('id', c).eq('published', true)))
  ])
  profiles.forEach(r => (r.data || []).forEach(p => state.authors.set(p.id, p.username)))
  tracks.forEach(r => (r.data || []).forEach(t => state.plTracks.set(sid(t.id), t)))
  state.pubPlaylists = data.map(p => state.playlists.find(x => sid(x.id) === sid(p.id)) || p)
  renderLibrary(true)
}

export async function createPlaylist(name, trackIds = []) {
  const { data, error } = await sb.from('playlists').insert({ name, track_ids: trackIds }).select().single()
  if (error) { toast('Não consegui criar a playlist.'); return null }
  state.playlists.unshift(data)
  renderLibrary()
  return data
}

export async function setInPlaylist(pl, trackId, add) {
  const had = (pl.track_ids || []).some(x => sid(x) === sid(trackId))
  if (add === had) return
  const next = add ? [...(pl.track_ids || []), trackId] : pl.track_ids.filter(x => sid(x) !== sid(trackId))
  if (add && pl.published && !(await publishTracks([trackId]))) return
  const { error } = await sb.from('playlists').update({ track_ids: next }).eq('id', pl.id)
  if (error) return toast('Não consegui atualizar a playlist.')
  pl.track_ids = next
  renderLibrary()
}

export function openPicker(id) {
  const row = byId(id)
  if (!row) return
  state.picking = row.id
  drawPicker()
  $('#plDlg').showModal()
}

function drawPicker() {
  $('#plPick').innerHTML = state.playlists.length
    ? state.playlists.map(pl => {
      const on = (pl.track_ids || []).some(x => sid(x) === sid(state.picking))
      return `<button type="button" class="pick${on ? ' on' : ''}" data-pl="${esc(pl.id)}"><i class="${on ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'}"></i>${esc(pl.name)}</button>`
    }).join('')
    : '<p class="hint">Nenhuma playlist ainda. Crie a primeira abaixo.</p>'
}

export function deletePlaylist(pl) {
  state.playlists = state.playlists.filter(p => p !== pl)
  renderLibrary()
  undoable(`Playlist "${pl.name}" excluída`, async () => {
    const { error } = await sb.from('playlists').delete().eq('id', pl.id)
    if (!error && pl.cover_path) sb.storage.from(config.bucket).remove([pl.cover_path]).then(() => {}, () => {})
    if (!error) state.pubPlaylists = state.pubPlaylists.filter(p => sid(p.id) !== sid(pl.id))
    if (error) {
      state.playlists.unshift(pl)
      renderLibrary()
      toast('Não consegui excluir a playlist.')
    }
  }, () => { state.playlists.unshift(pl); renderLibrary() })
}

export function bindPlaylists() {
  $('#qPl').addEventListener('click', () => openPicker(state.now.id))
  $('#plPick').addEventListener('click', e => {
    const b = e.target.closest('[data-pl]')
    if (!b) return
    const pl = state.playlists.find(p => sid(p.id) === b.dataset.pl)
    setInPlaylist(pl, state.picking, !b.classList.contains('on')).then(drawPicker)
  })
  $('#plNew').addEventListener('submit', async e => {
    e.preventDefault()
    const name = e.target.name.value.trim()
    if (!name) return
    await createPlaylist(name, [state.picking])
    e.target.reset()
    drawPicker()
  })
}
