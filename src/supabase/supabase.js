import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL || "https://blszfpvfrqwgsqrjchlw.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "sb_publishable_g1Kbo6FsT5g4mLI0gfZQmA_Acpzh9yz";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});

export default supabase;

