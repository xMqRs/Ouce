import { $, $$, esc, sid } from './lib/dom.js'
import { prepareCover, toDataURL } from './lib/image.js'
import { score, tokensOf } from './lib/search.js'
import { pickCover } from './lib/track.js'
import { config } from './config.js'
import { renderLibrary } from './library.js'
import { authorName, isOwner, playlistCover, publishTracks, savePlaylistCover } from './playlists.js'
import { openUsernameDialog } from './profile.js'
import { byId, state } from './state.js'
import { sb } from './supabase.js'
import { toast } from './ui.js'

// rascunho: nada é gravado até o dono tocar em Salvar
let d = null

const bg = r => pickCover(r.cover_thumb, r.id, r.title, r.artist)

function itemHtml(r, extra) {
  return `<li class="ple-item${extra.cls || ''}" data-id="${esc(r.id)}">
    <span class="cv" style="background:${esc(bg(r))}"></span>
    <div class="meta"><strong>${esc(r.title)}</strong><span>${esc(r.artist || 'Artista desconhecido')}</span></div>
    ${extra.buttons || ''}</li>`
}

function drawTracks() {
  $('#pleCount').textContent = `(${d.ids.length})`
  $('#pleTracks').innerHTML = d.ids.length
    ? d.ids.map((id, i) => {
      const r = byId(id)
      const row = r || { id, title: '(removida)', artist: '' }
      return itemHtml(row, {
        buttons: `<button type="button" class="ic" data-act="up" title="Subir" ${i === 0 ? 'disabled' : ''}><i class="ri-arrow-up-s-line"></i></button>
          <button type="button" class="ic" data-act="down" title="Descer" ${i === d.ids.length - 1 ? 'disabled' : ''}><i class="ri-arrow-down-s-line"></i></button>
          <button type="button" class="ic" data-act="rm" title="Tirar da playlist"><i class="ri-close-line"></i></button>`
      })
    }).join('')
    : '<li class="ple-empty">Nenhuma faixa ainda. Busque e selecione abaixo.</li>'
}

function pool() {
  const have = new Set(d.ids.map(sid))
  const rows = d.src === 'mine' ? state.rows : state.pub
  const tokens = tokensOf($('#pleQ').value)
  return rows
    .filter(r => !have.has(sid(r.id)))
    .map(r => [r, score(r, tokens)])
    .filter(([, s]) => s > 0)
    .sort((a, b) => (tokens.length ? b[1] - a[1] : new Date(b[0].created_at) - new Date(a[0].created_at)))
    .slice(0, 60)
    .map(([r]) => r)
}

function drawResults() {
  const rows = pool()
  $('#pleResults').innerHTML = rows.length
    ? rows.map(r => {
      const on = d.picked.has(sid(r.id))
      return itemHtml(r, { cls: ` ple-pick${on ? ' on' : ''}`, buttons: `<span class="ic"><i class="${on ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'}"></i></span>` })
    }).join('')
    : `<li class="ple-empty">${$('#pleQ').value ? 'Nada encontrado.' : d.src === 'mine' ? 'Você ainda não tem músicas fora da playlist.' : 'Nenhuma música pública para adicionar.'}</li>`
  const n = d.picked.size
  $('#pleAdd').disabled = !n
  $('#pleAdd').textContent = n ? `Adicionar ${n} selecionada${n === 1 ? '' : 's'}` : 'Adicionar selecionadas'
}

function drawCover() {
  const cv = $('#pleCv')
  if (d.removed) cv.style.background = pickCover(null, d.pl.id, $('#pleName').value || d.pl.name, '')
  else if (d.coverUrl) cv.style.background = `url("${d.coverUrl}") center/cover`
  else cv.style.background = playlistCover({ ...d.pl, track_ids: d.ids, cover_thumb: d.pl.cover_thumb })
  $('#pleCoverClear').hidden = !(d.coverUrl || (d.pl.cover_thumb && !d.removed))
}

async function loadCurrentCover(pl) {
  if (!pl.cover_path) return
  const { data } = await sb.storage.from(config.bucket).download(pl.cover_path)
  if (!data || d?.pl !== pl || d.coverUrl || d.removed) return
  d.currentUrl = await toDataURL(new Blob([data], { type: /\.gif$/i.test(pl.cover_path) ? 'image/gif' : 'image/jpeg' }))
  if (d?.pl === pl && !d.coverUrl && !d.removed) $('#pleCv').style.background = `url("${d.currentUrl}") center/cover`
}

export function openPlEditor(pl) {
  if (!pl || !isOwner(pl)) return toast('Só o dono da playlist pode editar.')
  d = { pl, ids: [...(pl.track_ids || [])], picked: new Set(), src: 'mine', coverBlob: null, coverUrl: null, currentUrl: null, removed: false }
  $('#pleName').value = pl.name
  $('#plePub').checked = !!pl.published
  $('#pleQ').value = ''
  $('#pleErr').textContent = ''
  $('#pleBy').innerHTML = `Autor: <b>${state.profile?.username ? `@${esc(state.profile.username)}` : 'sem username'}</b>`
  $$('#pleSrc .chip').forEach(c => c.classList.toggle('on', c.dataset.src === 'mine'))
  drawTracks()
  drawResults()
  drawCover()
  loadCurrentCover(pl)
  $('#plEditDlg').showModal()
}

async function save() {
  if (!d) return
  const pl = d.pl
  const name = $('#pleName').value.trim()
  const wantPublic = $('#plePub').checked
  const err = $('#pleErr')
  err.textContent = ''
  if (!name) return (err.textContent = 'Dê um nome para a playlist.')
  if (wantPublic && !state.profile?.username) {
    err.textContent = 'Escolha um @username para postar playlists.'
    if (state.profileOk) openUsernameDialog({ required: true })
    return
  }
  if (wantPublic && !d.ids.length) return (err.textContent = 'Adicione ao menos uma faixa para postar a playlist.')
  const btn = $('#pleSave')
  btn.disabled = true
  try {
    if (wantPublic && !(await publishTracks(d.ids))) throw new Error('tracks')
    const fields = { name, track_ids: d.ids, published: wantPublic }
    if (d.coverBlob) Object.assign(fields, await savePlaylistCover(pl, d.coverBlob))
    else if (d.removed) Object.assign(fields, await savePlaylistCover(pl, null))
    const { error } = await sb.from('playlists').update(fields).eq('id', pl.id)
    if (error) throw error
    Object.assign(pl, fields)
    state.pubPlaylists = state.pubPlaylists.filter(p => sid(p.id) !== sid(pl.id))
    if (pl.published) state.pubPlaylists.unshift(pl)
    $('#plEditDlg').close()
    renderLibrary()
    toast('Playlist salva.')
  } catch (e) {
    if (e.message !== 'tracks') {
      console.error(e)
      err.textContent = /column|published|cover_/i.test(e.message || '') ? 'Falta rodar o SQL novo no Supabase (supabase/playlists-publicas.sql).' : 'Não consegui salvar a playlist. Tente de novo.'
    }
  } finally {
    btn.disabled = false
  }
}

async function pickCoverFile(file) {
  if (!file || !d) return
  try {
    d.coverBlob = await prepareCover(file)
    d.coverUrl = await toDataURL(d.coverBlob)
    d.removed = false
    drawCover()
  } catch (e) {
    toast(e && e.message === 'gif-grande' ? 'Esse GIF passa de 4 MB. Use um menor.' : 'Não consegui abrir essa imagem.')
  }
}

export function bindPlEditor() {
  $('#pleCover').addEventListener('click', () => $('#pleFile').click())
  $('#pleFile').addEventListener('change', e => { pickCoverFile(e.target.files[0]); e.target.value = '' })
  $('#pleCoverClear').addEventListener('click', () => {
    if (!d) return
    d.coverBlob = null
    d.coverUrl = null
    d.currentUrl = null
    d.removed = true
    drawCover()
  })
  $('#pleName').addEventListener('input', () => { if (d?.removed) drawCover() })
  $('#pleQ').addEventListener('input', drawResults)
  $('#pleSrc').addEventListener('click', e => {
    const c = e.target.closest('[data-src]')
    if (!c || !d) return
    d.src = c.dataset.src
    $$('#pleSrc .chip').forEach(x => x.classList.toggle('on', x === c))
    drawResults()
  })
  $('#pleResults').addEventListener('click', e => {
    const li = e.target.closest('.ple-pick')
    if (!li || !d) return
    const id = sid(li.dataset.id)
    d.picked.has(id) ? d.picked.delete(id) : d.picked.add(id)
    drawResults()
  })
  $('#pleAdd').addEventListener('click', () => {
    if (!d || !d.picked.size) return
    const have = new Set(d.ids.map(sid))
    const add = [...(d.src === 'mine' ? state.rows : state.pub), ...state.rows, ...state.pub]
      .filter(r => d.picked.has(sid(r.id)) && !have.has(sid(r.id)))
    const seen = new Set()
    add.forEach(r => { if (!seen.has(sid(r.id))) { seen.add(sid(r.id)); d.ids.push(r.id) } })
    d.picked.clear()
    drawTracks()
    drawResults()
    drawCover()
  })
  $('#pleTracks').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]')
    const li = e.target.closest('.ple-item')
    if (!btn || !li || !d) return
    const i = d.ids.findIndex(x => sid(x) === sid(li.dataset.id))
    if (i < 0) return
    if (btn.dataset.act === 'rm') d.ids.splice(i, 1)
    if (btn.dataset.act === 'up' && i > 0) [d.ids[i - 1], d.ids[i]] = [d.ids[i], d.ids[i - 1]]
    if (btn.dataset.act === 'down' && i < d.ids.length - 1) [d.ids[i + 1], d.ids[i]] = [d.ids[i], d.ids[i + 1]]
    drawTracks()
    drawResults()
    drawCover()
  })
  $('#pleSave').addEventListener('click', save)
  $('#plEditDlg').addEventListener('close', () => { d = null })
}
