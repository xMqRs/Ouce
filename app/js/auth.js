import { config } from './config.js'
import { $, $$ } from './lib/dom.js'
import { squareJpeg, toDataURL } from './lib/image.js'
import { loadLibrary, renderLibrary } from './library.js'
import { syncQuick } from './player.js'
import { state } from './state.js'
import { sb } from './supabase.js'
import { toast } from './ui.js'

export function openAuth(mode = 'login') {
  state.authMode = mode
  $$('#authTabs .chip').forEach(c => c.classList.toggle('on', c.dataset.mode === mode))
  $('#authSubmit').textContent = mode === 'login' ? 'Entrar' : 'Criar conta'
  $('#authForm').password.autocomplete = mode === 'login' ? 'current-password' : 'new-password'
  $('#authErr').textContent = ''
  $('#authDlg').showModal()
}

const friendly = msg => {
  if (/invalid login credentials/i.test(msg)) return 'Email ou senha incorretos.'
  if (/already registered/i.test(msg)) return 'Esse email já tem cadastro. Faça login.'
  return msg
}

async function submitAuth(e) {
  e.preventDefault()
  const form = e.currentTarget
  const credentials = { email: form.email.value.trim().toLowerCase(), password: form.password.value }
  const btn = $('#authSubmit')
  btn.disabled = true
  const { data, error } = state.authMode === 'signup' ? await sb.auth.signUp(credentials) : await sb.auth.signInWithPassword(credentials)
  btn.disabled = false
  if (error) return ($('#authErr').textContent = friendly(error.message))
  if (state.authMode === 'signup' && !data.session) return ($('#authErr').textContent = 'Conta criada! Confirme seu email antes de entrar.')
  $('#authDlg').close()
}

function setAvatar(url) {
  const me = $('#me')
  me.style.backgroundImage = url ? `url("${url}")` : ''
  me.firstElementChild.hidden = !!url
}

const avatarKey = uid => `ouce_avatar_${uid}`

async function loadAvatar() {
  const uid = state.user?.id
  if (!uid) return
  let local = null
  try { local = localStorage.getItem(avatarKey(uid)) } catch {}
  if (local) setAvatar(local)
  const { data: blob } = await sb.storage.from(config.bucket).download(`${uid}/avatar.jpg`)
  if (!blob || !state.user) return
  const url = await toDataURL(new Blob([blob], { type: 'image/jpeg' }))
  if (url === local) return
  setAvatar(url)
  try { localStorage.setItem(avatarKey(uid), url) } catch {}
}

async function changeAvatar(file) {
  if (!file || !state.user) return
  let blob, url
  try {
    blob = await squareJpeg(file, 256)
    url = await toDataURL(blob)
  } catch { return toast('Não consegui abrir essa imagem.') }
  setAvatar(url)
  const uid = state.user.id
  try { localStorage.setItem(avatarKey(uid), url) } catch {}
  await sb.storage.from(config.bucket).remove([`${uid}/avatar.jpg`])
  const { error } = await sb.storage.from(config.bucket).upload(`${uid}/avatar.jpg`, blob, { contentType: 'image/jpeg' })
  if (error) console.error(error)
}

function signedIn(user) {
  state.user = user
  $('#me').classList.add('in')
  $('#accMail').textContent = user.email
  if ($('#authDlg').open) $('#authDlg').close()
  loadAvatar()
  loadLibrary()
}

function signedOut() {
  state.user = null
  state.rows = []
  state.playlists = []
  $('#me').classList.remove('in')
  setAvatar(null)
  renderLibrary(true)
  syncQuick()
}

export function bindAuth() {
  $('#me').addEventListener('click', () => (state.user ? $('#accDlg').showModal() : openAuth('login')))
  $('#accPhoto').addEventListener('click', () => $('#photo').click())
  $('#accOut').addEventListener('click', async () => { await sb.auth.signOut(); $('#accDlg').close() })
  $('#photo').addEventListener('change', e => { changeAvatar(e.target.files[0]); e.target.value = '' })
  $('#authTabs').addEventListener('click', e => {
    const tab = e.target.closest('[data-mode]')
    if (tab) openAuth(tab.dataset.mode)
  })
  $('#authForm').addEventListener('submit', submitAuth)
}

export function watchSession() {
  sb.auth.onAuthStateChange((_event, session) => {
    const next = session?.user
    if (next && state.user?.id === next.id) { state.user = next; return }
    next ? signedIn(next) : signedOut()
  })
  sb.auth.getSession().then(({ data }) => { if (data.session && !state.user) signedIn(data.session.user) })
}
