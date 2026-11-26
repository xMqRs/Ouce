import { $ } from './lib/dom.js'

// Captcha do cadastro e do login: a caixinha "Não sou um robô" do próprio Ouce.
// Funciona com uma isca escondida (robôs preenchem, pessoas não), um tempo mínimo com o pop-up aberto
// e só aceita clique de verdade (script não marca a caixinha). Barra robôs simples.
let ok = false
let openedAt = 0

function paint(state) {
  const box = $('#capLocal')
  box.classList.toggle('busy', state === 'busy')
  box.classList.toggle('done', state === 'done')
  $('#capCheck').checked = state === 'done'
  $('#capText').textContent = state === 'busy' ? 'Verificando…' : state === 'done' ? 'Verificado, você não é um robô' : 'Não sou um robô'
}

// chamado ao abrir o pop-up, ao trocar entre entrar e criar conta e depois de uma tentativa que falhou
export function resetCaptcha() {
  ok = false
  openedAt = Date.now()
  $('#authForm').website.value = ''
  paint('idle')
}

export function verifyCaptcha() {
  if ($('#authForm').website.value) return { ok: false, error: 'Não consegui confirmar que você é uma pessoa.' }
  return ok ? { ok: true } : { ok: false, error: 'Marque a caixinha "Não sou um robô".' }
}

export function bindCaptcha() {
  $('#capCheck').addEventListener('click', e => {
    e.preventDefault()
    if (!e.isTrusted || ok) return
    paint('busy')
    setTimeout(() => {
      const human = !$('#authForm').website.value && Date.now() - openedAt > 700
      ok = human
      paint(human ? 'done' : 'idle')
      if (!human) $('#authErr').textContent = 'Não consegui confirmar. Tente de novo.'
    }, 650)
  })
}
