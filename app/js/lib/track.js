import { aeroCover } from '../aero-icons.js'
import { look } from '../theme.js'
import { hash, sid } from './dom.js'

const covers = [
  a => `linear-gradient(${a}deg,var(--accent),#0b0b0b)`,
  a => `conic-gradient(from ${a}deg,var(--accent-lo),var(--accent-hi),#0b0b0b,var(--accent-lo))`,
  a => `radial-gradient(circle at ${a % 100}% 30%,var(--accent-hi),var(--accent) 40%,#0f0f0f)`,
  a => `linear-gradient(${a}deg,#0f0f0f,var(--accent) 70%,var(--accent-hi))`
]

// capa da música: no tema Frutiger Aero vira um ícone de vidro; nos outros, a imagem ou o degradê
export const pickCover = (src, id, title, artist) =>
  look.current === 'aero' ? aeroCover(title, artist) : src ? `url("${src}") center/cover` : coverOf(id)

export const coverOf = key => { const h = hash(sid(key)); return covers[h % 4](h % 360) }

export const tagOf = s => {
  if (!s) return ''
  const parts = []
  if (s.slowed > 0) parts.push('slowed')
  if (s.speedup > 0) parts.push('speed up')
  if (s.reverb > 0) parts.push('reverb')
  if (s.bass > 0) parts.push('bass')
  return parts.join(' + ')
}
