export function initReveal() {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const items = document.querySelectorAll('.block h2, .defs div, .list div, .faq details, .dev, .demo')
  items.forEach((el, i) => {
    el.classList.add('r3')
    el.style.setProperty('--d', `${(i % 4) * 70}ms`)
  })
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('in')
      io.unobserve(entry.target)
    }
  }, { threshold: 0.12 })
  items.forEach(el => io.observe(el))
}
