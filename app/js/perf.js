import { store } from './lib/store.js'

// Modo leve: menos blur, menos animação e um motor de áudio mais econômico.
// Liga sozinho em tela pequena, aparelho de toque, pouca memória ou "economia de dados".
// A escolha da pessoa (Configurações) vale mais que a detecção automática.
export const perf = { lite: false }

const q = s => matchMedia(s).matches

function detect() {
  const saved = store.get('ouce_lite')
  if (saved === '1') return true
  if (saved === '0') return false
  const mem = navigator.deviceMemory
  const cores = navigator.hardwareConcurrency
  const net = navigator.connection
  return q('(pointer: coarse)') || q('(max-width: 820px)') || (!!mem && mem <= 4) || (!!cores && cores <= 4) || !!(net && net.saveData)
}

function apply(on) {
  if (on === perf.lite && document.documentElement.classList.contains('lite') === on) return
  perf.lite = on
  document.documentElement.classList.toggle('lite', on)
  const sw = document.querySelector('#liteSw')
  if (sw) sw.checked = on
  document.dispatchEvent(new CustomEvent('ouce:perf', { detail: { lite: on } }))
}

export function setLite(on) {
  store.set('ouce_lite', on ? '1' : '0')
  apply(on)
}

export function initPerf() {
  apply(detect())
  matchMedia('(max-width: 820px)').addEventListener('change', () => { if (store.get('ouce_lite') === null) apply(detect()) })
  const sw = document.querySelector('#liteSw')
  if (sw) {
    sw.checked = perf.lite
    sw.addEventListener('change', () => setLite(sw.checked))
  }
}
