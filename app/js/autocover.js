import { coverThumb } from './lib/image.js'

const BASE = 'assets/covers/'
const SAFE = /^[\w-][\w.-]*\.(gif|jpe?g|png|webp)$/i
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
  } catch {
    list = []
  }
  return list
}

export async function pickAutoCover() {
  const all = await load()
  if (!all.length) return null
  const pool = all.length > 1 ? all.filter(c => c.file !== last) : all
  const c = pool[(Math.random() * pool.length) | 0]
  last = c.file
  return { file: c.file, url: urlOf(c.file) }
}

export async function presetThumb(file) {
  try {
    const res = await fetch(urlOf(file))
    return await coverThumb(await res.blob())
  } catch {
    return null
  }
}
