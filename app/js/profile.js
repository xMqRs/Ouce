import { $ } from './lib/dom.js'
import { renderLibrary } from './library.js'
import { state } from './state.js'
import { sb } from './supabase.js'
import { toast } from './ui.js'

// username: letras minúsculas, números, ponto e underline (3 a 20), 2 trocas a cada 30 dias
export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/
const RESERVED = new Set(['admin', 'administrador', 'ouce', 'suporte', 'support', 'moderador', 'mod', 'root', 'system', 'sistema', 'oficial', 'staff'])
const WINDOW = 30 * 24 * 60 * 60 * 1000
const LIMIT = 2

export const cleanName = s => String(s || '').trim().replace(/^@+/, '').toLowerCase()
const fmtDate = d => d.toLocaleDateString('pt-BR')

export function nameProblem(name) {
  if (!USERNAME_RE.test(name)) return 'Use de 3 a 20 caracteres: letras minúsculas, números, ponto e underline.'
  if (/^[._]|[._]$/.test(name)) return 'O username não pode começar nem terminar com ponto ou underline.'
  if (RESERVED.has(name)) return 'Esse username é reservado. Escolha outro.'
  return ''
}

export function changeInfo() {
  const now = Date.now()
  const recent = (state.profile?.changes || []).map(t => new Date(t).getTime()).filter(t => now - t < WINDOW).sort((a, b) => a - b)
  const left = Math.max(0, LIMIT - recent.length)
  return { left, next: left ? null : new Date(recent[0] + WINDOW) }
}

async function fetchProfile(uid) {
  const { data, error } = await sb.from('profiles').select('username, username_changes').eq('id', uid).maybeSingle()
  if (error) return null
  return { username: data?.username || null, changes: data?.username_changes || [] }
}

// validação do campo de username no cadastro (formato e disponibilidade)
export async function checkSignup(raw) {
  const name = cleanName(raw)
  const bad = nameProblem(name)
  if (bad) return { error: bad }
  const free = await isFree(name)
  if (free === null) return { name }
  if (!free) return { error: 'Esse username já está em uso. Tente outro.' }
  return { name }
}

export async function loadProfile() {
  const uid = state.user?.id
  if (!uid) return
  const profile = await fetchProfile(uid)
  if (state.user?.id !== uid) return
  state.profile = profile
  state.profileOk = !!profile
  syncProfileUI()
  // sem a tabela de perfis (SQL ainda não rodou) o app segue normal, sem travar ninguém
  if (profile && !profile.username) openUsernameDialog({ required: true })
}

export function clearProfile() {
  state.profile = null
  state.profileOk = null
  locked = false
  const dlg = $('#userDlg')
  if (dlg.open) dlg.close()
  syncProfileUI()
}

export function syncProfileUI() {
  const name = state.profile?.username
  $('#accUser').textContent = name ? `@${name}` : ''
  $('#accUser').hidden = !name
  $('#accInitial').textContent = (name || state.user?.email || '?')[0].toUpperCase()
  const { left: swaps, next: nextSwap } = changeInfo()
  const stuck = !!name && !swaps
  $('#accUserBtn').disabled = stuck
  $('#accUserBtn').title = stuck ? `Disponível de novo em ${fmtDate(nextSwap)}` : ''
  const box = $('#userBox')
  box.hidden = !state.user || !state.profileOk
  if (box.hidden) return
  const { left, next } = changeInfo()
  $('#setUser').textContent = name ? `@${name}` : 'Sem username'
  $('#setUserBtn').textContent = name ? 'Trocar' : 'Escolher'
  $('#setUserBtn').disabled = !!name && !left
  $('#setUserHint').textContent = !name
    ? 'Você precisa de um username para postar playlists.'
    : left
      ? `Você pode trocar 2 vezes a cada 30 dias. Restam ${left}.`
      : `Você já usou as 2 trocas. Disponível de novo em ${fmtDate(next)}.`
}

let locked = false
let step = 1
let picked = ''

function show(n) {
  step = n
  $('#userStep1').hidden = n !== 1
  $('#userStep2').hidden = n !== 2
  $('#userBack').hidden = n !== 2
  $('#userLogout').hidden = !(locked && n === 1)
  $('#userGo').textContent = n === 1 ? 'Continuar' : 'Confirmar e salvar'
  $('#userErr').textContent = ''
}

export function openUsernameDialog({ required = false } = {}) {
  const has = !!state.profile?.username
  const { left, next } = changeInfo()
  if (!required && has && !left) return toast(`Você já usou as 2 trocas. Disponível de novo em ${fmtDate(next)}.`)
  const dlg = $('#userDlg')
  const form = $('#userForm')
  locked = required
  picked = ''
  form.u1.value = ''
  form.u2.value = ''
  $('#userTitle').textContent = required ? 'Escolha seu username' : 'Trocar username'
  $('#userWhy').textContent = required
    ? 'Novidade: o Ouce agora tem playlists públicas, e o seu @username aparece como autor delas. Por isso toda conta precisa de um username. Escolha com cuidado: depois de definido, você só poderá trocá-lo 2 vezes a cada 30 dias.'
    : `Você pode trocar o username 2 vezes a cada 30 dias. Restam ${left}.`
  $('#userX').hidden = required
  show(1)
  if (!dlg.open) dlg.showModal()
  form.u1.focus()
}

async function isFree(name) {
  const { data, error } = await sb.from('profiles').select('id').eq('username', name).limit(1)
  if (error) return null
  return !(data && data.length && data[0].id !== state.user?.id)
}

async function save(name) {
  const { error } = await sb.from('profiles').upsert({ id: state.user.id, username: name }, { onConflict: 'id' })
  if (error) {
    if (error.code === '23505') { show(1); return ($('#userErr').textContent = 'Esse username acabou de ser usado por outra pessoa. Tente outro.') }
    if (/username_limit/i.test(error.message || '')) {
      await loadProfile()
      const { next } = changeInfo()
      return ($('#userErr').textContent = `Você já usou as 2 trocas. Disponível de novo em ${next ? fmtDate(next) : 'alguns dias'}.`)
    }
    console.error(error)
    return ($('#userErr').textContent = 'Não consegui salvar agora. Tente de novo.')
  }
  state.profile = (await fetchProfile(state.user.id)) || { username: name, changes: [] }
  locked = false
  $('#userDlg').close()
  syncProfileUI()
  renderLibrary()
  toast(`Pronto! Seu username agora é @${name}.`)
}

async function submit(e) {
  e.preventDefault()
  const form = e.currentTarget
  const err = $('#userErr')
  const btn = $('#userGo')
  err.textContent = ''
  if (step === 1) {
    const name = cleanName(form.u1.value)
    const bad = nameProblem(name)
    if (bad) return (err.textContent = bad)
    if (state.profile?.username === name) return (err.textContent = 'Esse já é o seu username.')
    btn.disabled = true
    const free = await isFree(name)
    btn.disabled = false
    if (free === null) return (err.textContent = 'Não consegui verificar agora. Tente de novo.')
    if (!free) return (err.textContent = 'Esse username já está em uso. Tente outro.')
    picked = name
    $('#userPicked').textContent = `@${name}`
    form.u2.value = ''
    show(2)
    form.u2.focus()
    return
  }
  if (cleanName(form.u2.value) !== picked) return (err.textContent = 'Os dois não são iguais. Digite exatamente o mesmo username.')
  btn.disabled = true
  await save(picked)
  btn.disabled = false
}

export function bindProfile() {
  const dlg = $('#userDlg')
  $('#userForm').addEventListener('submit', submit)
  $('#userBack').addEventListener('click', () => { show(1); $('#userForm').u1.focus() })
  $('#userX').addEventListener('click', () => dlg.close())
  $('#userLogout').addEventListener('click', async () => { locked = false; dlg.close(); await sb.auth.signOut() })
  $('#setUserBtn').addEventListener('click', () => openUsernameDialog({ required: false }))
  $('#accUserBtn').addEventListener('click', () => { $('#accDlg').close(); openUsernameDialog({ required: false }) })
  // enquanto o username não existe, o pop-up não fecha (nem com Esc nem reabrindo a aba)
  dlg.addEventListener('cancel', e => { if (locked) e.preventDefault() })
  dlg.addEventListener('close', () => { if (locked && state.user && !dlg.open) setTimeout(() => !dlg.open && dlg.showModal(), 0) })
}
