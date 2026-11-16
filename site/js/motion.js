const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches

export function splitWords(el) {
  if (!el || calm) return
  const text = el.textContent.trim()
  el.setAttribute('aria-label', text)
  el.textContent = ''
  text.split(/\s+/).forEach((word, i) => {
    const outer = document.createElement('span')
    outer.className = 'w'
    outer.setAttribute('aria-hidden', 'true')
    const inner = document.createElement('span')
    inner.textContent = word
    inner.style.setProperty('--i', i)
    outer.style.setProperty('--z', [34, 0, 52, 14, 40, 6, 26][i % 7])
    outer.append(inner)
    el.append(outer, ' ')
  })
}

export function initProgress() {
  const bar = document.querySelector('#progress')
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight
    bar.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max) : 0})`
  }
  addEventListener('scroll', update, { passive: true })
  addEventListener('resize', update)
  update()
}

export function initSteps() {
  const list = document.querySelector('.steps')
  if (!list) return
  const items = [...list.children]
  const update = () => {
    const r = list.getBoundingClientRect()
    const line = innerHeight * 0.62
    list.style.setProperty('--p', clamp((line - r.top) / r.height).toFixed(3))
    items.forEach(li => {
      const on = li.getBoundingClientRect().top < line
      li.classList.toggle('on', on)
      if (on && !li.dataset.flipped && !calm) {
        li.dataset.flipped = '1'
        li.querySelector('.num').classList.add('flip')
      }
    })
  }
  addEventListener('scroll', update, { passive: true })
  addEventListener('resize', update)
  update()
}

export function initFaq() {
  if (calm) return
  document.querySelectorAll('.faq details').forEach(d => {
    const summary = d.querySelector('summary')
    let anim = null
    summary.addEventListener('click', e => {
      e.preventDefault()
      if (anim) anim.cancel()
      const from = d.offsetHeight
      const options = { duration: 320, easing: 'cubic-bezier(.7,0,.2,1)' }
      d.style.overflow = 'hidden'
      if (d.open) {
        anim = d.animate({ height: [`${from}px`, `${summary.offsetHeight}px`] }, options)
        anim.onfinish = () => { d.open = false; d.style.overflow = ''; anim = null }
      } else {
        d.open = true
        anim = d.animate({ height: [`${from}px`, `${d.offsetHeight}px`] }, options)
        anim.onfinish = () => { d.style.overflow = ''; anim = null }
      }
    })
  })
}
