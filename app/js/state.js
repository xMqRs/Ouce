import { sid } from './lib/dom.js'

export const state = {
  user: null,
  rows: [],
  pub: [],
  playlists: [],
  open: new Set(),
  tab: 'library',
  query: '',
  filters: new Set(),
  sort: 'recent',
  queue: [],
  shuffle: false,
  repeat: 0,
  picking: null,
  counted: false,
  authMode: 'login',
  fx: { slowed: 0, speedup: 0, reverb: 0, bass: 0 },
  editor: { on: false },
  source: null,
  now: { id: null, blob: null, title: '', artist: '', cover: null, coverBlob: null }
}

export const cache = new Map()

export const mine = id => state.rows.find(r => sid(r.id) === sid(id))

export const ADMIN_EMAIL = 'contato.xmqr@gmail.com'

export const isAdmin = () => !!state.user && String(state.user.email || '').toLowerCase() === ADMIN_EMAIL

// Músicas que o usuário pode editar: as dele e, para a conta admin, as da biblioteca pública.
// A permissão de verdade fica nas policies do Supabase (supabase/admin.sql).
export const canEdit = id => mine(id) || (isAdmin() ? state.pub.find(r => sid(r.id) === sid(id)) : undefined)

export const byId = id => mine(id) || state.pub.find(r => sid(r.id) === sid(id))

export const audio = new Audio()

audio.preservesPitch = audio.mozPreservesPitch = audio.webkitPreservesPitch = false
