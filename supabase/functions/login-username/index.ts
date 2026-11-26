// Login só com o username.
// O navegador não pode ver o e-mail das pessoas, então a busca do e-mail e a conferência da senha
// acontecem aqui, no servidor. A função devolve apenas a sessão (ou um erro igual para "usuário
// não existe" e "senha errada", para não revelar quais usernames existem).
//
// Publicar pelo painel do Supabase: Edge Functions, Deploy a new function, nome "login-username",
// cole este arquivo e publique. Depois, nos detalhes da função, desligue "Verify JWT".
// Publicar pelo terminal:  supabase functions deploy login-username --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/
const FAIL = { error: 'invalid login credentials' }

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(FAIL, 400)
  }

  const username = String(body?.username ?? '').trim().replace(/^@+/, '').toLowerCase()
  const password = String(body?.password ?? '')
  if (!USERNAME_RE.test(username) || !password || password.length > 200) return json(FAIL, 400)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) {
    console.error('login-username: faltam variáveis de ambiente (SUPABASE_URL, SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY)')
    return json({ error: 'server error' }, 500)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: profile, error: profileError } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
  if (profileError) {
    // normalmente: o SQL playlists-publicas.sql ainda não foi rodado (tabela profiles não existe)
    console.error('login-username: erro ao ler profiles:', profileError.message)
    return json({ error: 'server error' }, 500)
  }
  if (!profile) return json(FAIL, 400)

  const { data: found, error: lookupError } = await admin.auth.admin.getUserById(profile.id)
  const email = found?.user?.email
  if (lookupError || !email) return json(FAIL, 400)

  // o login em si passa pelo Supabase Auth, então o limite de tentativas continua valendo
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    if (error?.status === 429 || /rate limit/i.test(error?.message ?? '')) return json({ error: 'rate limit' }, 429)
    // só aparece com a senha certa, então não revela nada a quem está chutando
    if (/not confirmed/i.test(error?.message ?? '')) return json({ error: 'email not confirmed' }, 400)
    return json(FAIL, 400)
  }

  return json({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    return await handle(req)
  } catch (e) {
    console.error('login-username:', e)
    return json({ error: 'server error' }, 500)
  }
})
