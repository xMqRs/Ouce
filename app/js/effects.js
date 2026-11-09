import { applyFx } from './engine.js'
import { $, $$, paint } from './lib/dom.js'
import { FX_KEYS, presets, rateOf } from './lib/fx.js'
import { audio, state } from './state.js'
import { saveNow } from './tracks.js'

export function syncFxUI() {
  for (const key of FX_KEYS) {
    const input = $('#' + key)
    input.value = state.fx[key]
    paint(input)
    input.nextElementSibling.textContent = `${Math.round(state.fx[key] * 100)}%`
  }
  document.documentElement.style.setProperty('--rv', state.fx.reverb)
  $('#rateNote').textContent = `${rateOf(state.fx).toFixed(2)}x`
  $$('.chip[data-preset]').forEach(chip => {
    const p = presets[chip.dataset.preset]
    chip.classList.toggle('on', FX_KEYS.every(k => Math.abs(p[k] - state.fx[k]) < 0.005))
  })
}

let saveTimer

export function setFx(patch, persist = true) {
  const next = { ...state.fx, ...patch }
  if (patch.slowed > 0) next.speedup = 0
  if (patch.speedup > 0) next.slowed = 0
  state.fx = next
  applyFx()
  syncFxUI()
  if (persist) {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(saveNow, 900)
  }
}

export function drawChips() {
  $('#chips').innerHTML = Object.entries(presets)
    .map(([key, p]) => `<button class="chip" data-preset="${key}">${p.label}</button>`).join('')
}

export function bindEffects() {
  $('#chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip')
    if (chip) setFx(presets[chip.dataset.preset])
  })
  for (const key of FX_KEYS) $('#' + key).addEventListener('input', e => setFx({ [key]: +e.target.value }))
  $('#vol').addEventListener('input', e => {
    audio.volume = +e.target.value
    paint(e.target)
    e.target.nextElementSibling.textContent = `${Math.round(audio.volume * 100)}%`
  })
}
