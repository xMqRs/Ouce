import { bindAuth, watchSession } from './auth.js'
import { bindEditor } from './editor.js'
import { bindEffects, drawChips, syncFxUI } from './effects.js'
import { $, paint } from './lib/dom.js'
import { bindLibrary, loadPublic, renderLibrary } from './library.js'
import { bindPlayer } from './player.js'
import { bindPlaylists } from './playlists.js'
import { loadStats } from './stats.js'
import { bindSearch } from './suggest.js'
import { applyAccent, bindSettings, theme } from './theme.js'
import { bindTracks } from './tracks.js'
import { bindDialogs } from './ui.js'
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
