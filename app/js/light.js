// Luz do tema Liquid Glass: o reflexo e a borda iluminada dos painéis seguem o ponteiro
// (ou o giro do aparelho no celular). Só trabalha com o tema ativo.
export function initLight() {
  const root = document.documentElement
  const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches
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
    if (root.dataset.style !== 'glass') return
    lx = Math.min(1, Math.max(0, x))
    ly = Math.min(1, Math.max(0, y))
    if (!raf) raf = requestAnimationFrame(paint)
  }

  addEventListener('pointermove', e => push(e.clientX / innerWidth, e.clientY / innerHeight), { passive: true })
  if (!quiet) {
    addEventListener('deviceorientation', e => {
      if (e.gamma == null || e.beta == null) return
      push(0.5 + Math.max(-30, Math.min(30, e.gamma)) / 60, 0.5 + Math.max(-30, Math.min(30, e.beta - 45)) / 60)
    }, { passive: true })
  }
}
