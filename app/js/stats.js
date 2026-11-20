import { $ } from './lib/dom.js'
import { sb } from './supabase.js'
import { countUp } from './ui.js'

export async function loadStats() {
  try {
    let seen = false
    try { seen = !!sessionStorage.getItem('ouce_visit'); sessionStorage.setItem('ouce_visit', '1') } catch {}
    if (!seen) await sb.rpc('bump_stat', { stat: 'visits' })
    const { data, error } = await sb.rpc('get_site_stats')
    if (error || !data) throw error || new Error('sem dados')
    countUp($('#sUsers'), Number(data.users) || 0)
    countUp($('#sPlays'), Number(data.plays) || 0)
    countUp($('#sVisits'), Number(data.visits) || 0)
  } catch (err) {
    console.warn(err)
  }
}
