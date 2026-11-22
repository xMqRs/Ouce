import { openAuth } from './auth.js'
import { $, $$, esc, sid } from './lib/dom.js'
import { highlight, passFilters, score, tokensOf } from './lib/search.js'
import { pickCover, tagOf } from './lib/track.js'
import { openRow, syncQuick } from './player.js'
import { openPlEditor } from './plEditor.js'
import { authorName, createPlaylist, deletePlaylist, findPlaylist, isOwner, loadPublicPlaylists, openPicker, playlistCover, setInPlaylist, setPlaylistPublic, trackCount } from './playlists.js'
import { audio, byId, canEdit, mine, state } from './state.js'
import { clearSearch, renderFilters } from './suggest.js'
import { sb } from './supabase.js'
import { openEdit, removeRow, setPublished } from './tracks.js'
import { toast } from './ui.js'

export const sourceRows = () => (state.tab === 'library' ? state.pub : state.rows)

export function visibleRows() {
  const tokens = tokensOf(state.query)
  const sorters = {
    recent: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    title: (a, b) => a.title.localeCompare(b.title),
    artist: (a, b) => (a.artist || '').localeCompare(b.artist || '')
  }
  const found = sourceRows()
    .map(r => [r, score(r, tokens)])
    .filter(([r, s]) => s > 0 && passFilters(r, state.filters))
  found.sort((a, b) => (tokens.length ? b[1] - a[1] : 0) || sorters[state.sort](a[0], b[0]))
  return found.map(([r]) => r)
}

function trackRow(r, i) {
  const bg = pickCover(r.cover_thumb, r.id, r.title, r.artist)
  const tag = tagOf(r.settings)
  const date = new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const now = sid(r.id) === sid(state.now.id)
  const own = !!mine(r.id)
  const edit = !!canEdit(r.id)
  const badge = own && r.published && state.tab === 'history' ? ' · <em class="tag">pública</em>' : own && state.tab === 'library' ? ' · <em class="tag">sua</em>' : ''
  return `
    <li class="row${now ? ' now' : ''}${now && !audio.paused ? ' live' : ''}" data-id="${esc(r.id)}" style="--i:${Math.min(i, 14)}">
      <button class="cv" data-act="play" style="background:${esc(bg)}"><i class="ri-play-fill"></i><b class="bars"><u></u><u></u><u></u></b></button>
      <div class="meta"><strong>${highlight(r.title, state.query)}</strong><span>${highlight(r.artist || 'Artista desconhecido', state.query)}${tag ? ` · <em class="tag">${tag}</em>` : ''}${badge}</span></div>
      <span class="dur">${date}</span>
      <div class="acts">
        ${edit ? `<button data-act="pub" title="${r.published ? 'Tirar da biblioteca pública' : 'Publicar na biblioteca pública'}" class="${r.published ? 'liked' : ''}"><i class="${r.published ? 'ri-global-fill' : 'ri-global-line'}"></i></button>` : ''}
        ${state.user ? '<button data-act="pick" title="Playlist"><i class="ri-play-list-add-line"></i></button>' : ''}
        ${edit ? '<button data-act="edit" title="Editar"><i class="ri-pencil-line"></i></button><button data-act="del" class="del" title="Excluir"><i class="ri-delete-bin-6-line"></i></button>' : ''}
      </div>
    </li>`
}

function playlistBlock(pl) {
  const ids = pl.track_ids || []
  const open = state.open.has(pl.id)
  const own = isOwner(pl)
  const by = authorName(pl)
  const count = trackCount(pl)
  const items = ids.filter(id => own || byId(id)).map(id => {
    const r = byId(id)
    return `<li class="pl-track" data-pl="${esc(pl.id)}" data-id="${esc(id)}">
      <button class="meta" data-act="pt-play"><strong>${esc(r ? r.title : '(removida)')}</strong><span>${esc(r ? r.artist || '' : '')}</span></button>
      ${own ? '<button class="x" data-act="pt-rm" title="Tirar da playlist"><i class="ri-close-line"></i></button>' : ''}</li>`
  }).join('')
  const tools = own
    ? `<button data-act="pl-play" title="Tocar"><i class="ri-play-fill"></i></button>
       <button data-act="pl-edit" title="Editar playlist"><i class="ri-pencil-line"></i></button>
       <button data-act="pl-pub" class="${pl.published ? 'liked' : ''}" title="${pl.published ? 'Tirar da biblioteca pública' : 'Postar na biblioteca pública'}"><i class="${pl.published ? 'ri-global-fill' : 'ri-global-line'}"></i></button>
       <button data-act="pl-del" class="del" title="Excluir playlist"><i class="ri-delete-bin-6-line"></i></button>`
    : '<button data-act="pl-play" title="Tocar"><i class="ri-play-fill"></i></button>'
  const meta = `${by ? `<b>@${esc(by)}</b> · ` : ''}${count} faixa${count === 1 ? '' : 's'}${own && pl.published && state.tab !== 'plpub' ? ' · pública' : ''}`
  return `<li class="pl" data-pl="${esc(pl.id)}">
    <div class="pl-head">
      <button class="pl-name" data-act="pl-toggle"><span class="pl-cv" style="background:${esc(playlistCover(pl))}"></span><span class="pl-info"><strong>${esc(pl.name)}</strong><span class="pl-meta">${meta}</span></span><i class="ri-arrow-right-s-line${open ? ' rot' : ''}"></i></button>
      <div class="acts">${tools}</div>
    </div>
    ${open ? `<ul class="pl-tracks">${items || '<p class="hint" style="padding-left:30px">Vazia por enquanto.</p>'}</ul>` : ''}
  </li>`
}

export function renderLibrary(anim = false) {
  const list = $('#list')
  list.classList.toggle('anim', anim)
  $('#tools').hidden = state.tab === 'playlists' || state.tab === 'plpub'
  renderFilters()
  const loggedOnly = state.tab !== 'library' && state.tab !== 'plpub'
  const nPub = state.pubPlaylists.length
  $('#stats').textContent = state.tab === 'plpub'
    ? `${nPub} playlist${nPub === 1 ? '' : 's'} pública${nPub === 1 ? '' : 's'}`
    : state.tab === 'library'
    ? `${state.pub.length} músicas públicas`
    : state.user ? `${state.rows.length} músicas · ${state.rows.filter(r => r.published).length} públicas · ${state.playlists.length} playlists` : 'Você não está logado'
  if (!state.user && loggedOnly) {
    list.innerHTML = `<div class="empty"><div class="rings"><i class="ri-user-3-line"></i></div><p>Entre para guardar suas músicas, playlists e histórico.</p><button class="btn" data-auth><i class="ri-login-box-line"></i>Entrar</button></div>`
    return
  }
  if (state.tab === 'plpub') {
    list.innerHTML = nPub
      ? state.pubPlaylists.map(playlistBlock).join('')
      : '<div class="empty"><div class="rings"><i class="ri-group-line"></i></div><p>Ninguém postou uma playlist ainda.<br>Poste uma das suas pelo ícone de globo, na aba Playlists.</p></div>'
    return
  }
  if (state.tab === 'playlists') {
    const form = `<form class="inline" id="plForm"><label class="search"><i class="ri-play-list-add-line"></i><input name="name" placeholder="Nome da nova playlist" maxlength="60" autocomplete="off" required></label><button class="btn">Criar</button></form>`
    list.innerHTML = form + (state.playlists.length ? state.playlists.map(playlistBlock).join('') : '<div class="empty"><p>Nenhuma playlist ainda.</p></div>')
    return
  }
  const rows = visibleRows()
  if (!rows.length) {
    const source = state.tab === 'library' ? state.pub : state.rows
    list.innerHTML = source.length
      ? `<div class="empty"><i class="ri-search-line" style="font-size:36px"></i><p>Nada encontrado${state.query ? ` para "${esc(state.query)}"` : ''}.</p>${state.query || state.filters.size ? '<button class="btn flat" data-clear>Limpar busca e filtros</button>' : ''}</div>`
      : state.tab === 'library'
        ? `<div class="empty"><div class="rings"><i class="ri-global-line"></i></div><p>Ninguém publicou nada ainda.<br>Publique uma música sua com o ícone de globo.</p></div>`
      : `<div class="empty"><div class="rings"><i class="ri-music-2-line"></i></div><p>Nada por aqui ainda.</p><button class="btn" data-pick><i class="ri-upload-2-line"></i>Escolher músicas</button></div>`
    return
  }
  list.innerHTML = rows.map(trackRow).join('')
}

export function markNow() {
  const live = !audio.paused
  $$('.row').forEach(r => {
    const on = sid(r.dataset.id) === sid(state.now.id) && state.now.id !== null
    r.classList.toggle('now', on)
    r.classList.toggle('live', on && live)
  })
}

function mergePublic() {
  state.pub = state.pub.map(r => mine(r.id) || r)
}

let pubFetchedAt = 0

export async function loadPublic(force = false) {
  if (!force && Date.now() - pubFetchedAt < 15000) return
  pubFetchedAt = Date.now()
  const { data, error } = await sb.from('history').select('*').eq('published', true).order('created_at', { ascending: false }).limit(300)
  if (error) return console.error(error)
  const grew = data.length !== state.pub.length
  state.pub = data.map(r => mine(r.id) || r)
  if (state.tab === 'library') renderLibrary(grew)
}

export async function loadLibrary() {
  const [lists, saved] = await Promise.all([
    sb.from('playlists').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false }),
    sb.from('history').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false }).limit(500)
  ])
  if (lists.error || saved.error) return console.error(lists.error || saved.error)
  state.playlists = lists.data
  state.rows = saved.data
  mergePublic()
  renderLibrary(true)
  syncQuick()
}

function setTab(tab) {
  state.tab = tab
  $$('#seg .chip').forEach(c => c.classList.toggle('on', c.dataset.tab === tab))
  renderLibrary(true)
  if (tab === 'library') loadPublic()
  if (tab === 'plpub') loadPublicPlaylists()
}

export function bindLibrary() {
  $('#seg').addEventListener('click', e => {
    const chip = e.target.closest('[data-tab]')
    if (chip) setTab(chip.dataset.tab)
  })
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; renderLibrary(true) })
  $('#list').addEventListener('click', onListClick)
  $('#list').addEventListener('submit', async e => {
    if (e.target.id !== 'plForm') return
    e.preventDefault()
    const name = e.target.name.value.trim()
    if (name) await createPlaylist(name)
  })
}

function onListClick(e) {
  if (e.target.closest('[data-auth]')) return openAuth('login')
  if (e.target.closest('[data-pick]')) return $('#file').click()
  if (e.target.closest('[data-clear]')) return clearSearch()
  const btn = e.target.closest('[data-act]')
  if (!btn) return
  const act = btn.dataset.act
  const id = btn.closest('[data-id]')?.dataset.id
  const plEl = btn.closest('[data-pl]')
  const pl = plEl && findPlaylist(plEl.dataset.pl)
  const playlistIds = () => (pl.track_ids || []).filter(x => byId(x))

  if (act === 'play') openRow(id, visibleRows().map(r => r.id))
  if (act === 'pub') { const r = canEdit(id); if (r) setPublished(r.id, !r.published) }
  if (act === 'pick') openPicker(id)
  if (act === 'edit') openEdit(id)
  if (act === 'del') removeRow(id)
  if (act === 'pl-toggle') { state.open.has(pl.id) ? state.open.delete(pl.id) : state.open.add(pl.id); renderLibrary() }
  if (act === 'pl-play') {
    const ids = playlistIds()
    ids.length ? openRow(ids[0], ids, { kind: 'playlist', id: pl.id }) : toast('Essa playlist está vazia.')
  }
  if (act === 'pl-edit') openPlEditor(pl)
  if (act === 'pl-pub') setPlaylistPublic(pl, !pl.published)
  if (act === 'pl-del') deletePlaylist(pl)
  if (act === 'pt-play') openRow(id, playlistIds(), { kind: 'playlist', id: pl.id })
  if (act === 'pt-rm') setInPlaylist(pl, byId(id)?.id ?? id, false)
}
