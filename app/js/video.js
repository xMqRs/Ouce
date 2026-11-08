import { decodeBlob, toWav } from './lib/audio.js'

const MAX_VIDEO_BYTES = 250 * 1024 * 1024
const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|ogv|3gp)$/i

export const isVideo = f => f.type.startsWith('video/') || VIDEO_EXT.test(f.name)

export async function extractAudio(file) {
  if (file.size > MAX_VIDEO_BYTES) throw new Error('video grande')
  const buffer = await decodeBlob(file)
  const name = file.name.replace(/\.[^.]+$/, '') + '.wav'
  return new File([toWav(buffer)], name, { type: 'audio/wav' })
}

export function videoError(err) {
  if (err.message === 'video grande') return 'Esse vídeo passa de 250 MB. Use um arquivo menor.'
  if (err.message === 'faixa longa demais') return 'O áudio desse vídeo passa de 15 minutos, é longo demais.'
  return 'Não consegui ler o áudio desse vídeo. Tente um MP4 ou WebM.'
}
