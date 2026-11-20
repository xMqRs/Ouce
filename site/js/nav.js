export function initNav() {
  const burger = document.querySelector('#burger')
  const menu = document.querySelector('#menu')
  if (!burger || !menu) return
  const root = document.documentElement
  const wide = matchMedia('(min-width: 901px)')

  const set = open => {
    root.classList.toggle('menu-open', open)
    burger.setAttribute('aria-expanded', String(open))
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu')
  }
  const isOpen = () => root.classList.contains('menu-open')

  burger.addEventListener('click', () => set(!isOpen()))
  menu.addEventListener('click', e => { if (e.target.closest('a')) set(false) })
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) { set(false); burger.focus() }
  })
  wide.addEventListener('change', e => { if (e.matches) set(false) })
}
