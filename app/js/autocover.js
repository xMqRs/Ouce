import { coverThumb } from './lib/image.js'

const BASE = 'assets/covers/'
const SAFE = /^[\w-][\w.-]*\.(gif|jpe?g|png|webp)$/i
const FALLBACK = [{ file: 'ponte-neve.gif' }]
const missing = new Set()
let list = null
let last = ''

const urlOf = file => new URL(BASE + file, document.baseURI).href

export const isPreset = path => typeof path === 'string' && path.startsWith('ouce:')
export const presetPath = file => `ouce:${file}`
export const presetFile = path => (isPreset(path) && SAFE.test(path.slice(5)) ? path.slice(5) : null)
export const presetUrl = file => (file && SAFE.test(file) ? urlOf(file) : null)

async function load() {
  if (list) return list
  try {
    const res = await fetch(`${BASE}covers.json`, { cache: 'no-cache' })
    const data = await res.json()
    list = (data.covers || []).filter(c => c && SAFE.test(c.file || ''))
  } catch (err) {
    console.warn('[Ouce] covers.json não carregou, usando a lista padrão.', err)
  }
  if (!list || !list.length) list = FALLBACK
  return list
}

async function exists(file) {
  if (missing.has(file)) return false
  try {
    const res = await fetch(urlOf(file), { method: 'HEAD' })
    if (res.ok) return true
  } catch {}
  missing.add(file)
  console.warn(`[Ouce] capa automática não encontrada: ${BASE}${file}`)
  return false
}

export async function pickAutoCover() {
  const all = (await load()).filter(c => !missing.has(c.file))
  while (all.length) {
    const pool = all.length > 1 ? all.filter(c => c.file !== last) : all
    const c = pool[(Math.random() * pool.length) | 0]
    if (await exists(c.file)) {
      last = c.file
      return { file: c.file, url: urlOf(c.file) }
    }
    all.splice(all.indexOf(c), 1)
  }
  return null
}

export async function presetThumb(file) {
  try {
    const res = await fetch(urlOf(file))
    return await coverThumb(await res.blob())
  } catch {
    return null
  }
}
