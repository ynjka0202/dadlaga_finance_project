import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = "https://hqchcktoshmnrwkjttvr.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxY2hja3Rvc2htbnJ3a2p0dHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjkwODUsImV4cCI6MjA5NjU0NTA4NX0.XTgRub6nn61YnA6z8yEghVZ3elKVi6vjE37lKfRSUpM"
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)



 if(supabase.auth){
  console.log("Холбогдсон байна");
  console.log(supabase.auth);
 }