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
  now: { id: null, blob: null, title: '', artist: '', cover: null, coverBlob: null }
}

export const cache = new Map()

export const mine = id => state.rows.find(r => sid(r.id) === sid(id))

export const byId = id => mine(id) || state.pub.find(r => sid(r.id) === sid(id))

export const audio = new Audio()

audio.preservesPitch = audio.mozPreservesPitch = audio.webkitPreservesPitch = false
