const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Testing insert...");
  const { data, error } = await supabase
    .from('training_history')
    .upsert([{
      date: new Date().toISOString().split('T')[0],
      feeling: 'Test',
      activity: 'Test',
      ai_recommendation: 'Test'
    }], { onConflict: 'date' });
    
  console.log("Result:", error ? error : "Success!");
}
run();
