import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface TrainingRecord {
  id?: string;
  created_at?: string;
  date: string;
  feeling: string;
  activity: string; // Tady si můžeme uložit např. RHR a BB pro kontext
  ai_recommendation: string;
}

export const getHistory = async (): Promise<TrainingRecord[]> => {
  const { data, error } = await supabase
    .from('training_history')
    .select('*')
    .order('date', { ascending: false })
    .limit(7);

  if (error) {
    console.error('Error fetching history:', error);
    return [];
  }
  return data || [];
};

export const savePlan = async (record: TrainingRecord) => {
  // 1. Zkontrolujeme, jestli už pro dnešek existuje záznam
  const { data: existing, error: fetchError } = await supabase
    .from('training_history')
    .select('id')
    .eq('date', record.date);

  if (fetchError) {
    console.error('Error fetching plan:', fetchError);
    throw new Error('Failed to check existing plan.');
  }

  if (existing && existing.length > 0) {
    // 2. Pokud existuje, updatujeme ho
    const { error: updateError } = await supabase
      .from('training_history')
      .update(record)
      .eq('id', existing[0].id);

    if (updateError) {
      console.error('Error updating plan:', updateError);
      throw new Error('Failed to update plan in database.');
    }
  } else {
    // 3. Pokud neexistuje, vytvoříme nový
    const { error: insertError } = await supabase
      .from('training_history')
      .insert([record]);

    if (insertError) {
      console.error('Error saving plan:', insertError);
      throw new Error('Failed to save plan to database.');
    }
  }
};
