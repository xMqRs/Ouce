import { $, $$, esc } from './lib/dom.js'
import { FILTERS, highlight, score, suggest, tokensOf } from './lib/search.js'
import { coverOf, tagOf } from './lib/track.js'
import { renderLibrary, sourceRows, visibleRows } from './library.js'
import { openRow } from './player.js'
import { state } from './state.js'

let items = []
let active = -1

const isOpen = () => !$('#sug').hidden

function setQuery(value) {
  state.query = value
  $('#q').value = value
  $('#qClear').hidden = !value
}

function close() {
  $('#sug').hidden = true
  $('#q').setAttribute('aria-expanded', 'false')
  $('#q').removeAttribute('aria-activedescendant')
  active = -1
}

function highlightActive() {
  $$('#sug [data-i]').forEach(li => li.classList.toggle('on', +li.dataset.i === active))
  const current = $(`#sug [data-i="${active}"]`)
  if (current) {
    $('#q').setAttribute('aria-activedescendant', current.id)
    current.scrollIntoView({ block: 'nearest' })
  } else {
    $('#q').removeAttribute('aria-activedescendant')
  }
}

function renderSuggestions() {
  const found = suggest(sourceRows(), $('#q').value, state.filters)
  items = [
    ...found.filters.map(f => ({ kind: 'filter', f })),
    ...found.tracks.map(r => ({ kind: 'track', r })),
    ...found.artists.map(a => ({ kind: 'artist', ...a }))
  ]
  if (!items.length) return close()

  const q = $('#q').value
  let html = ''
  let last = ''
  items.forEach((it, i) => {
    const group = it.kind === 'filter' ? 'Filtros' : it.kind === 'track' ? 'Músicas' : 'Artistas'
    if (group !== last) html += `<li class="group" role="presentation">${group}</li>`
    last = group
    if (it.kind === 'filter') {
      html += `<li id="sg${i}" role="option" data-i="${i}"><span class="sg-ico"><i class="ri-equalizer-3-line"></i></span><div class="sg-meta"><strong>Filtrar por ${esc(it.f.label)}</strong><span>Mostrar só músicas com esse efeito</span></div></li>`
    } else if (it.kind === 'track') {
      const bg = it.r.cover_thumb ? `url("${it.r.cover_thumb}") center/cover` : coverOf(it.r.id)
      const tag = tagOf(it.r.settings)
      html += `<li id="sg${i}" role="option" data-i="${i}"><span class="sg-cv" style="background:${esc(bg)}"></span><div class="sg-meta"><strong>${highlight(it.r.title, q)}</strong><span>${highlight(it.r.artist || 'Artista desconhecido', q)}${tag ? ` · <em class="tag">${tag}</em>` : ''}</span></div><button type="button" class="sg-play" data-play="${i}" aria-label="Tocar agora"><i class="ri-play-fill"></i></button></li>`
    } else {
      html += `<li id="sg${i}" role="option" data-i="${i}"><span class="sg-ico"><i class="ri-user-3-line"></i></span><div class="sg-meta"><strong>${highlight(it.name, q)}</strong><span>${it.count} ${it.count === 1 ? 'música' : 'músicas'}</span></div></li>`
    }
  })
  $('#sug').innerHTML = html
  $('#sug').hidden = false
  $('#q').setAttribute('aria-expanded', 'true')
  active = -1
}

function flash(id) {
  const row = $(`.row[data-id="${CSS.escape(String(id))}"]`)
  if (!row) return
  row.scrollIntoView({ block: 'center', behavior: 'smooth' })
  row.classList.add('hit')
  setTimeout(() => row.classList.remove('hit'), 1300)
}

function choose(i, play = false) {
  const it = items[i]
  if (!it) return
  if (it.kind === 'filter') {
    state.filters.add(it.f.key)
    setQuery('')
  } else {
    setQuery(it.kind === 'track' ? it.r.title : it.name)
  }
  close()
  renderLibrary(true)
  if (it.kind === 'track') {
    if (play) openRow(it.r.id, visibleRows().map(r => r.id))
    else setTimeout(() => flash(it.r.id), 80)
  }
}

export function clearSearch() {
  state.filters.clear()
  setQuery('')
  close()
  renderLibrary(true)
}

export function renderFilters() {
  const tokens = tokensOf(state.query)
  const base = sourceRows().filter(r => !tokens.length || score(r, tokens) > 0)
  const chip = (key, label, count) => `<button type="button" class="chip${key === 'all' ? (state.filters.size ? '' : ' on') : (state.filters.has(key) ? ' on' : '')}" data-f="${key}">${label} <small>${count}</small></button>`
  $('#filters').innerHTML = chip('all', 'Todas', base.length) + FILTERS.map(f => chip(f.key, f.label, base.filter(r => f.test(r.settings || {})).length)).join('')
}

export function bindSearch() {
  const input = $('#q')
  input.addEventListener('input', () => {
    setQuery(input.value)
    renderLibrary()
    renderSuggestions()
  })
  input.addEventListener('focus', () => { if (input.value) renderSuggestions() })
  input.addEventListener('blur', close)
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen()) renderSuggestions()
      if (!items.length) return
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      highlightActive()
    } else if (e.key === 'Enter') {
      if (isOpen() && active >= 0) {
        e.preventDefault()
        choose(active)
      } else {
        close()
      }
    } else if (e.key === 'Escape') {
      if (isOpen()) close()
      else if (input.value) { setQuery(''); renderLibrary() }
    }
  })

  const sug = $('#sug')
  sug.addEventListener('pointerdown', e => e.preventDefault())
  sug.addEventListener('click', e => {
    const play = e.target.closest('[data-play]')
    if (play) return choose(+play.dataset.play, true)
    const li = e.target.closest('[data-i]')
    if (li) choose(+li.dataset.i)
  })
  sug.addEventListener('pointermove', e => {
    const li = e.target.closest('[data-i]')
    if (li && +li.dataset.i !== active) { active = +li.dataset.i; highlightActive() }
  })

  $('#qClear').addEventListener('click', () => {
    setQuery('')
    close()
    renderLibrary()
    input.focus()
  })

  $('#filters').addEventListener('click', e => {
    const chip = e.target.closest('[data-f]')
    if (!chip) return
    if (chip.dataset.f === 'all') state.filters.clear()
    else if (state.filters.has(chip.dataset.f)) state.filters.delete(chip.dataset.f)
    else state.filters.add(chip.dataset.f)
    renderLibrary(true)
  })
}
