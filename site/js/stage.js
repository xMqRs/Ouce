export function initStage() {
  const stage = document.querySelector('#stage')
  if (!stage || matchMedia('(pointer: coarse)').matches) return
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return
    const x = e.clientX / innerWidth - 0.5
    const y = e.clientY / innerHeight - 0.5
    stage.style.setProperty('--ry', `${-26 + x * 24}deg`)
    stage.style.setProperty('--rx', `${6 - y * 14}deg`)
  })
}
