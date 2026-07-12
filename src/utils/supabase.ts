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
  const { error } = await supabase
    .from('training_history')
    .insert([record]);

  if (error) {
    console.error('Error saving plan:', error);
    throw new Error('Failed to save plan to database.');
  }
};
