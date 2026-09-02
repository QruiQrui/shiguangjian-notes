import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://uiqufuswxqilvhiboqva.supabase.co",
  "sb_publishable_F7isT-R2gx5s1tmp_QqPBA_SOKHZT5z",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

