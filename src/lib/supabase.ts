import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gkymtcxnhijszkelhrzv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreW10Y3huaGlqc3prZWxocnp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTY2NTcsImV4cCI6MjEwNDQ3MjY1N30.Ut19SUjLmutdAgoQLIlzNLp3P2Bfz39nT5ZTVAsigoo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
