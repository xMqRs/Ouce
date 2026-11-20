import { setFx } from './effects.js'
import { $ } from './lib/dom.js'
import { renderLibrary } from './library.js'
import { refreshMeta, syncEditor, updateLabel } from './player.js'
import { canEdit, state } from './state.js'
import { sb } from './supabase.js'
import { accentFromCover, applyAccent, theme } from './theme.js'
import { attachCover, coverFail } from './tracks.js'
import { toast } from './ui.js'
import { setFocus } from './views.js'

function enter() {
  const n = state.now
  if (!n.blob || state.editor.on) return
  if (n.id !== null && !canEdit(n.id)) return toast('Só dá para editar músicas suas.')
  if (document.body.classList.contains('focus')) setFocus(false)
  state.editor = {
    on: true,
    coverDirty: false,
    snap: { cover: n.cover, coverBlob: n.coverBlob, coverPreset: n.coverPreset ?? null, fx: { ...state.fx } }
  }
  $('#titleIn').value = n.title
  $('#artistIn').value = n.artist || ''
  syncEditor()
  $('#titleIn').focus()
}

function leave(restore) {
  const { snap, coverDirty } = state.editor
  state.editor = { on: false }
  if (restore && snap) {
    if (coverDirty) {
      Object.assign(state.now, { cover: snap.cover, coverBlob: snap.coverBlob, coverPreset: snap.coverPreset })
      updateLabel()
      snap.cover ? accentFromCover(snap.cover) : applyAccent(theme.pref)
    }
    setFx(snap.fx)
  }
  syncEditor()
}

async function save() {
  const n = state.now
  if (!state.editor.on || !n.blob) return
  const title = $('#titleIn').value.trim() || n.title
  const artist = $('#artistIn').value.trim()
  const row = n.id !== null ? canEdit(n.id) : null
  if (row) {
    const fields = { title, artist, settings: { ...state.fx } }
    const { error } = await sb.from('history').update(fields).eq('id', row.id)
    if (error) return toast('Não consegui salvar as alterações.')
    Object.assign(row, fields)
    if (state.editor.coverDirty && n.coverBlob) {
      try {
        await attachCover(row, n.coverBlob)
      } catch (err) {
        console.error(err)
        toast(coverFail(err))
      }
    }
  }
  Object.assign(n, { title, artist })
  leave(false)
  refreshMeta()
  renderLibrary()
  toast(row ? 'Alterações salvas.' : 'Alterações aplicadas.')
}

export function bindEditMode() {
  $('#qEdit').addEventListener('click', enter)
  $('#editCancel').addEventListener('click', () => leave(true))
  $('#editSave').addEventListener('click', save)
  $('#titleIn').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); $('#artistIn').focus() }
    if (e.key === 'Escape') leave(true)
  })
  $('#artistIn').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); save() }
    if (e.key === 'Escape') leave(true)
  })
}
