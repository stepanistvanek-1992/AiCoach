require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { error: insertError } = await supabase
      .from('training_history')
      .insert([{
        date: new Date().toISOString().split('T')[0],
        feeling: 'Skvěle',
        activity: '[Včera: Odpočinek / Nic] Recovery: 85% | RHR: 50 | BB: 80 | Spánek: 7.5h',
        ai_recommendation: 'Test recommendation'
      }]);
  console.log("Insert Error:", insertError);
}
test();
