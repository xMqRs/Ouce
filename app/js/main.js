import { bindAuth, watchSession } from './auth.js'
import { bindEditMode } from './editmode.js'
import { initLight } from './light.js'
import { bindEditor } from './editor.js'
import { bindEffects, drawChips, syncFxUI } from './effects.js'
import { $, paint } from './lib/dom.js'
import { bindLibrary, loadPublic, renderLibrary } from './library.js'
import { bindPlayer, updateLabel } from './player.js'
import { bindPlaylists } from './playlists.js'
import { loadStats } from './stats.js'
import { bindSearch } from './suggest.js'
import { accentFromCover, applyAccent, bindSettings, theme } from './theme.js'
import { bindTracks } from './tracks.js'
import { bindDialogs } from './ui.js'
import { state } from './state.js'
import { bindViews } from './views.js'
import { startVisuals } from './visuals.js'

function start() {
  drawChips()
  syncFxUI()
  paint($('#seek'))
  paint($('#vol'))
  $('#vol').nextElementSibling.textContent = '100%'

  bindDialogs()
  bindViews()
  bindPlayer()
  bindEffects()
  bindLibrary()
  bindSearch()
  bindTracks()
  bindEditor()
  bindEditMode()
  initLight()
  bindPlaylists()
  bindAuth()
  bindSettings()

  applyAccent(theme.pref)
  renderLibrary(true)
  startVisuals()
  setTimeout(() => $('#intro').remove(), 2200)

  watchSession()
  loadPublic(true)
  loadStats()
}

start()

// trocar de tema muda as capas (ícones no Frutiger Aero) e, ao sair dele, devolve a cor da capa
document.addEventListener('ouce:style', e => {
  if (e.detail.was === 'aero' && state.now.cover) accentFromCover(state.now.cover)
  updateLabel()
  renderLibrary()
})
