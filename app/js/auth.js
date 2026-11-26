import { bindCaptcha, resetCaptcha, verifyCaptcha } from './captcha.js'
import { config } from './config.js'
import { $, $$ } from './lib/dom.js'
import { squareJpeg, toDataURL } from './lib/image.js'
import { loadLibrary, renderLibrary } from './library.js'
import { USERNAME_RE, checkSignup, clearProfile, loadProfile } from './profile.js'
import { syncQuick } from './player.js'
import { state } from './state.js'
import { sb } from './supabase.js'
import { toast } from './ui.js'

const MIN_PASSWORD = 6
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function setMode(mode) {
  state.authMode = mode
  const signup = mode === 'signup'
  const form = $('#authForm')
  $$('#authTabs .chip').forEach(c => c.classList.toggle('on', c.dataset.mode === mode))
  $('#authSubmit').textContent = signup ? 'Criar conta' : 'Entrar'
  // no login o campo aceita e-mail ou username; no cadastro é só e-mail
  $('#authIdLabel').textContent = signup ? 'E-MAIL' : 'E-MAIL OU USERNAME'
  form.email.type = signup ? 'email' : 'text'
  form.email.autocomplete = signup ? 'email' : 'username'
  form.email.placeholder = signup ? 'voce@email.com' : 'voce@email.com ou @username'
  form.password.autocomplete = signup ? 'new-password' : 'current-password'
  $('#authUserBox').hidden = !signup
  $('#authPass2Box').hidden = !signup
  form.password2.value = ''
  $('#authErr').textContent = ''
  hintPasswords()
  resetCaptcha()
}

export function openAuth(mode = 'login') {
  setMode(mode)
  $('#authDlg').showModal()
}

// mostra, enquanto digita, se a senha tem o mínimo e se as duas conferem
function hintPasswords() {
  const hint = $('#authPwHint')
  if (state.authMode !== 'signup') return
  const form = $('#authForm')
  const a = form.password.value
  const b = form.password2.value
  hint.className = 'hint'
  if (a && a.length < MIN_PASSWORD) { hint.textContent = `Mínimo de ${MIN_PASSWORD} caracteres (faltam ${MIN_PASSWORD - a.length}).`; hint.classList.add('bad') }
  else if (b && a !== b) { hint.textContent = 'As senhas não coincidem.'; hint.classList.add('bad') }
  else if (b && a === b) { hint.textContent = 'As senhas coincidem.'; hint.classList.add('ok') }
  else hint.textContent = `Mínimo de ${MIN_PASSWORD} caracteres.`
}

const friendly = msg => {
  if (/invalid login credentials|invalid_credentials/i.test(msg)) return 'E-mail, username ou senha incorretos.'
  if (/already registered/i.test(msg)) return 'Esse email já tem cadastro. Faça login.'
  if (/password should be at least/i.test(msg)) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`
  if (msg === '__offline') return 'Sem conexão para entrar agora. Tente de novo.'
  if (msg === '__nofn') return 'O login por username ainda não está ativado neste site. Entre com o e-mail.'
  return msg
}

// login só com o username: o servidor (Edge Function) acha o e-mail, confere a senha e devolve a sessão.
// O e-mail da pessoa nunca vai para o navegador.
async function loginByUsername(username, password) {
  let res
  try {
    res = await fetch(`${config.supabaseUrl}/functions/v1/login-username`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: config.supabaseAnonKey, authorization: `Bearer ${config.supabaseAnonKey}` },
      body: JSON.stringify({ username, password })
    })
  } catch {
    return { error: { message: '__offline' } }
  }
  if (res.status === 404) return { error: { message: '__nofn' } }
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.session) return { error: { message: body.error || 'invalid login credentials' } }
  return sb.auth.setSession(body.session)
}

async function submitAuth(e) {
  e.preventDefault()
  const form = e.currentTarget
  const err = $('#authErr')
  const signup = state.authMode === 'signup'
  const id = form.email.value.trim()
  const password = form.password.value
  err.textContent = ''
  if (!id) return (err.textContent = signup ? 'Digite seu e-mail.' : 'Digite seu e-mail ou username.')
  if (!password) return (err.textContent = 'Digite a senha.')
  const isEmail = EMAIL_RE.test(id)
  const handle = id.replace(/^@+/, '').toLowerCase()
  if (!signup && !isEmail && !USERNAME_RE.test(handle)) return (err.textContent = 'Digite um e-mail válido ou um username (por exemplo, @seunome).')
  if (signup) {
    if (!isEmail) return (err.textContent = 'Esse e-mail não parece certo.')
    if (password.length < MIN_PASSWORD) return (err.textContent = `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
    if (password !== form.password2.value) return (err.textContent = 'As duas senhas não coincidem.')
  }
  const cap = verifyCaptcha()
  if (!cap.ok) return (err.textContent = cap.error)
  const btn = $('#authSubmit')
  btn.disabled = true
  let username = ''
  if (signup) {
    const check = await checkSignup(form.username.value)
    if (check.error) { btn.disabled = false; return (err.textContent = check.error) }
    username = check.name
  }
  let result
  if (signup) result = await sb.auth.signUp({ email: id.toLowerCase(), password, options: { data: { username } } })
  else if (!isEmail) result = await loginByUsername(handle, password)
  else result = await sb.auth.signInWithPassword({ email: id.toLowerCase(), password })
  btn.disabled = false
  const { data, error } = result
  if (error) {
    err.textContent = friendly(error.message)
    resetCaptcha()
    return
  }
  if (signup && !data.session) return (err.textContent = 'Conta criada! Confirme seu email antes de entrar.')
  $('#authDlg').close()
}

// olho ao lado da senha: mostra ou esconde o que foi digitado
function toggleEye(btn) {
  const input = btn.parentElement.querySelector('input')
  const show = input.type === 'password'
  input.type = show ? 'text' : 'password'
  btn.setAttribute('aria-pressed', String(show))
  btn.setAttribute('aria-label', show ? 'Esconder senha' : 'Mostrar senha')
  btn.firstElementChild.className = show ? 'ri-eye-off-line' : 'ri-eye-line'
  input.focus()
}

function hidePasswords() {
  $$('#authForm .pw').forEach(w => {
    const input = w.querySelector('input')
    if (input.type === 'text') toggleEye(w.querySelector('.pw-eye'))
  })
}

function setAvatar(url) {
  const me = $('#me')
  me.style.backgroundImage = url ? `url("${url}")` : ''
  me.firstElementChild.hidden = !!url
  $('#accPhotoImg').style.backgroundImage = url ? `url("${url}")` : ''
  $('#accPhotoImg').classList.toggle('has', !!url)
}

// números e data de entrada do pop-up da conta
function fillAccount() {
  $('#accTracks').textContent = state.rows.length
  $('#accPubs').textContent = state.rows.filter(r => r.published).length
  $('#accLists').textContent = state.playlists.length
  const since = state.user?.created_at ? new Date(state.user.created_at) : null
  const ok = since && !isNaN(since)
  $('#accSince').hidden = !ok
  if (ok) $('#accSince').innerHTML = `<i class="ri-calendar-line"></i>Membro desde ${since.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
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
  loadProfile()
}

function signedOut() {
  state.user = null
  state.rows = []
  state.playlists = []
  clearProfile()
  $('#me').classList.remove('in')
  setAvatar(null)
  renderLibrary(true)
  syncQuick()
}

export function bindAuth() {
  $('#me').addEventListener('click', () => {
    if (!state.user) return openAuth('login')
    fillAccount()
    $('#accDlg').showModal()
  })
  $('#accPhoto').addEventListener('click', () => $('#photo').click())
  $('#accAvatar').addEventListener('click', () => $('#photo').click())
  $('#accOut').addEventListener('click', async () => { await sb.auth.signOut(); $('#accDlg').close() })
  $('#photo').addEventListener('change', e => { changeAvatar(e.target.files[0]); e.target.value = '' })
  $('#authTabs').addEventListener('click', e => {
    const tab = e.target.closest('[data-mode]')
    if (tab) setMode(tab.dataset.mode)
  })
  $('#authForm').addEventListener('submit', submitAuth)
  $('#authForm').addEventListener('click', e => {
    const eye = e.target.closest('[data-eye]')
    if (eye) toggleEye(eye)
  })
  $('#authForm').addEventListener('input', e => {
    if (e.target.name === 'password' || e.target.name === 'password2') hintPasswords()
  })
  $('#authDlg').addEventListener('close', hidePasswords)
  bindCaptcha()
}

export function watchSession() {
  sb.auth.onAuthStateChange((_event, session) => {
    const next = session?.user
    if (next && state.user?.id === next.id) { state.user = next; return }
    next ? signedIn(next) : signedOut()
  })
  sb.auth.getSession().then(({ data }) => { if (data.session && !state.user) signedIn(data.session.user) })
}
