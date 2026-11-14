import { esc } from './dom.js'

export const FILTERS = [
  { key: 'slowed', label: 'Slowed', test: s => s.slowed > 0 },
  { key: 'speedup', label: 'Speed up', test: s => s.speedup > 0 },
  { key: 'reverb', label: 'Reverb', test: s => s.reverb > 0 },
  { key: 'bass', label: 'Grave', test: s => s.bass > 0 }
]

export const norm = text => [...String(text)]
  .map(c => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '')[0]?.toLowerCase() ?? c)
  .join('')

export const tokensOf = query => norm(query).split(/\s+/).filter(Boolean)

const tagText = row => FILTERS
  .filter(f => f.test(row.settings || {}))
  .map(f => norm(f.label) + (f.key === 'bass' ? ' bass' : ''))
  .join(' ')

function withinOne(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

export function score(row, tokens) {
  if (!tokens.length) return 1
  const title = norm(row.title)
  const artist = norm(row.artist || '')
  const tags = tagText(row)
  const words = [...title.split(/\s+/), ...artist.split(/\s+/)]
  let total = 0
  for (const t of tokens) {
    let s = 0
    if (title.startsWith(t)) s = 4
    else if (artist.startsWith(t)) s = 3.5
    else if (words.some(w => w.startsWith(t))) s = 3
    else if (title.includes(t)) s = 2
    else if (artist.includes(t)) s = 1.8
    else if (tags.includes(t)) s = 1.2
    else if (t.length >= 4 && words.some(w => withinOne(w, t))) s = 0.8
    if (!s) return 0
    total += s
  }
  return total
}

export const passFilters = (row, active) => [...active].every(key => FILTERS.find(f => f.key === key).test(row.settings || {}))

export function highlight(text, query) {
  const chars = [...String(text)]
  const tokens = tokensOf(query)
  if (!tokens.length) return esc(chars.join(''))
  const plain = [...norm(chars.join(''))]
  const marked = new Array(chars.length).fill(false)
  for (const token of tokens) {
    const t = [...token]
    for (let i = 0; i + t.length <= plain.length; i++) {
      if (t.every((c, k) => plain[i + k] === c)) for (let k = 0; k < t.length; k++) marked[i + k] = true
    }
  }
  let out = ''
  let open = false
  chars.forEach((c, i) => {
    if (marked[i] && !open) out += '<mark>'
    if (!marked[i] && open) out += '</mark>'
    open = marked[i]
    out += esc(c)
  })
  return open ? out + '</mark>' : out
}

export function suggest(rows, query, active, limit = 5) {
  const tokens = tokensOf(query)
  if (!tokens.length) return { filters: [], tracks: [], artists: [] }
  const last = tokens[tokens.length - 1]
  const tracks = rows
    .map(r => [r, score(r, tokens)])
    .filter(([r, s]) => s > 0 && passFilters(r, active))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([r]) => r)

  const artists = new Map()
  for (const r of rows) {
    const name = (r.artist || '').trim()
    if (name && tokens.every(t => norm(name).includes(t))) artists.set(name, (artists.get(name) || 0) + 1)
  }
  const filters = last.length >= 2
    ? FILTERS.filter(f => !active.has(f.key) && (norm(f.label).startsWith(last) || (f.key === 'bass' && 'bass'.startsWith(last))))
    : []
  return {
    filters,
    tracks,
    artists: [...artists].slice(0, 2).map(([name, count]) => ({ name, count }))
  }
}
