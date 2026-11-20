import { $, esc, sid } from './lib/dom.js'
import { renderLibrary } from './library.js'
import { byId, state } from './state.js'
import { sb } from './supabase.js'
import { toast, undoable } from './ui.js'

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
