const POOL = 'abcdefghijklmnopqrstuvwxyz0123456789#%&*'

export function scramble(el, text, steps = 16) {
  let frame = 0
  cancelAnimationFrame(el._raf)
  const tick = () => {
    el.textContent = [...text]
      .map((c, i) => (c === ' ' || i < (frame * text.length) / steps ? c : POOL[(Math.random() * POOL.length) | 0]))
      .join('')
    if (++frame <= steps) el._raf = requestAnimationFrame(tick)
    else el.textContent = text
  }
  tick()
}

export function rotateWords(el, words, every = 2800) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  let i = 0
  setInterval(() => {
    i = (i + 1) % words.length
    scramble(el, words[i])
  }, every)
}
