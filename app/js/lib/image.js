export const GIF_LIMIT = 4 * 1024 * 1024

export async function squareJpeg(file, size) {
  const bmp = await createImageBitmap(file)
  const side = Math.min(bmp.width, bmp.height)
  const cv = Object.assign(document.createElement('canvas'), { width: size, height: size })
  cv.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size)
  bmp.close && bmp.close()
  return new Promise(done => cv.toBlob(done, 'image/jpeg', 0.86))
}

export const toDataURL = blob => new Promise(done => {
  const reader = new FileReader()
  reader.onload = () => done(reader.result)
  reader.readAsDataURL(blob)
})

export function sniffImage(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp'
  return null
}

export const coverExt = blob => (blob && blob.type === 'image/gif' ? 'gif' : 'jpg')
export const coverMime = path => (/\.gif$/i.test(path || '') ? 'image/gif' : 'image/jpeg')

// Capa escolhida pelo usuário: GIF fica como está (para continuar animado), o resto vira JPEG quadrado.
export async function prepareCover(file) {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (sniffImage(head) === 'image/gif') {
    if (file.size > GIF_LIMIT) throw new Error('gif-grande')
    return new Blob([file], { type: 'image/gif' })
  }
  const jpg = await squareJpeg(file, 512)
  if (!jpg) throw new Error('imagem')
  return jpg
}

export async function coverThumb(blob) {
  return toDataURL(await squareJpeg(blob, 96))
}

const bytes = async (blob, start, len) => new Uint8Array(await blob.slice(start, start + len).arrayBuffer())
const text = (b, from, to) => { let s = ''; for (let i = from; i < to && i < b.length; i++) s += String.fromCharCode(b[i]); return s }
const synch = (b, i) => (b[i] << 21) | (b[i + 1] << 14) | (b[i + 2] << 7) | b[i + 3]
const be32 = (b, i) => b[i] * 16777216 + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]
const be24 = (b, i) => (b[i] << 16) + (b[i + 1] << 8) + b[i + 2]
const pack = (data, hint) => {
  const mime = sniffImage(data) || (hint && hint.includes('/') ? hint : 'image/jpeg')
  return new Blob([data], { type: mime === 'image/jpg' ? 'image/jpeg' : mime })
}

function unsync(b) {
  const out = new Uint8Array(b.length)
  let n = 0
  for (let i = 0; i < b.length; i++) {
    out[n++] = b[i]
    if (b[i] === 0xff && b[i + 1] === 0) i++
  }
  return out.slice(0, n)
}

function pictureFrame(f, v22) {
  if (f.length < 8) return null
  const enc = f[0]
  let i = 1
  let hint = ''
  if (v22) {
    hint = 'image/' + text(f, 1, 4).toLowerCase().replace('jpg', 'jpeg')
    i = 4
  } else {
    while (i < f.length && f[i] !== 0) i++
    hint = text(f, 1, i)
    i++
  }
  const type = f[i++]
  if (enc === 1 || enc === 2) {
    while (i + 1 < f.length && !(f[i] === 0 && f[i + 1] === 0)) i += 2
    i += 2
  } else {
    while (i < f.length && f[i] !== 0) i++
    i++
  }
  return i < f.length ? { type, data: f.slice(i), hint } : null
}

async function id3Cover(blob, head) {
  const ver = head[3]
  const flags = head[5]
  if (ver < 2 || ver > 4) return null
  const size = synch(head, 6)
  let buf = await bytes(blob, 10, Math.min(size, 24e6))
  if (flags & 0x80 && ver < 4) buf = unsync(buf)
  let p = 0
  if (flags & 0x40) p = ver === 3 ? 4 + be32(buf, 0) : synch(buf, 0)
  const v22 = ver === 2
  const idLen = v22 ? 3 : 4
  const hdr = v22 ? 6 : 10
  const found = []
  while (p + hdr < buf.length) {
    const id = text(buf, p, p + idLen)
    if (!/^[A-Z0-9]+$/.test(id) || id.length !== idLen) break
    const len = v22 ? be24(buf, p + 3) : ver === 4 ? synch(buf, p + 4) : be32(buf, p + 4)
    if (len <= 0 || p + hdr + len > buf.length) break
    if (id === (v22 ? 'PIC' : 'APIC')) {
      const fl = v22 ? 0 : buf[p + 9]
      const f1 = v22 ? 0 : buf[p + 8]
      const skip = ver === 3 ? f1 & 0xc0 : ver === 4 ? fl & 0x0c : 0
      if (!skip) {
        let body = buf.slice(p + hdr, p + hdr + len)
        if (ver === 4 && fl & 0x01) body = body.slice(4)
        if (ver === 4 && (fl & 0x02 || flags & 0x80)) body = unsync(body)
        const pic = pictureFrame(body, v22)
        if (pic) found.push(pic)
      }
    }
    p += hdr + len
  }
  const best = found.find(x => x.type === 3) || found[0]
  return best ? pack(best.data, best.hint) : null
}

async function flacCover(blob) {
  let pos = 4
  const found = []
  for (let guard = 0; guard < 64; guard++) {
    const h = await bytes(blob, pos, 4)
    if (h.length < 4) break
    const last = h[0] & 0x80
    const type = h[0] & 0x7f
    const len = be24(h, 1)
    if (type === 6 && len < 24e6) {
      const b = await bytes(blob, pos + 4, len)
      const pictureType = be32(b, 0)
      const mlen = be32(b, 4)
      const mime = text(b, 8, 8 + mlen)
      let i = 8 + mlen
      i += 4 + be32(b, i)
      i += 16
      const dlen = be32(b, i)
      i += 4
      found.push({ type: pictureType, data: b.slice(i, i + dlen), hint: mime })
    }
    pos += 4 + len
    if (last) break
  }
  const best = found.find(x => x.type === 3) || found[0]
  return best ? pack(best.data, best.hint) : null
}

function box(buf, from, to, name) {
  let p = from
  while (p + 8 <= to) {
    let size = be32(buf, p)
    const type = text(buf, p + 4, p + 8)
    let head = 8
    if (size === 1) { size = be32(buf, p + 12); head = 16 } else if (size === 0) size = to - p
    if (size < head) return null
    if (type === name) return [p + head, Math.min(p + size, to)]
    p += size
  }
  return null
}

async function mp4Cover(blob) {
  let pos = 0
  while (pos + 8 <= blob.size) {
    const h = await bytes(blob, pos, 16)
    let size = be32(h, 0)
    const type = text(h, 4, 8)
    if (size === 1) size = be32(h, 12)
    else if (size === 0) size = blob.size - pos
    if (size < 8) return null
    if (type === 'moov') {
      if (size > 40e6) return null
      const buf = await bytes(blob, pos, size)
      const start = be32(h, 0) === 1 ? 16 : 8
      const udta = box(buf, start, buf.length, 'udta')
      if (!udta) return null
      const meta = box(buf, udta[0], udta[1], 'meta')
      if (!meta) return null
      const ilst = box(buf, meta[0] + 4, meta[1], 'ilst')
      if (!ilst) return null
      const covr = box(buf, ilst[0], ilst[1], 'covr')
      if (!covr) return null
      const data = box(buf, covr[0], covr[1], 'data')
      if (!data) return null
      const flag = buf[data[0] + 3]
      return pack(buf.slice(data[0] + 8, data[1]), flag === 14 ? 'image/png' : 'image/jpeg')
    }
    pos += size
  }
  return null
}

export async function embeddedCover(blob) {
  try {
    const head = await bytes(blob, 0, 12)
    if (text(head, 0, 3) === 'ID3') return await id3Cover(blob, head)
    if (text(head, 0, 4) === 'fLaC') return await flacCover(blob)
    if (text(head, 4, 8) === 'ftyp') return await mp4Cover(blob)
  } catch {}
  return null
}
