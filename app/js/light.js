// Luz do tema Liquid Glass: o reflexo e a borda iluminada dos painéis seguem o ponteiro
// no computador. Só trabalha com o tema ativo e fica parada no modo leve.
import { perf } from './perf.js'

export function initLight() {
  const root = document.documentElement
  let lx = 0.18
  let ly = 0.1
  let shown = ''
  let raf = 0

  const paint = () => {
    raf = 0
    const key = `${lx.toFixed(2)}|${ly.toFixed(2)}`
    if (key === shown) return
    shown = key
    root.style.setProperty('--lx', lx.toFixed(2))
    root.style.setProperty('--ly', ly.toFixed(2))
  }
  const push = (x, y) => {
    if (root.dataset.style !== 'glass' || perf.lite) return
    // passos de 0,05: cada mudança repinta os painéis de vidro, então menos mudanças = mais fluidez
    lx = Math.round(Math.min(1, Math.max(0, x)) * 20) / 20
    ly = Math.round(Math.min(1, Math.max(0, y)) * 20) / 20
    if (!raf) raf = requestAnimationFrame(paint)
  }

  addEventListener('pointermove', e => push(e.clientX / innerWidth, e.clientY / innerHeight), { passive: true })
}
