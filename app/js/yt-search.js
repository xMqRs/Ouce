import { $, $$, esc, fmt } from './lib/dom.js'
import { addFiles } from './tracks.js'
import { toast } from './ui.js'

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.tokhmi.xyz'
]

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.jing.rocks'
]

let searchTimer = null
let sugTimer = null
let currentResults = []
let busyId = null

async function fetchJsonWithFallback(urls, timeoutMs = 6000) {
  for (const url of urls) {
    const ctrl = new AbortController()
    const id = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      clearTimeout(id)
      if (!res.ok) continue
      return await res.json()
    } catch {
      clearTimeout(id)
    }
  }
  throw new Error('offline')
}

async function fetchSuggestions(query) {
  const q = encodeURIComponent(query)
  try {
    const data = await fetchJsonWithFallback(
      PIPED_INSTANCES.map(base => `${base}/suggestions?query=${q}`),
      3000
    )
    if (Array.isArray(data)) return data.slice(0, 5)
  } catch {}
  try {
    const data = await fetchJsonWithFallback(
      INVIDIOUS_INSTANCES.map(base => `${base}/api/v1/search/suggestions?q=${q}`),
      3000
    )
    if (data && Array.isArray(data.suggestions)) return data.suggestions.slice(0, 5)
  } catch {}
  return []
}

async function searchYoutube(query) {
  const q = encodeURIComponent(query)
  try {
    const data = await fetchJsonWithFallback(
      PIPED_INSTANCES.map(base => `${base}/search?q=${q}&filter=music_songs`)
    )
    const items = (data && data.items ? data.items : []).filter(it => it.url && it.url.includes('/watch?v='))
    if (items.length) {
      return items.slice(0, 15).map(it => {
        const videoId = new URL(it.url, 'https://youtube.com').searchParams.get('v')
        return {
          id: videoId,
          title: it.title || 'Sem título',
          author: it.uploaderName || 'YouTube',
          duration: it.duration || 0,
          thumb: it.thumbnail || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
        }
      })
    }
  } catch {}

  const invData = await fetchJsonWithFallback(
    INVIDIOUS_INSTANCES.map(base => `${base}/api/v1/search?q=${q}&type=video`)
  )
  if (Array.isArray(invData) && invData.length) {
    return invData.slice(0, 15).map(it => ({
      id: it.videoId,
      title: it.title || 'Sem título',
      author: it.author || 'YouTube',
      duration: it.lengthSeconds || 0,
      thumb: (it.videoThumbnails && it.videoThumbnails[0] && it.videoThumbnails[0].url) || `https://i.ytimg.com/vi/${it.videoId}/mqdefault.jpg`
    }))
  }
  return []
}

async function fetchAudioBlob(videoId) {
  // 1. Tenta baixar através do proxy de áudio do Invidious (contorna restrições de IP)
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const proxyUrl = `${base}/latest_version?id=${videoId}&itag=140&local=true`
      const res = await fetch(proxyUrl)
      if (res.ok) {
        const blob = await res.blob()
        if (blob.size > 20000) return blob
      }
    } catch {}
  }

  // 2. Tenta via streams do Piped utilizando requisição com modo cors se possível
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`)
      if (!res.ok) continue
      const data = await res.json()
      const streams = (data.audioStreams || []).filter(s => s.url)
      if (!streams.length) continue
      streams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
      
      for (const stream of streams) {
        try {
          const targetUrl = stream.url.startsWith('http') ? stream.url : `${base}${stream.url}`
          const audioRes = await fetch(targetUrl, { mode: 'cors' })
          if (audioRes.ok) {
            const blob = await audioRes.blob()
            if (blob.size > 20000) return blob
          }
        } catch {}
      }
    } catch {}
  }

  throw new Error('stream-unavailable')
}

async function fetchCoverDataUrl(thumbUrl) {
  try {
    const res = await fetch(thumbUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise(resolve => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
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
    .map(text => `<li data-sug="${esc(text)}"><i class="ri-search-line"></i><span>${esc(text)}</span></li>`)
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
      const dur = it.duration ? ` · ${fmt(it.duration)}` : ''
      return `<li class="yt-item" data-yt-idx="${idx}">
        <img class="yt-thumb" src="${esc(it.thumb)}" alt="" loading="lazy">
        <div class="yt-meta">
          <strong>${esc(it.title)}</strong>
          <span>${esc(it.author)}${dur}</span>
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
    status.textContent = 'Digite algo para buscar no YouTube e carregar o áudio direto no player.'
    renderResults([])
    return
  }
  status.textContent = `Buscando "${q}" no YouTube…`
  try {
    const results = await searchYoutube(q)
    if (!results.length) {
      status.textContent = 'Nenhum resultado encontrado.'
      renderResults([])
      return
    }
    status.textContent = 'Selecione uma música para extrair o áudio e tocar:'
    renderResults(results)
  } catch {
    status.textContent = 'Não foi possível conectar à busca do YouTube agora. Tente novamente.'
  }
}

async function selectTrack(idx) {
  const item = currentResults[idx]
  if (!item || busyId) return
  busyId = item.id
  const li = $(`[data-yt-idx="${idx}"]`)
  if (li) li.classList.add('loading')
  const status = $('#ytStatus')
  status.textContent = `Baixando áudio de "${item.title}"…`
  toast(`Preparando áudio: ${item.title}…`)

  try {
    const blob = await fetchAudioBlob(item.id)
    const safeName = `${item.author} - ${item.title}`.replace(/[\\/:*?"<>|]/g, '').trim() || item.id
    const file = new File([blob], `${safeName}.mp3`, { type: 'audio/mpeg' })
    const cover = await fetchCoverDataUrl(item.thumb)

    $('#ytDlg').close()
    await addFiles([file], {
      title: item.title,
      artist: item.author,
      ...(cover ? { cover } : {})
    })
  } catch {
    status.textContent = 'Erro ao processar o áudio. O YouTube impôs proteções nesta faixa. Tente outro resultado.'
    toast('Falha ao obter o áudio. Tente outra música.')
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
      $('#ytStatus').textContent = 'Digite algo para buscar no YouTube e carregar o áudio direto no player.'
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
    $('#ytStatus').textContent = 'Digite algo para buscar no YouTube e carregar o áudio direto no player.'
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
