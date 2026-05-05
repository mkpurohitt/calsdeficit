import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://idpuvnailbhqedpaedfo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkcHV2bmFpbGJocWVkcGFlZGZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Mzk2MDUsImV4cCI6MjA5MTMxNTYwNX0.vTTNDsXojY9BygpvGtO_IZ-FitKs9_TK2wLYmSChb94";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.auth.signUp({
    email: `test_${Date.now()}@test.com`,
    password: 'Password123!',
  });
  console.log("signup:", data.user ? "success" : "fail", error);
}

check();
