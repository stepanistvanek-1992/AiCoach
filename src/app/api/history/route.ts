import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('training_history')
      .select('*')
      .order('date', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching history:', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('API Route Error:', err);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
