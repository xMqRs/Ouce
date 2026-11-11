export function initTilt(selector) {
  if (matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  document.querySelectorAll(selector).forEach(card => {
    let box
    card.addEventListener('pointerenter', e => {
      if (e.pointerType === 'mouse') box = card.getBoundingClientRect()
    })
    card.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !box) return
      const x = (e.clientX - box.left) / box.width - 0.5
      const y = (e.clientY - box.top) / box.height - 0.5
      card.style.transform = `perspective(1000px) rotateY(${(x * 7).toFixed(2)}deg) rotateX(${(-y * 7).toFixed(2)}deg)`
    })
    card.addEventListener('pointerleave', () => { card.style.transform = '' })
  })
}
