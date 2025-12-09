import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase env vars mancanti: configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper rapido per verificare la connessione: prova a listare le tabelle pubbliche
export async function pingSupabase() {
  // Richiede che la funzione rpc `pg_catalog.pg_tables` sia accessibile (solo per debug).
  // In alternativa, sostituisci con una tua tabella pubblica esistente.
  const { data, error } = await supabase.rpc('pg_tables_list')
  return { data, error }
}

