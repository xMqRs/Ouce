import { $, $$ } from './lib/dom.js'
import { addFiles } from './tracks.js'
import { toast } from './ui.js'

let searchTimer = null
let sugTimer = null
let currentResults = []
let busyId = null

const JAMENDO_CLIENT_ID = '59357067' // Client ID público do Jamendo para testes/desenvolvimento

async function searchJamendo(query) {
  const q = encodeURIComponent(query)
  try {
    const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonjson&limit=15&search=${q}&audioformat=mp32`)
    if (!res.ok) return []
    const data = await res.json()
    if (!data || !data.results) return []
    return data.results.map(track => ({
      id: track.id,
      title: track.name || 'Sem título',
      author: track.artist_name || 'Artista desconhecido',
      duration: track.duration || 0,
      thumb: track.image || track.album_image || 'assets/cover.jpg',
      audioUrl: track.audio
    }))
  } catch (err) {
    console.error(err)
    return []
  }
}

async function fetchSuggestions(query) {
  const q = encodeURIComponent(query)
  try {
    const res = await fetch(`https://api.jamendo.com/v3.0/autocomplete/?client_id=${JAMENDO_CLIENT_ID}&format=jsonjson&prefix=${q}&limit=5`)
    if (!res.ok) return []
    const data = await res.json()
    if (!data || !data.results) return []
    return (data.results.artists || []).concat(data.results.tags || []).slice(0, 5)
  } catch {
    return []
  }
}

function renderSuggestions(list) {
  const sug = $('#ytSug')
  if (!list.length) {
    sug.hidden = true
    sug.innerHTML = ''
    return
  }
  sug.innerHTML = list
    .map(text => `<li data-sug="${text}"><i class="ri-search-line"></i><span>${text}</span></li>`)
    .join('')
  sug.hidden = false
}

function renderResults(items) {
  currentResults = items
  const ul = $('#ytResults')
  if (!items.length) {
    ul.innerHTML = ''
    return
  }
  ul.innerHTML = items
    .map((it, idx) => {
      const mins = Math.floor(it.duration / 60)
      const secs = String(it.duration % 60).padStart(2, '0')
      const dur = it.duration ? ` · ${mins}:${secs}` : ''
      return `<li class="yt-item" data-yt-idx="${idx}">
        <img class="yt-thumb" src="${it.thumb}" alt="" loading="lazy">
        <div class="yt-meta">
          <strong>${it.title}</strong>
          <span>${it.author}${dur}</span>
        </div>
        <button type="button" class="yt-pick" aria-label="Tocar música"><i class="ri-play-fill"></i></button>
      </li>`
    })
    .join('')
}

async function runSearch(query) {
  const q = query.trim()
  const status = $('#ytStatus')
  $('#ytSug').hidden = true
  if (!q) {
    status.textContent = 'Digite o nome de uma música ou artista para buscar áudio em MP3.'
    renderResults([])
    return
  }
  status.textContent = `Buscando "${q}"…`
  try {
    const results = await searchJamendo(q)
    if (!results.length) {
      status.textContent = 'Nenhum resultado encontrado.'
      renderResults([])
      return
    }
    status.textContent = 'Selecione uma música para carregar direto no player:'
    renderResults(results)
  } catch {
    status.textContent = 'Erro ao buscar músicas. Tente novamente.'
  }
}

async function selectTrack(idx) {
  const item = currentResults[idx]
  if (!item || busyId) return
  busyId = item.id
  const li = $(`[data-yt-idx="${idx}"]`)
  if (li) li.classList.add('loading')
  const status = $('#ytStatus')
  status.textContent = `Carregando "${item.title}"…`
  toast(`Baixando áudio: ${item.title}…`)

  try {
    const audioRes = await fetch(item.audioUrl)
    if (!audioRes.ok) throw new Error('Falha no download do áudio')
    const blob = await audioRes.blob()
    
    const safeName = `${item.author} - ${item.title}`.replace(/[\/:*?"<>|]/g, '').trim() || item.id
    const file = new File([blob], `${safeName}.mp3`, { type: 'audio/mpeg' })
    
    let cover = null
    try {
      const coverRes = await fetch(item.thumb)
      if (coverRes.ok) {
        const coverBlob = await coverRes.blob()
        cover = await new Promise(res => {
          const r = new FileReader()
          r.onload = () => res(r.result)
          r.onerror = () => res(null)
          r.readAsDataURL(coverBlob)
        })
      }
    } catch {}

    $('#ytDlg').close()
    await addFiles([file], {
      title: item.title,
      artist: item.author,
      ...(cover ? { cover } : {})
    })
  } catch (err) {
    console.error(err)
    status.textContent = 'Não foi possível carregar este áudio. Tente outro resultado.'
    toast('Erro ao carregar o áudio.')
  } finally {
    busyId = null
    if (li) li.classList.remove('loading')
  }
}

export function bindYtSearch() {
  const btn = $('#ytSearchBtn')
  const dlg = $('#ytDlg')
  const input = $('#ytInput')
  const clear = $('#ytClear')
  const sug = $('#ytSug')
  const results = $('#ytResults')

  if (!btn || !dlg || !input) return

  btn.addEventListener('click', () => {
    dlg.showModal()
    setTimeout(() => input.focus(), 50)
  })

  input.addEventListener('input', () => {
    const val = input.value
    clear.hidden = !val
    clearTimeout(sugTimer)
    clearTimeout(searchTimer)

    if (!val.trim()) {
      sug.hidden = true
      renderResults([])
      $('#ytStatus').textContent = 'Digite o nome de uma música ou artista para buscar áudio em MP3.'
      return
    }

    sugTimer = setTimeout(async () => {
      const list = await fetchSuggestions(val.trim())
      if (input.value.trim() === val.trim() && document.activeElement === input) {
        renderSuggestions(list)
      }
    }, 280)

    searchTimer = setTimeout(() => {
      runSearch(val)
    }, 650)
  })

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault()
      clearTimeout(searchTimer)
      runSearch(input.value)
    }
  })

  clear.addEventListener('click', () => {
    input.value = ''
    clear.hidden = true
    sug.hidden = true
    renderResults([])
    $('#ytStatus').textContent = 'Digite o nome de uma música ou artista para buscar áudio em MP3.'
    input.focus()
  })

  sug.addEventListener('click', e => {
    const li = e.target.closest('[data-sug]')
    if (!li) return
    const text = li.dataset.sug
    input.value = text
    clear.hidden = false
    sug.hidden = true
    runSearch(text)
  })

  results.addEventListener('click', e => {
    const li = e.target.closest('[data-yt-idx]')
    if (!li) return
    selectTrack(+li.dataset.ytIdx)
  })
}
