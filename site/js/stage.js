const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const smooth = p => p * p * (3 - 2 * p)

export function initStage() {
  const stage = document.querySelector('#stage')
  const story = document.querySelector('#story')
  if (!stage || !story) return
  const record = stage.querySelector('.record')
  const grooves = stage.querySelector('.grooves')
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  const pointer = { x: 0, y: 0 }
  const pose = { ry: -26, rx: 6, slide: 40 }
  let angle = 0
  let last = performance.now()

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return
    pointer.x = e.clientX / innerWidth - 0.5
    pointer.y = e.clientY / innerHeight - 0.5
  })

  const progress = () => {
    if (matchMedia('(min-width: 901px)').matches) {
      const range = story.offsetHeight - innerHeight + 64
      return clamp((scrollY - story.offsetTop) / range)
    }
    return clamp(scrollY / (innerHeight * 0.8))
  }

  const apply = () => {
    stage.style.setProperty('--ry', `${pose.ry.toFixed(2)}deg`)
    stage.style.setProperty('--rx', `${pose.rx.toFixed(2)}deg`)
    record.style.transform = `translateX(${pose.slide.toFixed(1)}%) translateZ(calc(var(--d) * -.5))`
  }

  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const p = smooth(progress())
    const t = now / 1000
    const want = {
      ry: -26 - 154 * p + pointer.x * 18 + Math.sin(t * 0.6) * 3,
      rx: 6 + 4 * p - pointer.y * 12 + Math.sin(t * 0.45) * 1.2,
      slide: 40 + 22 * smooth(clamp(p * 1.5))
    }
    for (const key of Object.keys(pose)) pose[key] += (want[key] - pose[key]) * 0.12
    apply()
    angle += dt * (30 + 240 * p)
    grooves.style.transform = `rotate(${angle}deg)`
    requestAnimationFrame(frame)
  }

  if (calm) return apply()
  requestAnimationFrame(frame)
}
