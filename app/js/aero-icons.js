// Ícones do tema Frutiger Aero: capas de vidro e brilho, desenhadas em SVG.
// A escolha é fixa para cada música (palavras do título/artista, senão pelo nome).
import { hash } from './lib/dom.js'

const GLYPHS = {
 "note": "<g fill=\"currentColor\"><ellipse cx=\"44\" cy=\"90\" rx=\"15\" ry=\"11\" transform=\"rotate(-20 44 90)\"/><ellipse cx=\"88\" cy=\"80\" rx=\"15\" ry=\"11\" transform=\"rotate(-20 88 80)\"/><path d=\"M54 88V42h7v46zM98 78V32h7v46z\"/><path d=\"M54 40L105 28V46L54 58z\"/></g>",
 "headphones": "<g><path d=\"M30 80V68a34 34 0 0 1 68 0v12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"22\" y=\"72\" width=\"20\" height=\"32\" rx=\"9\" fill=\"currentColor\"/><rect x=\"86\" y=\"72\" width=\"20\" height=\"32\" rx=\"9\" fill=\"currentColor\"/></g>",
 "disc": "<g><circle cx=\"64\" cy=\"64\" r=\"38\" fill=\"currentColor\"/><circle cx=\"64\" cy=\"64\" r=\"9\" fill=\"#000\" opacity=\".28\"/><circle cx=\"64\" cy=\"64\" r=\"24\" fill=\"none\" stroke=\"#000\" stroke-opacity=\".12\" stroke-width=\"3\"/></g>",
 "speaker": "<g><path d=\"M26 52h18l24-20v64L44 76H26z\" fill=\"currentColor\"/><path d=\"M80 50a20 20 0 0 1 0 28M90 38a36 36 0 0 1 0 52\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
 "mic": "<g><rect x=\"50\" y=\"22\" width=\"28\" height=\"48\" rx=\"14\" fill=\"currentColor\"/><path d=\"M38 62a26 26 0 0 0 52 0M64 88v14M48 104h32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g>",
 "heart": "<path d=\"M64 102C18 70 22 36 44 32c12-2 18 6 20 12 2-6 8-14 20-12 22 4 26 38-20 70z\" fill=\"currentColor\"/>",
 "star": "<polygon points=\"64.0,28.0 74.0,54.2 102.0,55.6 80.2,73.3 87.5,100.4 64.0,85.0 40.5,100.4 47.8,73.3 26.0,55.6 54.0,54.2\" fill=\"currentColor\" stroke=\"currentColor\" stroke-width=\"6\" stroke-linejoin=\"round\"/>",
 "moon": "<path d=\"M82 26A40 40 0 1 0 102 92 32 32 0 0 1 82 26z\" fill=\"currentColor\"/>",
 "sun": "<g><circle cx=\"64\" cy=\"64\" r=\"20\" fill=\"currentColor\"/><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"7\"><path d=\"M96.0 64.0L110.0 64.0\"/><path d=\"M86.6 86.6L96.5 96.5\"/><path d=\"M64.0 96.0L64.0 110.0\"/><path d=\"M41.4 86.6L31.5 96.5\"/><path d=\"M32.0 64.0L18.0 64.0\"/><path d=\"M41.4 41.4L31.5 31.5\"/><path d=\"M64.0 32.0L64.0 18.0\"/><path d=\"M86.6 41.4L96.5 31.5\"/></g></g>",
 "cloud": "<g fill=\"currentColor\"><circle cx=\"46\" cy=\"76\" r=\"18\"/><circle cx=\"68\" cy=\"60\" r=\"23\"/><circle cx=\"92\" cy=\"78\" r=\"16\"/><rect x=\"46\" y=\"76\" width=\"46\" height=\"18\"/></g>",
 "drop": "<path d=\"M64 22C64 22 34 60 34 80a30 30 0 0 0 60 0C94 60 64 22 64 22z\" fill=\"currentColor\"/>",
 "wave": "<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M22 54q10-14 21 0t21 0 21 0 21 0\"/><path d=\"M22 76q10-14 21 0t21 0 21 0 21 0\"/><path d=\"M22 98q10-14 21 0t21 0 21 0 21 0\"/></g>",
 "leaf": "<g><path d=\"M28 98C26 52 58 26 102 26C102 72 76 100 28 98z\" fill=\"currentColor\"/><path d=\"M32 94C54 70 72 54 94 38\" fill=\"none\" stroke=\"#000\" stroke-opacity=\".22\" stroke-width=\"5\" stroke-linecap=\"round\"/></g>",
 "bubble": "<g><circle cx=\"64\" cy=\"66\" r=\"36\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"8\"/><path d=\"M44 54a24 24 0 0 1 16-14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"6\"/><circle cx=\"96\" cy=\"36\" r=\"8\" fill=\"currentColor\"/><circle cx=\"30\" cy=\"96\" r=\"5\" fill=\"currentColor\"/></g>",
 "flower": "<g fill=\"currentColor\"><circle cx=\"64.0\" cy=\"40.0\" r=\"17\"/><circle cx=\"86.8\" cy=\"56.6\" r=\"17\"/><circle cx=\"78.1\" cy=\"83.4\" r=\"17\"/><circle cx=\"49.9\" cy=\"83.4\" r=\"17\"/><circle cx=\"41.2\" cy=\"56.6\" r=\"17\"/><circle cx=\"64\" cy=\"64\" r=\"12\" fill=\"#000\" opacity=\".22\"/></g>",
 "bolt": "<polygon points=\"74,20 38,72 60,72 52,108 90,54 68,54\" fill=\"currentColor\" stroke=\"currentColor\" stroke-width=\"5\" stroke-linejoin=\"round\"/>",
 "flame": "<g fill=\"currentColor\"><path d=\"M66 18C62 42 38 54 38 80a26 26 0 0 0 52 0C90 64 80 56 76 40 72 50 68 46 66 18z\"/><path d=\"M64 66C72 76 78 84 70 94a13 13 0 0 1-22-10C48 76 58 74 64 66z\" fill=\"#000\" opacity=\".2\"/></g>",
 "globe": "<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"7\"><circle cx=\"64\" cy=\"64\" r=\"38\"/><ellipse cx=\"64\" cy=\"64\" rx=\"16\" ry=\"38\"/><path d=\"M28 50h72M28 78h72\"/></g>",
 "piano": "<g><rect x=\"24\" y=\"34\" width=\"80\" height=\"60\" rx=\"8\" fill=\"currentColor\"/><path d=\"M44 34v60M64 34v60M84 34v60\" stroke=\"#000\" stroke-opacity=\".25\" stroke-width=\"3\"/><rect x=\"38\" y=\"34\" width=\"12\" height=\"34\" rx=\"3\" fill=\"#000\" opacity=\".5\"/><rect x=\"58\" y=\"34\" width=\"12\" height=\"34\" rx=\"3\" fill=\"#000\" opacity=\".5\"/><rect x=\"78\" y=\"34\" width=\"12\" height=\"34\" rx=\"3\" fill=\"#000\" opacity=\".5\"/></g>",
 "butterfly": "<g fill=\"currentColor\"><path d=\"M62 62C40 22 14 34 24 60c6 14 24 10 38 2zM66 62C88 22 114 34 104 60c-6 14-24 10-38 2z\"/><path d=\"M62 68C46 70 34 90 44 100c10 8 20-8 18-32zM66 68C82 70 94 90 84 100c-10 8-20-8-18-32z\"/><rect x=\"61\" y=\"40\" width=\"6\" height=\"52\" rx=\"3\"/></g>",
 "fish": "<g fill=\"currentColor\"><path d=\"M22 64C40 34 78 32 98 64 78 96 40 94 22 64z\"/><path d=\"M92 64L112 44V84z\"/><circle cx=\"46\" cy=\"58\" r=\"5\" fill=\"#000\" opacity=\".35\"/></g>"
}

const TILES = {"blue": ["#7fd9ff", "#0a86d6", "#5ff0ff"], "aqua": ["#7cf0ea", "#0b9fb8", "#a7ffd8"], "green": ["#b8f48a", "#2fa83a", "#e5ff9a"]}

// palavras que combinam com cada ícone
const WORDS = [
  ['heart', /love|amor|cora[cç][aã]o|heart|baby|beijo|kiss|paix[aã]o|namor/],
  ['moon', /moon|lua|night|noite|sleep|sono|dream|sonho|dark|escuro|midnight|insone/],
  ['sun', /\bsun|\bsol\b|summer|ver[aã]o|morning|manh[aã]|day\b|dia\b|light|luz|gold|dourado/],
  ['cloud', /cloud|nuvem|rain|chuva|sky|c[eé]u|storm|tempest|nublado|fog|neblina/],
  ['flame', /fire|fogo|burn|queima|hot|quente|flame|chama|inferno|devil|diabo/],
  ['star', /star|estrela|galaxy|gal[aá]xia|space|espa[cç]o|cosmos|universe|universo|shine|brilh/],
  ['wave', /ocean|oceano|sea\b|mar\b|wave|onda|beach|praia|surf|blue\b|azul/],
  ['drop', /water|[aá]gua|tear|l[aá]grima|cry|chora|river|rio\b|drop|gota/],
  ['leaf', /tree|[aá]rvore|leaf|folha|forest|floresta|nature|natureza|green|verde|jungle|selva/],
  ['flower', /flower|flor\b|rose|rosa\b|garden|jardim|spring|primavera|bloom/],
  ['bolt', /rock|metal|electric|el[eé]trico|thunder|trov[aã]o|energy|energia|power|poder|punk|rage/],
  ['speaker', /dance|dan[cç]a|party|festa|club|bass|baile|funk|dj\b|remix|phonk|techno|house/],
  ['piano', /piano|jazz|classic|cl[aá]ssic|instrumental|orchestra|orquestra|chopin|mozart|beethoven/],
  ['mic', /rap\b|hip.?hop|trap|freestyle|voice|voz|live\b|ao vivo|acoustic|ac[uú]stic/],
  ['globe', /world|mundo|travel|viagem|road|estrada|city|cidade|tokyo|japan|brasil|brazil|global/],
  ['butterfly', /butterfly|borboleta|fly\b|voar|wings|asas|angel|anjo|free|livre/],
  ['fish', /fish|peixe|aqua|submarin|sea life|dive|mergulho|nemo/],
  ['headphones', /lofi|lo-fi|chill|relax|study|estudo|focus|foco|calm|calmo|slowed|reverb|ambient|ambiente/]
]

// neutros: combinam com qualquer estilo
const NEUTRAL = ['note', 'headphones', 'disc', 'speaker', 'star', 'wave', 'bubble', 'drop', 'globe']
const FAMILIES = ['blue', 'aqua', 'green']
const cache = new Map()

function tile(name, family) {
  const [top, base, glow] = TILES[family]
  const g = GLYPHS[name]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${base}"/></linearGradient>
<radialGradient id="r" cx=".5" cy="1.08" r=".8"><stop offset="0" stop-color="${glow}" stop-opacity=".9"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity=".06"/></linearGradient>
</defs>
<rect width="128" height="128" fill="url(#b)"/>
<rect width="128" height="128" fill="url(#r)"/>
<g style="color:#04426e" opacity=".32" transform="translate(0 4)">${g}</g>
<g style="color:#fff">${g}</g>
<ellipse cx="64" cy="-10" rx="104" ry="62" fill="url(#g)"/>
<circle cx="22" cy="106" r="6" fill="#fff" opacity=".4"/><circle cx="34" cy="116" r="3" fill="#fff" opacity=".35"/>
</svg>`
}

export function aeroIconName(title = '', artist = '') {
  const text = `${title} ${artist}`.toLowerCase()
  for (const [name, re] of WORDS) if (re.test(text)) return name
  return NEUTRAL[hash(text || 'ouce') % NEUTRAL.length]
}

// valor pronto para a propriedade CSS background
export function aeroCover(title, artist) {
  const name = aeroIconName(title, artist)
  const family = FAMILIES[hash(`${title}|${artist}`) % FAMILIES.length]
  const key = `${name}|${family}`
  if (!cache.has(key)) cache.set(key, `url("data:image/svg+xml,${encodeURIComponent(tile(name, family))}") center/cover`)
  return cache.get(key)
}
