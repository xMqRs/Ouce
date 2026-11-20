import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
import { config } from './config.js'

export const sb = createClient(config.supabaseUrl, config.supabaseAnonKey)
