require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  console.log("Checking existing...");
  const date = new Date().toISOString().split('T')[0];
  const { data: existing, error: fetchError } = await supabase
    .from('training_history')
    .select('id')
    .eq('date', date);

  console.log("Fetch result:", existing, fetchError);

  if (fetchError) return;

  if (existing && existing.length > 0) {
    console.log("Updating...");
    const { error } = await supabase.from('training_history').update({
      feeling: 'Neutrální',
      activity: '[Včera: Běh] Recovery: 100% | RHR: 50 | BB: 80 | Spánek: 8h',
      ai_recommendation: 'Test'
    }).eq('id', existing[0].id);
    console.log("Update error:", error);
  } else {
    console.log("Inserting...");
    const { error } = await supabase.from('training_history').insert([{
      date: date,
      feeling: 'Neutrální',
      activity: '[Včera: Běh] Recovery: 100% | RHR: 50 | BB: 80 | Spánek: 8h',
      ai_recommendation: 'Test'
    }]);
    console.log("Insert error:", error);
  }
}
test();
