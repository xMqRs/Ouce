import { initFaq, initBand, initProgress, initSteps, splitWords } from './motion.js'
import { initDemo } from './demo.js'
import { initReveal } from './reveal.js'
import { initStage } from './stage.js'

splitWords(document.querySelector('h1'))
initProgress()
initBand()
initSteps()
initFaq()
initDemo()
initReveal()
initStage()
