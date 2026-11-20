export const FX_KEYS = ['slowed', 'speedup', 'reverb', 'bass']

export const presets = {
  original: { label: 'Original', slowed: 0, speedup: 0, reverb: 0, bass: 0 },
  slowed: { label: 'Slowed', slowed: 0.35, speedup: 0, reverb: 0, bass: 0.15 },
  slowedVerb: { label: 'Slowed + Reverb', slowed: 0.36, speedup: 0, reverb: 0.5, bass: 0.2 },
  speedUp: { label: 'Speed up', slowed: 0, speedup: 0.3, reverb: 0, bass: 0.1 },
  nightcore: { label: 'Nightcore', slowed: 0, speedup: 0.5, reverb: 0.15, bass: 0 },
  bass: { label: 'Grave pesado', slowed: 0, speedup: 0, reverb: 0.1, bass: 0.9 }
}
export const rateOf = ({ slowed, speedup }) => (slowed > 0 ? 1 - slowed * 0.5 : 1 + speedup * 0.8)
