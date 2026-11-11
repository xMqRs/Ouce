import { initFaq, initProgress, initSteps, splitWords } from './motion.js'
import { initDemo } from './demo.js'
import { initReveal } from './reveal.js'
import { initStage } from './stage.js'
import { initTilt } from './tilt.js'

splitWords(document.querySelector('h1'))
initProgress()
initSteps()
initFaq()
initDemo()
initReveal()
initStage()
initTilt('.demo, .dev')
