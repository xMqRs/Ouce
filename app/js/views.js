import { $, $$ } from './lib/dom.js'
import { loadPublic } from './library.js'
import { state } from './state.js'

function setView(name) {
  document.body.dataset.view = name
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.view === name))
  $$('.view').forEach(v => v.classList.remove('on'))
  const next = $('#v-' + name)
  void next.offsetWidth
  next.classList.add('on')
  if (name === 'library' && state.tab === 'library') loadPublic()
}

export function setFocus(on = !document.body.classList.contains('focus')) {
  if (on) setView('player')
  document.body.classList.toggle('focus', on)
  if (!on) document.body.classList.remove('fx-open')
  $('#focusBtn i').className = on ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'
}

export function bindViews() {
  $$('.tab').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)))
  $('#mini').addEventListener('click', e => { if (!e.target.closest('button')) setView('player') })
  $('#focusBtn').addEventListener('click', () => setFocus())
  $('#fxBtn').addEventListener('click', () => document.body.classList.toggle('fx-open'))
}
